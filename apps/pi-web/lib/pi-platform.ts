import { readdirSync, readFileSync, statSync, type Dirent } from "fs";
import { join, dirname, relative } from "path";
import { parseFrontmatter } from "@earendil-works/pi-coding-agent";
import type { PiArtifactKind, PiArtifactMeta, PiAgentMeta, PiExtensionMeta, PiRunMeta, PiRunLedger, PiSkillMeta } from "@/lib/pi-platform-types";
import { sanitizeRunName } from "@/lib/run-name";

const CONFIG_DIR_NAME = ".pi";

/**
 * A `.pi/` dir counts as a *project* platform dir only when it carries the
 * platform structure (agents/skills/extensions). The user-global `~/.pi` used
 * by the pi agent (agent/data/docs) is excluded so it never shadows a project.
 */
function hasPlatformStructure(dir: string): boolean {
  for (const sub of ["agents", "skills", "extensions"]) {
    try {
      if (statSync(join(dir, sub)).isDirectory()) return true;
    } catch {
      /* keep checking */
    }
  }
  return false;
}

/**
 * Resolve the platform `.pi/` directory for a cwd.
 *
 * Strategy:
 *  1. Walk up from cwd looking for a `.pi/` with platform structure.
 *  2. If none found above, bounded downward search (depth <= 2) from cwd for
 *     the same — covers layouts like `framework/.pi/` under the repo root.
 *
 * Returns the absolute path to `.pi/`, or null.
 */
export function findPiDir(cwd: string): string | null {
  // Upward pass
  let current = cwd;
  while (true) {
    const candidate = join(current, CONFIG_DIR_NAME);
    try {
      if (statSync(candidate).isDirectory() && hasPlatformStructure(candidate)) return candidate;
    } catch {
      /* keep walking */
    }
    const parent = dirname(current);
    if (parent === current) break;
    current = parent;
  }

  // Downward pass (bounded)
  const MAX_DEPTH = 2;
  const queue: Array<{ dir: string; depth: number }> = [{ dir: cwd, depth: 0 }];
  let head = 0;
  while (head < queue.length) {
    const { dir, depth } = queue[head++];
    if (depth > MAX_DEPTH) continue;
    let entries: Dirent[];
    try {
      entries = readdirSync(dir, { withFileTypes: true });
    } catch {
      continue;
    }
    for (const e of entries) {
      if (!e.isDirectory() || e.name === "node_modules" || e.name === ".git") continue;
      const full = join(dir, e.name);
      if (e.name === CONFIG_DIR_NAME) {
        if (hasPlatformStructure(full)) return full;
        continue;
      }
      queue.push({ dir: full, depth: depth + 1 });
    }
  }
  return null;
}

function listMdFiles(dir: string): string[] {
  try {
    return readdirSync(dir, { withFileTypes: true })
      .filter((e) => e.isFile() && e.name.endsWith(".md"))
      .map((e) => join(dir, e.name))
      .sort();
  } catch {
    return [];
  }
}

function normalizeTools(value: unknown): string[] {
  if (typeof value === "string") return value.split(",").map((t) => t.trim()).filter(Boolean);
  if (Array.isArray(value)) return value.filter((t): t is string => typeof t === "string");
  return [];
}

interface FrontmatterMeta {
  [key: string]: unknown;
}

function parseMeta(filePath: string): { frontmatter: FrontmatterMeta; body: string; content: string } {
  const content = readFileSync(filePath, "utf8");
  const { frontmatter = {}, body = content } = parseFrontmatter<FrontmatterMeta>(content);
  return { frontmatter, body, content };
}

function relPath(piDir: string, filePath: string): string {
  return relative(piDir, filePath);
}

function relDirPath(piDir: string, dir: string): string {
  const r = relative(piDir, dir);
  return r === "" ? "." : r;
}

