import { DatabaseSync } from "node:sqlite";
import { mkdirSync } from "fs";
import { join, dirname } from "path";

export interface InboxItem {
  id: string;
  name: string;
  request: string;
  entry: "feature" | "bug";
  status: "queued" | "running" | "done" | "blocked" | "failed";
  created: string;
  updated: string;
  ledger?: string;
  error?: string;
}

const schema = `
CREATE TABLE IF NOT EXISTS inbox (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  request TEXT NOT NULL,
  entry TEXT NOT NULL DEFAULT 'feature',
  status TEXT NOT NULL DEFAULT 'queued',
  created TEXT NOT NULL,
  updated TEXT NOT NULL,
  ledger TEXT,
  error TEXT
);
CREATE INDEX IF NOT EXISTS inbox_status ON inbox(status);
CREATE INDEX IF NOT EXISTS inbox_created ON inbox(created DESC);
`;

function dbPath(piDir: string): string {
  return join(piDir, "runs", "inbox.sqlite");
}

function open(piDir: string): DatabaseSync {
  const filePath = dbPath(piDir);
  mkdirSync(dirname(filePath), { recursive: true });
  const db = new DatabaseSync(filePath);
  db.exec(schema);
  return db;
}

function slugify(text: string): string {
  const s = text.toLowerCase().replace(/[^\p{L}\p{N}\s-]/gu, "").trim().replace(/\s+/g, "-").slice(0, 48);
  return s || `task-${Date.now().toString(36)}`;
}

/** Create a new inbox item (queued). Returns the created item. */
export async function enqueue(piDir: string, cwd: string, request: string, entry: "feature" | "bug"): Promise<InboxItem> {
  const db = open(piDir);
  try {
    const now = new Date().toISOString();
    const name = slugify(request);
    const id = `${now.replace(/[^\d]/g, "").slice(0, 14)}-${Math.random().toString(36).slice(2, 6)}`;
    const item: InboxItem = {
      id,
      name,
      request,
      entry,
      status: "queued",
      created: now,
      updated: now,
      ledger: `.pi/plan/${name}.md`,
    };
    db.prepare("INSERT INTO inbox (id, name, request, entry, status, created, updated, ledger) VALUES (?, ?, ?, ?, ?, ?, ?, ?)")
      .run(id, name, request, entry, "queued", now, now, item.ledger ?? null);
    return item;
  } finally {
    db.close();
  }
}

/** List inbox items, newest first. */
export function listInbox(piDir: string, limit = 100): InboxItem[] {
  const db = open(piDir);
  try {
    const rows = db.prepare("SELECT * FROM inbox ORDER BY created DESC LIMIT ?").all(limit) as unknown as InboxItem[];
    return rows;
  } finally {
    db.close();
  }
}

/** Claim the next queued item atomically → mark running. Returns null when empty. */
export function claimNext(piDir: string): InboxItem | null {
  const db = open(piDir);
  try {
    const row = db.prepare("SELECT * FROM inbox WHERE status = 'queued' ORDER BY created ASC LIMIT 1").get() as InboxItem | undefined;
    if (!row) return null;
    db.prepare("UPDATE inbox SET status = 'running', updated = ? WHERE id = ?").run(new Date().toISOString(), row.id);
    return { ...row, status: "running" };
  } finally {
    db.close();
  }
}

/** Mark an item done/blocked/failed with optional ledger/error. */
export function finishItem(piDir: string, id: string, status: "done" | "blocked" | "failed", ledger?: string, error?: string): void {
  const db = open(piDir);
  try {
    db.prepare("UPDATE inbox SET status = ?, updated = ?, ledger = COALESCE(?, ledger), error = ? WHERE id = ?")
      .run(status, new Date().toISOString(), ledger ?? null, error ?? null, id);
  } finally {
    db.close();
  }
}

export function getItem(piDir: string, id: string): InboxItem | undefined {
  const db = open(piDir);
  try {
    return db.prepare("SELECT * FROM inbox WHERE id = ?").get(id) as InboxItem | undefined;
  } finally {
    db.close();
  }
}