/**
 * pi-runstate — run-state 账本工具（硬约束：schema 校验 + 断点续跑 + 审计）。
 *
 * 依据 loopd 的 ledger（确定性状态）与 loopengineer 的 zod 校验，把
 * `.pi/runs/<name>.json` 从"靠 agent 手写 JSON"变成带 schema 校验的工具读写。
 *
 * 提供两个工具：
 *   runstate_get   — 读账本；可选校验 stage 是否等于期望值（防跳步）
 *   runstate_update— 原子更新账本（改 stage / 追加 events / 记 retry / 更新 tasks）
 *
 * 账本 schema（与 .pi/skills/entries/0-loop-dispatcher/references/run-state.md 对齐）：
 * {
 *   name, stage, entry, created, updated,
 *   plan_path, original_request,
 *   retry: { implement, retest_loop },
 *   tasks: [{ id, criterion, scope[], ctr[], branch, worktree, status }],
 *   events: [{ at, stage, msg }]
 * }
 */

import { defineTool, type ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { Text } from "@earendil-works/pi-tui";
import { StringEnum } from "@earendil-works/pi-ai";
import { Type } from "typebox";
import * as fs from "node:fs";
import * as path from "node:path";

const STAGES = [
	"plan", "explore", "ask", "spec", "tasks", "implement",
	"retest", "merge", "smoke", "blocked", "done",
] as const;
type Stage = (typeof STAGES)[number];

const TASK_STATUSES = ["pending", "implemented", "retested", "merged", "blocked"] as const;

interface RunState {
	name: string;
	stage: Stage;
	entry: "feature" | "bug";
	created: string;
	updated: string;
	plan_path: string;
	original_request: string;
	retry: { implement: number; retest_loop: number };
	tasks: {
		id: string;
		criterion: string;
		scope: string[];
		ctr: string[];
		branch?: string;
		worktree?: string;
		status: (typeof TASK_STATUSES)[number];
	}[];
	events: { at: string; stage: string; msg: string }[];
}

function runStatePath(cwd: string, name: string): string {
	return path.join(cwd, ".pi", "runs", `${name}.json`);
}

function readState(filePath: string): RunState | undefined {
	try {
		const raw = fs.readFileSync(filePath, "utf-8");
		const data = JSON.parse(raw);
		if (!data || typeof data !== "object" || typeof data.name !== "string") return undefined;
		return data as RunState;
	} catch {
		return undefined;
	}
}

function writeState(filePath: string, state: RunState): RunState {
	state.updated = new Date().toISOString();
	fs.mkdirSync(path.dirname(filePath), { recursive: true });
	fs.writeFileSync(filePath, JSON.stringify(state, null, 2) + "\n", "utf-8");
	return state;
}

function validStage(s: unknown): s is Stage {
	return typeof s === "string" && (STAGES as readonly string[]).includes(s);
}

function validTaskStatus(s: unknown): s is RunState["tasks"][number]["status"] {
	return typeof s === "string" && (TASK_STATUSES as readonly string[]).includes(s);
}

const RunStateGetParams = Type.Object({
	name: Type.String({ description: "Feature/bug name (matches .pi/runs/<name>.json)" }),
	expectStage: Type.Optional(
		Type.String({
			description:
				"Expected current stage. When provided and the actual stage differs, the read fails with a jump-stage error (prevents skipping steps / double-running).",
		}),
	),
});

const RunStateUpdateParams = Type.Object({
	name: Type.String({ description: "Feature/bug name (matches .pi/runs/<name>.json)" }),
	stage: Type.Optional(
		Type.String({
			description: "Set the current stage. Use one of: " + STAGES.join(", "),
		}),
	),
	event: Type.Optional(
		Type.String({ description: "Append one audit event message (e.g. SPEC_FROZEN, IMPLEMENTED t1)." }),
	),
	taskStatus: Type.Optional(
		Type.Object({
			id: Type.String({ description: "Task id (t1, t2, ...)" }),
			status: Type.Optional(
				Type.String({ description: "New status: " + TASK_STATUSES.join(", ") }),
			),
			branch: Type.Optional(Type.String({ description: "Branch of the task worktree" })),
			worktree: Type.Optional(Type.String({ description: "Worktree path of the task" })),
		}),
	),
	retry: Type.Optional(
		Type.Object({
			implement: Type.Optional(Type.Integer({ description: "Set implement retry counter" })),
			retest_loop: Type.Optional(Type.Integer({ description: "Set 4->5 loop counter" })),
		}),
	),
});

const RunStateCreateParams = Type.Object({
	name: Type.String({ description: "Feature/bug name (matches .pi/runs/<name>.json)" }),
	entry: Type.Optional(
		StringEnum(["feature", "bug"] as const, {
			description: "Pipeline entry type. Default: feature",
			default: "feature",
		}),
	),
	originalRequest: Type.String({
		description: "The verbatim original requirement (regression anchor). Store the user's exact words.",
	}),
	planPath: Type.Optional(
		Type.String({ description: "Path to the frozen PLAN file, e.g. .pi/plan/<name>.md" }),
	),
});

function formatState(state: RunState): string {
	const tasks = state.tasks
		.map((t) => `- ${t.id} [${t.status}] ${t.criterion}${t.branch ? ` (${t.branch})` : ""}`)
		.join("\n");
	const lastEvents = state.events.slice(-5).map((e) => `- ${e.at} ${e.stage}: ${e.msg}`).join("\n");
	return [
		`name: ${state.name}`,
		`stage: ${state.stage}`,
		`entry: ${state.entry}`,
		`created: ${state.created}`,
		`plan: ${state.plan_path}`,
		`retry: implement=${state.retry.implement} retest_loop=${state.retry.retest_loop}`,
		`tasks:`,
		tasks || "  (none)",
		`recent events:`,
		lastEvents || "  (none)",
	].join("\n");
}

export default function runStateTools(pi: ExtensionAPI) {
	pi.registerTool(
		defineTool({
			name: "runstate_get",
			label: "RunState Get",
			description:
				"Read the run-state ledger for a feature/bug (断点续跑与审计的唯一状态源). Returns current stage, retry counters, task list and recent events. Optionally verify the stage hasn't been skipped (pass expectStage to fail on mismatch).",
			promptSnippet: "Read the current pipeline run-state before acting",
			parameters: RunStateGetParams,
			async execute(_callId, params, _signal, _onUpdate, ctx) {
				const filePath = runStatePath(ctx.cwd, params.name);
				const state = readState(filePath);
				if (!state) {
					return {
						content: [
							{
								type: "text",
								text: `No run-state found at ${filePath}. Did you run 1-plan-alignment first?`,
							},
						],
						details: { found: false, name: params.name },
					};
				}
				if (params.expectStage && state.stage !== params.expectStage) {
					return {
						content: [
							{
								type: "text",
								text: `Stage mismatch: expected "${params.expectStage}" but ledger says "${state.stage}". STOP — a step was skipped or is being re-run. Resume from ${state.stage}.`,
							},
						],
						details: { found: true, state, mismatch: true },
					};
				}
				return {
					content: [{ type: "text", text: formatState(state) }],
					details: { found: true, state },
				};
			},
			renderResult(result, _opts, theme) {
				const details = result.details as { state?: RunState } | undefined;
				const text = result.content[0];
				if (details?.state) {
					return new Text(
						theme.fg("toolTitle", theme.bold(`runstate · ${details.state.name}`)) +
							"\n" +
							theme.fg("text", formatState(details.state)),
						0,
						0,
					);
				}
				return new Text(text?.type === "text" ? text.text : "", 0, 0);
			},
		}),
	);

	pi.registerTool(
		defineTool({
			name: "runstate_create",
			label: "RunState Create",
			description:
				"Create the run-state ledger for a new feature/bug (called by 1-plan-alignment or bug-triage). Fails if it already exists. Stores the verbatim original request as the regression anchor.",
			promptSnippet: "Create the pipeline run-state ledger for a new feature/bug",
			parameters: RunStateCreateParams,
			async execute(_callId, params, _signal, _onUpdate, ctx) {
				const filePath = runStatePath(ctx.cwd, params.name);
				const existing = readState(filePath);
				if (existing) {
					return {
						content: [
							{
								type: "text",
								text: `Run-state already exists for "${params.name}" (stage=${existing.stage}). Use runstate_get / runstate_update.`,
							},
						],
						details: { created: false, state: existing },
					};
				}
				const now = new Date().toISOString();
				const entry = (params.entry as "feature" | "bug" | undefined) ?? "feature";
				const state: RunState = {
					name: params.name,
					stage: "plan",
					entry,
					created: now,
					updated: now,
					plan_path: params.planPath ?? `.pi/plan/${params.name}.md`,
					original_request: params.originalRequest,
					retry: { implement: 0, retest_loop: 0 },
					tasks: [],
					events: [{ at: now, stage: "plan", msg: `created (entry=${entry})` }],
				};
				writeState(filePath, state);
				return {
					content: [{ type: "text", text: `Run-state created for "${params.name}".\n\n${formatState(state)}` }],
					details: { created: true, state },
				};
			},
			renderResult(result, _opts, theme) {
				const details = result.details as { state?: RunState } | undefined;
				const text = result.content[0];
				if (details?.state) {
					return new Text(
						theme.fg("toolTitle", theme.bold(`runstate ✓ created ${details.state.name}`)) +
							"\n" +
							theme.fg("text", formatState(details.state)),
						0,
						0,
					);
				}
				return new Text(text?.type === "text" ? text.text : "", 0, 0);
			},
		}),
	);

	pi.registerTool(
		defineTool({
			name: "runstate_update",
			label: "RunState Update",
			description:
				"Append/update the run-state ledger for a feature/bug: advance stage, append an audit event, update a task's status/branch/worktree, or set retry counters. All updates are atomic and always add to the audit log. Returns the updated ledger.",
			promptSnippet: "Advance the pipeline stage / record an audit event in the run-state ledger",
			parameters: RunStateUpdateParams,
			async execute(_callId, params, _signal, _onUpdate, ctx) {
				const filePath = runStatePath(ctx.cwd, params.name);
				const state = readState(filePath);
				if (!state) {
					return {
						content: [
							{
								type: "text",
								text: `No run-state found at ${filePath}. Create it via 1-plan-alignment (or bug-triage) first.`,
							},
						],
						details: { found: false },
					};
				}

				const problems: string[] = [];
				if (params.stage !== undefined && !validStage(params.stage))
					problems.push(`invalid stage "${params.stage}"`);
				if (params.taskStatus) {
					if (params.taskStatus.status !== undefined && !validTaskStatus(params.taskStatus.status))
						problems.push(`invalid task status "${params.taskStatus.status}"`);
					const t = state.tasks.find((x) => x.id === params.taskStatus?.id);
					if (!t) problems.push(`task "${params.taskStatus.id}" not in ledger`);
				}
				if (problems.length > 0) {
					return {
						content: [{ type: "text", text: `Refusing update: ${problems.join("; ")}` }],
						details: { found: true, problems },
					};
				}

				const eventParts: string[] = [];
				if (params.stage !== undefined) {
					state.stage = params.stage;
					eventParts.push(`stage=${params.stage}`);
				}
				if (params.taskStatus) {
					const t = state.tasks.find((x) => x.id === params.taskStatus?.id)!;
					if (params.taskStatus.status !== undefined) {
						t.status = params.taskStatus.status;
						eventParts.push(`t${t.id}.status=${t.status}`);
					}
					if (params.taskStatus.branch !== undefined) {
						t.branch = params.taskStatus.branch;
						eventParts.push(`t${t.id}.branch=${t.branch}`);
					}
					if (params.taskStatus.worktree !== undefined) {
						t.worktree = params.taskStatus.worktree;
						eventParts.push(`t${t.id}.worktree=${t.worktree}`);
					}
				}
				if (params.retry) {
					if (params.retry.implement !== undefined) state.retry.implement = params.retry.implement;
					if (params.retry.retest_loop !== undefined)
						state.retry.retest_loop = params.retry.retest_loop;
					eventParts.push(
						`retry(implement=${state.retry.implement},retest_loop=${state.retry.retest_loop})`,
					);
				}
				const msg = params.event ?? eventParts.join("; ");
				if (msg) {
					state.events.push({ at: new Date().toISOString(), stage: state.stage, msg });
				}

				writeState(filePath, state);
				return {
					content: [
						{ type: "text", text: `Ledger updated for "${params.name}".\n\n${formatState(state)}` },
					],
					details: { found: true, state },
				};
			},
			renderResult(result, _opts, theme) {
				const details = result.details as { state?: RunState } | undefined;
				const text = result.content[0];
				if (details?.state) {
					return new Text(
						theme.fg("toolTitle", theme.bold(`runstate ✓ ${details.state.name}`)) +
							"\n" +
							theme.fg("text", formatState(details.state)),
						0,
						0,
					);
				}
				return new Text(text?.type === "text" ? text.text : "", 0, 0);
			},
		}),
	);
}