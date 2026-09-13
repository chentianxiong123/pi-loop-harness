"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  ConfigButton,
  ConfigSidebarItem,
  ConfigSidebarList,
  ConfigSidebarText,
  ConfigStatusDot,
} from "./SettingsUi";
import type { PiRunMeta, PiRunLedger } from "@/lib/pi-platform-types";
import type { ToolAction } from "@/lib/task-sidebar-events";
import { mergeActionEvents } from "@/lib/task-sidebar-events";

interface TaskSidebarProps {
  project: { root: string; name: string; piDir: string | null } | null;
}

interface InboxItem {
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

const STAGE_COLOR: Record<string, string> = {
  plan: "#6b7280", explore: "#6b7280", spec: "#6b7280", tasks: "#6b7280",
  implement: "#f59e0b", retest: "#f59e0b", merge: "#f59e0b", smoke: "#f59e0b",
  blocked: "#ef4444", done: "#16a34a", unreadable: "#ef4444",
  queued: "#9c9cf5", running: "#f59e0b", failed: "#ef4444",
};

function stageColor(stage: string): string {
  return STAGE_COLOR[stage] ?? "#6b7280";
}

function Tag({ color, children }: { color: string; children: React.ReactNode }) {
  return (
    <span
      style={{
        fontSize: 10,
        padding: "1px 6px",
        borderRadius: 999,
        background: `color-mix(in srgb, ${color} 13%, transparent)`,
        color,
        fontWeight: 600,
        whiteSpace: "nowrap",
        flexShrink: 0,
      }}
    >
      {children}
    </span>
  );
}

/**
 * Left sidebar task panel. Replaces the session tree / file explorer for the
 * single-project platform: it shows the task inbox plus the pipeline ledgers.
 */
export function TaskSidebar({ project }: TaskSidebarProps) {
  const cwd = project?.root ?? null;
  const [inbox, setInbox] = useState<InboxItem[]>([]);
  const [runs, setRuns] = useState<PiRunMeta[]>([]);
  const [selectedRun, setSelectedRun] = useState<string | null>(null);
  const [runDetail, setRunDetail] = useState<PiRunLedger | null>(null);
  const [runDetailError, setRunDetailError] = useState(false);
  const [actions, setActions] = useState<ToolAction[]>([]);
  const actionOffsetRef = useRef(0);
  const actionPollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [request, setRequest] = useState("");
  const [submitState, setSubmitState] = useState<"idle" | "busy" | "ok" | "error">("idle");
  const [submitMsg, setSubmitMsg] = useState("");
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const refreshAll = useCallback(async () => {
    if (!cwd) return;
    const q = encodeURIComponent(cwd);
    const [inboxRes, runsRes] = await Promise.all([
      fetch(`/api/pi/inbox?cwd=${q}`),
      fetch(`/api/pi/runs?cwd=${q}`),
    ]);
    if (inboxRes.ok) {
      const d = (await inboxRes.json()) as { items: InboxItem[] };
      setInbox(d.items ?? []);
    }
    if (runsRes.ok) {
      const d = (await runsRes.json()) as { runs: PiRunMeta[] };
      setRuns(d.runs ?? []);
    }
  }, [cwd]);

  useEffect(() => {
    void refreshAll();
    pollRef.current = setInterval(() => void refreshAll(), 5000);
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [refreshAll]);

  useEffect(() => {
    if (!selectedRun || !cwd) {
      setRunDetail(null);
      setRunDetailError(false);
      return;
    }
    let cancelled = false;
    setRunDetailError(false);
    void fetch(`/api/pi/runs/${encodeURIComponent(selectedRun)}?cwd=${encodeURIComponent(cwd)}`)
      .then((r) => {
        if (r.ok) return r.json();
        if (r.status === 404) {
          if (!cancelled) setRunDetailError(true);
          return null;
        }
        throw new Error(`HTTP ${r.status}`);
      })
      .then((d: { run: PiRunLedger } | null) => {
        if (!cancelled) setRunDetail(d?.run ?? null);
      })
      .catch(() => {
        if (!cancelled) setRunDetailError(true);
      });
    return () => {
      cancelled = true;
    };
  }, [selectedRun, cwd]);

  useEffect(() => {
    if (!selectedRun || !cwd) {
      setActions([]);
      actionOffsetRef.current = 0;
      return;
    }
    setActions([]);
    actionOffsetRef.current = 0;
    let cancelled = false;
    const pull = async () => {
      if (cancelled) return;
      try {
        const res = await fetch(`/api/pi/actions?cwd=${encodeURIComponent(cwd)}&name=${encodeURIComponent(selectedRun)}&offset=${actionOffsetRef.current}`);
        if (!res.ok) return;
        const d = (await res.json()) as { events: Record<string, unknown>[]; nextOffset: number };
        if (d.events.length > 0) {
          setActions((prev) => mergeActionEvents(prev, d.events));
          actionOffsetRef.current = d.nextOffset;
        }
      } catch {
        /* transient */
      }
    };
    void pull();
    actionPollRef.current = setInterval(() => void pull(), 2000);
    return () => {
      cancelled = true;
      if (actionPollRef.current) clearInterval(actionPollRef.current);
    };
  }, [selectedRun, cwd]);

  const submit = async () => {
    const text = request.trim();
    if (!text || !cwd || submitState === "busy") return;
    setSubmitState("busy");
    setSubmitMsg("");
    try {
      const res = await fetch("/api/pi/inbox", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cwd, request: text, entry: "feature" }),
      });
      const data = (await res.json()) as { error?: string; name?: string };
      if (!res.ok) throw new Error(data.error ?? `HTTP ${res.status}`);
      setSubmitState("ok");
      setSubmitMsg(`已入队：${data.name}`);
      setRequest("");
      void refreshAll();
    } catch (e) {
      setSubmitState("error");
      setSubmitMsg(e instanceof Error ? e.message : String(e));
    }
  };

  const queuedCount = inbox.filter((i) => i.status === "queued").length;

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", overflow: "hidden" }}>
      <div style={{ padding: "12px 10px 10px", borderBottom: "1px solid var(--border)", flexShrink: 0, display: "flex", alignItems: "center", gap: 8 }}>
        <ConfigStatusDot active color="#16a34a" />
        <span style={{ fontSize: 12, fontWeight: 700, color: "var(--text)", flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {project?.name ?? "任务"}
        </span>
        <span style={{ fontSize: 11, color: "var(--text-dim)", fontFamily: "var(--font-mono)" }}>
          {runs.length} 运行
        </span>
      </div>

      <div style={{ flex: 1, overflow: "auto", padding: 6 }}>
        <ConfigSidebarList>
          <div style={{ fontSize: 11, fontWeight: 600, color: "var(--text-muted)", padding: "6px 8px 4px" }}>
            收件箱{queuedCount > 0 ? ` · ${queuedCount} 等待` : ""}
          </div>
          {inbox.length === 0 && (
            <div className="config-sidebar-message is-empty">无任务</div>
          )}
          {inbox.map((item) => (
            <ConfigSidebarItem
              key={item.id}
              active={selectedRun === item.name}
              onClick={() => setSelectedRun(selectedRun === item.name ? null : item.name)}
            >
              <ConfigStatusDot active={item.status === "running"} color={stageColor(item.status)} />
              <ConfigSidebarText className={`is-grow${item.status === "done" ? " is-muted" : ""}`}>
                {item.name}
              </ConfigSidebarText>
              <Tag color={stageColor(item.status)}>{item.status}</Tag>
            </ConfigSidebarItem>
          ))}

          <div style={{ fontSize: 11, fontWeight: 600, color: "var(--text-muted)", padding: "10px 8px 4px" }}>
            账本
          </div>
          {runs.length === 0 && (
            <div className="config-sidebar-message is-empty">暂无运行</div>
          )}
          {runs.map((run) => (
            <ConfigSidebarItem
              key={run.name}
              active={selectedRun === run.name}
              onClick={() => setSelectedRun(selectedRun === run.name ? null : run.name)}
            >
              <ConfigStatusDot active={run.stage === "implement"} color={stageColor(run.stage)} />
              <ConfigSidebarText className={`is-grow${run.stage === "done" ? " is-muted" : ""}`}>
                {run.name}
              </ConfigSidebarText>
              <Tag color={stageColor(run.stage)}>{run.stage}</Tag>
            </ConfigSidebarItem>
          ))}

          {selectedRun && (
            <div
              style={{
                fontSize: 11,
                color: "var(--text-muted)",
                padding: "6px 10px 8px 34px",
                lineHeight: 1.5,
                marginTop: 6,
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
                <span style={{ fontSize: 11, fontWeight: 700, color: "var(--text)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: 1 }}>{selectedRun}</span>
                {runDetail && <Tag color={stageColor(runDetail.stage)}>{runDetail.stage}</Tag>}
              </div>
              {runDetail && (
                <div>
                  <div>
                    任务 <b>{runDetail.tasks?.length ?? 0}</b> · 完成{" "}
                    <b>{runDetail.tasks?.filter((t) => t.status === "merged").length ?? 0}</b>
                  </div>
                  <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--text-dim)" }}>
                    implement={runDetail.retry?.implement ?? 0} retest={runDetail.retry?.retest_loop ?? 0}
                  </div>
                  {runDetail.events && runDetail.events.length > 0 && (
                    <div style={{ marginTop: 4, display: "flex", flexDirection: "column", gap: 2 }}>
                      {runDetail.events.slice(-3).map((ev, idx) => (
                        <div key={idx} style={{ display: "flex", gap: 6 }}>
                          <span style={{ color: "var(--text-dim)", fontFamily: "var(--font-mono)" }}>
                            {ev.at.slice(11, 19)}
                          </span>
                          <Tag color={stageColor(ev.stage)}>{ev.stage}</Tag>
                          <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{ev.msg}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
              {!runDetail && (
                <div style={{ fontSize: 10, color: "var(--text-dim)", marginBottom: 4 }}>
                  {runDetailError ? "任务已出队（无账本）" : "读取账本…"}
                </div>
              )}

              {actions.length > 0 && (
                <div style={{ marginTop: 6, display: "flex", flexDirection: "column", gap: 3, maxHeight: 240, overflow: "auto" }}>
                  {actions.map((a) => (
                    <div
                      key={a.id}
                      style={{
                        border: "1px solid var(--border)",
                        borderRadius: 6,
                        padding: "4px 6px",
                        display: "flex",
                        flexDirection: "column",
                        gap: 2,
                      }}
                    >
                      <div style={{ display: "flex", gap: 5, alignItems: "center", minWidth: 0 }}>
                        <span
                          style={{
                            fontSize: 9, fontFamily: "var(--font-mono)", color: "#fff", flexShrink: 0,
                            background: a.status === "error" ? "#ef4444" : a.status === "running" ? "#f59e0b" : "#16a34a",
                            borderRadius: 3, padding: "0 4px",
                          }}
                        >
                          {a.status}
                        </span>
                        <span style={{ fontSize: 10, fontWeight: 700, color: "var(--text)", fontFamily: "var(--font-mono)", whiteSpace: "nowrap" }}>{a.toolName}</span>
                        <span style={{ fontSize: 9, color: "var(--text-dim)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: 1, fontFamily: "var(--font-mono)" }} title={a.args}>
                          {a.args}
                        </span>
                      </div>
                      {a.partial && (
                        <div style={{ fontSize: 9, color: "var(--text-muted)", fontFamily: "var(--font-mono)", whiteSpace: "pre-wrap", overflow: "hidden", textOverflow: "ellipsis", maxHeight: 40 }}>{a.partial.slice(0, 200)}</div>
                      )}
                      {a.result && (
                        <div style={{ fontSize: 9, color: a.status === "error" ? "#ef4444" : "var(--text-dim)", fontFamily: "var(--font-mono)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{a.result.slice(0, 160)}</div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </ConfigSidebarList>
      </div>

      <div style={{ flexShrink: 0, padding: "8px 10px 10px", borderTop: "1px solid var(--border)" }}>
        <div style={{ display: "flex", gap: 6, marginBottom: 4 }}>
          <input
            type="text"
            value={request}
            onChange={(e) => setRequest(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") void submit();
            }}
            placeholder="新开发任务…"
            style={{
              flex: 1, minWidth: 0, height: 30, padding: "0 9px",
              border: "1px solid var(--border)", borderRadius: 6,
              background: "var(--bg-panel)", color: "var(--text)", fontSize: 12, outline: "none",
            }}
          />
          <ConfigButton variant="primary" onClick={() => void submit()} disabled={!request.trim() || submitState === "busy"} style={{ height: 30 }}>
            {submitState === "busy" ? "……" : "提交"}
          </ConfigButton>
        </div>
        {submitMsg && (
          <span style={{ fontSize: 10, color: submitState === "error" ? "#ef4444" : "#16a34a" }}>
            {submitMsg}
          </span>
        )}
      </div>
    </div>
  );
}