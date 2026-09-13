import { spawn } from "node:child_process";
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { claimNext, finishItem, appendAction } from "../lib/pi-inbox";
/**
 * Pool supervisor (worker pool daemon).
 *
 * Polls the target project's inbox.sqlite; for each queued item it claims a slot
 * and spawns a non-interactive `pi -p --mode json` worker carrying the
 * 0-loop-dispatcher skill. The worker's stdout JSON event stream is appended to
 * runs/<name>.actions.jsonl (live visualization source). On exit the inbox item
 * is marked done/blocked/failed.
 *
 * Non-interactive, one process per task, context per worker is throwaway.
 */

const TARGET = process.env.PI_TARGET_DIR ?? "/home/a1/pi-loop-harness/framework";
const MAX_CONCURRENT = Number(process.env.MAX_CONCURRENT ?? "2");
const POLL_MS = Number(process.env.POLL_MS ?? "3000");
const DISPATCHER_SKILL = join(TARGET, ".pi", "skills", "entries", "0-loop-dispatcher");
const WORKTREES = join(TARGET, ".worktrees");

const slots = new Set<string>();
let stopping = false;

function log(msg: string): void {
  const at = new Date().toISOString();
  console.log(`[runner ${at}] ${msg}`);
}

function spawnWorker(item: { id: string; name: string; request: string; entry: string }): Promise<number> {
  const piDir = join(TARGET, ".pi");
  const args = [
    "--mode", "json",
    "-p",
    "--no-session",
    "--skill", DISPATCHER_SKILL,
    `entry=${item.entry}; ${item.request}`,
  ];
  log(`claim ${item.id} "${item.name}" → spawn pi -p (${args.join(" ")})`);

  const proc = spawn("pi", args, { cwd: TARGET, stdio: ["ignore", "pipe", "pipe"], env: { ...process.env, PI_SUBAGENT_ROLE: "dispatcher" } });
  slots.add(item.id);

  let buffer = "";
  proc.stdout.on("data", (chunk: Buffer) => {
    buffer += chunk.toString();
    let idx: number;
    while ((idx = buffer.indexOf("\n")) >= 0) {
      const line = buffer.slice(0, idx).trim();
      buffer = buffer.slice(idx + 1);
      if (!line) continue;
      appendAction(piDir, item.name, line);
    }
  });

  return new Promise<number>((resolve) => {
    proc.stderr.on("data", () => { /* stderr kept in worker logs, not surfaced */ });
    proc.on("error", () => resolve(1));
    proc.on("close", (code) => {
      if (buffer.trim()) appendAction(piDir, item.name, buffer.trim());
      resolve(code ?? 0);
    });
  });
}

async function pump(): Promise<void> {
  if (stopping) return;
  const piDir = join(TARGET, ".pi");
  while (slots.size < MAX_CONCURRENT) {
    const item = claimNext(piDir);
    if (!item) break;
    slots.add(item.id);
    // Detach the worker lifecycle from the pump loop.
    void spawnWorker(item)
      .then(async (code) => {
        const ok = code === 0;
        finishItem(piDir, item.id, ok ? "done" : "failed", item.ledger, ok ? undefined : `worker exit ${code}`);
        log(`finish ${item.id} "${item.name}" ${ok ? "done" : `failed(${code})`}`);
      })
      .catch((err) => {
        finishItem(piDir, item.id, "failed", item.ledger, String(err));
        log(`error ${item.id}: ${String(err)}`);
      })
      .finally(() => {
        slots.delete(item.id);
      });
  }
}

function shutdown(): void {
  stopping = true;
  log(`shutdown (${slots.size} worker(s) active)`);
  process.exit(0);
}

async function main(): Promise<void> {
  mkdirSync(WORKTREES, { recursive: true });
  log(`pool up: target=${TARGET} workers=${MAX_CONCURRENT} poll=${POLL_MS}ms`);
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
  await pump();
  setInterval(() => void pump(), POLL_MS);
}

void main().catch((err) => {
  console.error(err);
  process.exit(1);
});