/** List agent definitions under .pi/agents/*.md */
export function listAgents(piDir: string): PiAgentMeta[] {
  const dir = join(piDir, "agents");
  return listMdFiles(dir).map((f) => {
    const { frontmatter, body } = parseMeta(f);
    return {
      name: String(frontmatter.name ?? relative(piDir, f)),
      description: String(frontmatter.description ?? ""),
      tools: normalizeTools(frontmatter.tools),
      model: typeof frontmatter.model === "string" ? frontmatter.model : undefined,
      path: relPath(piDir, f),
      prompt: body,
    };
  });
}

interface SkillFileMeta {
  name: string;
  description: string;
  path: string;
  dir: string;
  category: "entries" | "steps";
  disabled: boolean;
  allowedTools?: string;
}

/** List skills under .pi/skills/{entries,steps} recursively (SKILL.md files) */
export function listSkills(piDir: string): PiSkillMeta[] {
  const results: SkillFileMeta[] = [];
  for (const category of ["entries", "steps"] as const) {
    const root = join(piDir, "skills", category);
    const scan = (dir: string) => {
      let entries: Dirent[];
      try {
        entries = readdirSync(dir, { withFileTypes: true });
      } catch {
        return;
      }
      for (const e of entries) {
        const full = join(dir, e.name);
        if (e.isDirectory()) scan(full);
        else if (e.name === "SKILL.md") {
          const { frontmatter } = parseMeta(full);
          results.push({
            name: String(frontmatter.name ?? relative(piDir, full)),
            description: String(frontmatter.description ?? ""),
            path: relPath(piDir, full),
            dir: relDirPath(piDir, dir),
            category,
            disabled: Boolean(frontmatter["disable-model-invocation"]),
            allowedTools: typeof frontmatter["allowed-tools"] === "string" ? frontmatter["allowed-tools"] : undefined,
          });
        }
      }
    };
    scan(root);
  }
  return results.sort((a, b) => a.dir.localeCompare(b.dir) || a.name.localeCompare(b.name));
}

const EXTENSION_ENTRYPOINTS = ["pi-permissions", "pi-runstate", "question", "subagent"];

