/**
 * pi-permissions — 角色权限门（硬约束）。
 *
 * 依据 06-loopengineer 的权限模型（read-only / workspace-write / predefined-commands）
 * 与官方 permission-gate 的事件拦截，把"复测者只读、实现者只写工作树、契约冻结"从
 * skill 里的文本约定变成扩展层的硬拦截。
 *
 * 角色通过环境变量 PI_SUBAGENT_ROLE 注入（由 subagent 扩展在派生子进程时设置）：
 *   - investigator / reviewer  → read-only：禁 write/edit + 禁破坏性 bash
 *   - implementer              → workspace-write：只许写 .worktrees/ 下文件 + 禁破坏性 git
 *   - task-slice 产物只读      → 任何人（含 implementer）不得改契约/冻结制品
 *   - main/主会话              → 宽松：只挡 .git/ 与显式破坏
 *
 * 核心判定在纯函数 decidePolicy()，可单测；扩展本体只做事件接线。
 */

import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

export const READ_ONLY_ROLES = new Set(["reviewer", "investigator"]);
export const WRITE_ROLES = new Set(["implementer", "fixer"]);

/** 任何角色都不可写的冻结制品（契约 + 冻结文档）。 */
export const FROZEN_PATHS = [
  "glue/interfaces/",
  ".pi/plan/",
  ".pi/spec/",
  ".pi/tasks/",
  ".pi/smoke/",
  ".git/",
  ".env",
];

/** 破坏性 bash：read-only 角色一律禁；write 角色禁 git 危险子命令 + 系统破坏。 */
export const DESTRUCTIVE_PATTERNS = [
  /\brm\s+(-rf?|--recursive)/i,
  /\bmv\b/,
  /\bsudo\b/,
  /\bshutdown\b/,
  /\breboot\b/,
  /\b(?:chmod|chown)\b.*\d{3}/i,
];

/** 即使 workspace-write 也不允许的 git 子命令（会动主干/历史/远端）。 */
export const DENIED_GIT_SUBCOMMANDS = new Set([
  "push", "reset", "rebase", "checkout", "restore", "clean",
  "branch", "tag", "remote", "fetch", "pull", "merge", "gc",
  "reflog", "filter-branch",
]);

export type PermissionDecision =
  | { block: true; reason: string }
  | { block: false; reason?: undefined };

export interface ToolEventLike {
  toolName: string;
  input?: Record<string, unknown>;
}

export function currentRole(): string {
  return process.env.PI_SUBAGENT_ROLE || "main";
}

function pathOf(event: ToolEventLike): string {
  const input = event.input ?? {};
  return (
    (input.path as string) ||
    (input.file_path as string) ||
    (input.filePath as string) ||
    ""
  );
}

export function isFrozenPath(p: string): string | undefined {
  if (!p) return undefined;
  const n = p.replace(/\\/g, "/");
  return FROZEN_PATHS.find((frozen) => n.includes(frozen));
}

export function dangerousBash(cmd: string): string | undefined {
  for (const re of DESTRUCTIVE_PATTERNS) {
    if (re.test(cmd)) {
      return `Bash was blocked by destructive pattern ${re}: "${cmd}"`;
    }
  }
  const gitMatch = cmd.match(/\bgit\s+(?:-C\s+\S+\s+)?(\w+)/);
  if (gitMatch && DENIED_GIT_SUBCOMMANDS.has(gitMatch[1])) {
    return `git ${gitMatch[1]} is not allowed in this role (would touch main/history/remote).`;
  }
  if (cmd.includes(".worktrees/") && /\bgit\s+worktree\s+remove/.test(cmd)) {
    return undefined; // worktree removal is owned by merge stage
  }
  return undefined;
}

/** 纯判定：给定角色 + 工具调用，返回是否拦截及原因。 */
export function decidePolicy(role: string, event: ToolEventLike): PermissionDecision {
  const p = pathOf(event);

  // 冻结制品：任何角色禁写（契约/冻结文档是只读锚）。
  if (event.toolName === "write" || event.toolName === "edit") {
    const frozen = isFrozenPath(p);
    if (frozen) {
      return {
        block: true,
        reason: `Path "${p}" is frozen (${frozen}). Contracts (.pi/plan|spec|tasks|smoke, glue/interfaces) are read-only anchors; only the owning step may write them.`,
      };
    }
  }

  // read-only 角色：禁任何写入工具 + 禁破坏性 bash。
  if (READ_ONLY_ROLES.has(role)) {
    if (event.toolName === "write" || event.toolName === "edit") {
      return { block: true, reason: `Role "${role}" is read-only; file writes are prohibited.` };
    }
    if (event.toolName === "bash") {
      const cmd = ((event.input?.command as string) ?? "").trim();
      const why = dangerousBash(cmd);
      if (why) return { block: true, reason: `Role "${role}" is read-only. ${why}` };
    }
    return { block: false };
  }

  // workspace-write 角色：只准写 .worktrees/ 内；禁破坏性 git/系统。
  if (WRITE_ROLES.has(role)) {
    if ((event.toolName === "write" || event.toolName === "edit") && p && !p.includes(".worktrees/")) {
      return {
        block: true,
        reason: `Role "${role}" may only write inside .worktrees/<slug>/; got "${p}". Commit inside your worktree, never in the main checkout.`,
      };
    }
    if (event.toolName === "bash") {
      const cmd = ((event.input?.command as string) ?? "").trim();
      const why = dangerousBash(cmd);
      if (why) return { block: true, reason: why };
    }
    return { block: false };
  }

  // main：只挡极端破坏。
  if (event.toolName === "bash") {
    const cmd = ((event.input?.command as string) ?? "").trim();
    if (/\brm\s+-rf?\s+\/\s*(\s|$)/.test(cmd)) {
      return { block: true, reason: "Refusing potential root rm: protected." };
    }
  }
  return { block: false };
}

export default function hardGate(pi: ExtensionAPI) {
  pi.on("tool_call", async (_event, ctx) => {
    const r = currentRole();
    const decision = decidePolicy(r, _event as unknown as ToolEventLike);
    if (!decision.block) return undefined;

    if (ctx.hasUI) {
      ctx.ui.notify(`Blocked (${r}): ${decision.reason}`, "warning");
    }
    return { block: true, reason: decision.reason };
  });
}