/** List extension tools under .pi/extensions/*.ts (best-effort) */
export function listExtensions(piDir: string): PiExtensionMeta[] {
  const dir = join(piDir, "extensions");
  const results: PiExtensionMeta[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    let isTs = false;
    let isSubagentIndex = false;
    if (entry.isFile() && entry.name.endsWith(".ts") && !entry.name.endsWith(".test.ts")) isTs = true;
    if (entry.isDirectory() && entry.name === "subagent" && statSync(join(full, "index.ts")).isFile()) isSubagentIndex = true;
    if (!isTs && !isSubagentIndex) continue;

    const base = entry.isDirectory() ? "subagent" : entry.name.replace(/\.ts$/, "");
    const codePath = entry.isDirectory() ? join(full, "index.ts") : full;
    let tools: string[] = [];
    try {
      const code = readFileSync(codePath, "utf8");
      const names = [...code.matchAll(/(?:name|registerTool)\s*[:\(]\s*["']([a-z_][a-z0-9_-]*)["']/g)]
        .map((m) => m[1])
        .filter((n) => n !== "name");
      const toolRegex = /(?:name|registerTool\()\s*[:\(]\s*["']([a-z_][a-z0-9_-]*)["']/g;
      for (const m of code.matchAll(toolRegex)) {
        if (!names.includes(m[1])) names.push(m[1]);
      }
      tools = Array.from(new Set(names)).sort();
      if (tools.length === 0) tools = [base];
    } catch {
      tools = [base];
    }
    results.push({
      name: base,
      path: relPath(piDir, codePath),
      entrypoint: EXTENSION_ENTRYPOINTS.includes(base) ? "builtin" : "custom",
      tools,
      summary: readSummary(codePath),
    });
  }
  return results.sort((a, b) => a.name.localeCompare(b.name));
}

function readSummary(filePath: string): string {
  try {
    const head = readFileSync(filePath, "utf8").split("\n").slice(0, 4).join("\n");
    return head.replace(/^\/\*\*?|\*\/$/g, "").trim().slice(0, 200);
  } catch {
    return "";
  }
}

/** List run ledgers under .pi/runs/*.json */
export function listRuns(piDir: string): PiRunMeta[] {
  const dir = join(piDir, "runs");
  let files: string[];
  try {
    files = readdirSync(dir, { withFileTypes: true })
      .filter((e) => e.isFile() && e.name.endsWith(".json"))
      .map((e) => e.name)
      .sort()
      .reverse();
  } catch {
    return [];
  }
  const metas: PiRunMeta[] = [];
  for (const name of files) {
    const filePath = join(dir, name);
    const base = name.replace(/\.json$/, "");
    try {
      const ledger = JSON.parse(readFileSync(filePath, "utf8")) as PiRunLedger;
      metas.push({
        name: base,
        stage: ledger.stage ?? "unknown",
        entry: ledger.entry ?? "feature",
        created: ledger.created,
        updated: ledger.updated,
        retry: ledger.retry,
        taskCount: ledger.tasks?.length ?? 0,
        taskDone: ledger.tasks?.filter((t) => t.status === "merged" || t.status === "retested" || t.status === "implemented").length ?? 0,
        path: relPath(piDir, filePath),
        summary: summarizeRun(ledger),
      });
    } catch {
      metas.push({ name: base, stage: "unreadable", entry: "feature", created: "", updated: "", path: relPath(piDir, filePath), taskCount: 0, taskDone: 0, summary: "unreadable ledger" });
    }
  }
  return metas;
}

function summarizeRun(ledger: PiRunLedger): string {
  const events = ledger.events ?? [];
  const last = events[events.length - 1];
  return last ? `${last.msg}` : ledger.original_request?.slice(0, 120) ?? "";
}

/** Read a single run ledger by name */
export function readRun(piDir: string, name: string): PiRunLedger | null {
  const safe = sanitizeRunName(name);
  const filePath = join(piDir, "runs", `${safe}.json`);
  try {
    return JSON.parse(readFileSync(filePath, "utf8")) as PiRunLedger;
  } catch {
    return null;
  }
}

/** List artifact markdown under .pi/{kind}/*.md */
export function listArtifacts(piDir: string, kind: PiArtifactKind): PiArtifactMeta[] {
  const dir = join(piDir, kind);
  return listMdFiles(dir).map((f) => {
    const base = relative(dir, f).replace(/\.md$/, "");
    const { frontmatter } = parseMeta(f);
    return {
      name: base,
      kind,
      path: relPath(piDir, f),
      title: String(frontmatter.title ?? base),
    };
  });
}

/** Read worker action events (JSON lines) from runs/<name>/actions.jsonl. */
export function readActionLines(piDir: string, name: string): { events: unknown[]; count: number } {
  const safe = sanitizeRunName(name);
  const filePath = join(piDir, "runs", `${safe}.actions.jsonl`);
  try {
    const text = readFileSync(filePath, "utf8");
    const events: unknown[] = [];
    for (const line of text.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      try {
        events.push(JSON.parse(trimmed));
      } catch {
        /* skip malformed line */
      }
    }
    return { events, count: events.length };
  } catch {
    return { events: [], count: 0 };
  }
}

export const ARTIFACT_KINDS: PiArtifactKind[] = ["plan", "spec", "tasks", "smoke", "feasibility"];

/** Read artifact content by kind + name */
export function readArtifact(piDir: string, kind: PiArtifactKind, name: string): string | null {
  const safe = name.replace(/[^\w.-]/g, "");
  if (safe !== name) return null;
  const filePath = join(piDir, kind, `${name}.md`);
  try {
    return readFileSync(filePath, "utf8");
  } catch {
    return null;
  }
}

export { CONFIG_DIR_NAME };
