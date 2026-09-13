"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  ConfigButton,
  ConfigDetail,
  ConfigDetailHeader,
  ConfigDetailHeaderInfo,
  ConfigDetailStack,
  ConfigDetailTitle,
  ConfigEmptyState,
  ConfigField,
  ConfigFooter,
  ConfigPanelShell,
  ConfigSectionTitle,
  ConfigSidebar,
  ConfigSidebarGroupLabel,
  ConfigSidebarItem,
  ConfigSidebarList,
  ConfigSidebarText,
  ConfigSplitView,
  ConfigStatusDot,
} from "./SettingsUi";
import { MarkdownBody } from "./MarkdownBody";
import type { PiAgentMeta, PiArtifactKind, PiExtensionMeta, PiRunMeta, PiRunLedger, PiSkillMeta } from "@/lib/pi-platform-types";

type HarnessView = "overview" | "extensions" | "pipeline" | "roles";

const STAGE_STEPS = ["plan", "explore", "spec", "tasks", "implement", "retest", "merge", "smoke"];

const ROLE_SPECS = [
  { name: "planner", label: "规划", stage: "plan", status: "new", writesCode: false, output: "任务书 .pi/plan/<name>.md", desc: "把原始需求煮成可执行任务书：scope 切片 + 验收标准" },
  { name: "investigator", label: "侦察", stage: "explore", status: "existing", writesCode: false, output: "上下文简报 JSON", desc: "只读代码库，产出 findings/hints/risks 压缩简报供实现者直接用" },
  { name: "implementer", label: "实现", stage: "implement", status: "existing", writesCode: true, output: "提交 + 卡片（worktree）", desc: "在隔离 worktree 写代码，回归自检，永不合并" },
  { name: "reviewer", label: "复测", stage: "retest", status: "existing", writesCode: false, output: "VERDICT PASS/FAIL JSON", desc: "对原始需求逐条审 diff，无来源改动直接拒" },
  { name: "merger", label: "合流", stage: "merge", status: "new", writesCode: true, output: "main 合并 + smoke", desc: "PASS 才合回主线，合后跑 smoke，唯一能写 main 的角色" },
  { name: "finish", label: "结账", stage: "done", status: "future", writesCode: false, output: "教训知识入库", desc: "结账本 → 教训写入项目知识库（memorynote，后续工位）" },
] as const;

const ROLE_TOOLS: Record<string, string[]> = {
  planner: ["read", "write", "grep", "find", "ls", "bash"],
  investigator: ["read", "grep", "find", "ls", "bash"],
  implementer: ["read", "write", "edit", "bash", "grep", "find", "ls"],
  reviewer: ["read", "grep", "find", "ls", "bash"],
  merger: ["read", "bash", "grep", "find", "ls"],
  finish: [],
};

const STAGE_COLOR: Record<string, string> = {
  plan: "#6b7280", explore: "#6b7280", spec: "#6b7280", tasks: "#6b7280",
  implement: "#f59e0b", retest: "#f59e0b", merge: "#f59e0b", smoke: "#f59e0b",
  blocked: "#ef4444", done: "#16a34a", unreadable: "#ef4444",
  queued: "#9c9cf5", running: "#f59e0b",
};

function stageColor(stage: string): string {
  return STAGE_COLOR[stage] ?? "#6b7280";
}

function shortenPath(p: string): string {
  return p.replace(/^\/(?:Users|home)\/[^/]+/, "~");
}

interface HarnessData {
  piDir: string;
  agents: PiAgentMeta[];
  skills: PiSkillMeta[];
  extensions: PiExtensionMeta[];
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

async function loadData(cwd: string): Promise<HarnessData> {
  const q = encodeURIComponent(cwd);
  const [agentsRes, skillsRes, extensionsRes] = await Promise.all([
    fetch(`/api/pi/agents?cwd=${q}`),
    fetch(`/api/pi/skills?cwd=${q}`),
    fetch(`/api/pi/extensions?cwd=${q}`),
  ]);
  if (!agentsRes.ok || !skillsRes.ok || !extensionsRes.ok) {
    const err = await agentsRes.json().catch(() => null);
    throw new Error(err?.error ?? "加载失败");
  }
  const [agents, skills, extensions] = await Promise.all([
    agentsRes.json() as Promise<{ piDir: string; agents: PiAgentMeta[] }>,
    skillsRes.json() as Promise<{ skills: PiSkillMeta[] }>,
    extensionsRes.json() as Promise<{ extensions: PiExtensionMeta[] }>,
  ]);
  return { piDir: agents.piDir, agents: agents.agents, skills: skills.skills, extensions: extensions.extensions };
}

async function loadRuns(cwd: string): Promise<PiRunMeta[]> {
  const res = await fetch(`/api/pi/runs?cwd=${encodeURIComponent(cwd)}`);
  if (!res.ok) return [];
  const data = (await res.json()) as { runs: PiRunMeta[] };
  return data.runs;
}

async function loadInbox(cwd: string): Promise<InboxItem[]> {
  const res = await fetch(`/api/pi/inbox?cwd=${encodeURIComponent(cwd)}`);
  if (!res.ok) return [];
  const data = (await res.json()) as { items: InboxItem[] };
  return data.items;
}

async function loadRunDetail(cwd: string, name: string): Promise<PiRunLedger | null> {
  const res = await fetch(`/api/pi/runs/${encodeURIComponent(name)}?cwd=${encodeURIComponent(cwd)}`);
  if (!res.ok) return null;
  const data = (await res.json()) as { run: PiRunLedger };
  return data.run;
}

async function loadArtifact(cwd: string, name: string, kind: PiArtifactKind): Promise<string | null> {
  const res = await fetch(`/api/pi/artifacts?cwd=${encodeURIComponent(cwd)}&kind=${kind}&name=${encodeURIComponent(name)}`);
  if (!res.ok) return null;
  const data = (await res.json()) as { content?: string };
  return data.content ?? null;
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
      }}
    >
      {children}
    </span>
  );
}

function PipelineView({ cwd }: { cwd: string }) {
  const [runs, setRuns] = useState<PiRunMeta[]>([]);
  const [inbox, setInbox] = useState<InboxItem[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [detail, setDetail] = useState<PiRunLedger | null>(null);
  const [artifact, setArtifact] = useState<string | null>(null);
  const [request, setRequest] = useState("");
  const [submitState, setSubmitState] = useState<"idle" | "busy" | "ok" | "error">("idle");
  const [submitMsg, setSubmitMsg] = useState("");
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const refreshAll = useCallback(async () => {
    const [nextRuns, nextInbox] = await Promise.all([loadRuns(cwd), loadInbox(cwd)]);
    setRuns(nextRuns);
    setInbox(nextInbox);
  }, [cwd]);

  useEffect(() => {
    void refreshAll();
    pollRef.current = setInterval(refreshAll, 5000);
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [cwd, refreshAll]);

  useEffect(() => {
    if (!selected) {
      setDetail(null);
      setArtifact(null);
      return;
    }
    void loadRunDetail(cwd, selected).then((d) => setDetail(d));
    setArtifact(null);
  }, [cwd, selected]);

  const submit = async () => {
    const text = request.trim();
    if (!text) return;
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
      await refreshAll();
    } catch (e) {
      setSubmitState("error");
      setSubmitMsg(e instanceof Error ? e.message : String(e));
    }
  };

  const active = runs.find((r) => STAGE_STEPS.slice(0, -1).includes(r.stage));
  const openArtifact = async (kind: PiArtifactKind) => {
    if (!selected) return;
    const content = await loadArtifact(cwd, selected, kind);
    setArtifact(content);
  };

  return (
    <ConfigPanelShell embedded title="流水线" subtitle={shortenPath(cwd)} onClose={() => {}}>
      <ConfigSplitView>
        <ConfigSidebar>
          <div style={{ padding: "10px 12px", borderBottom: "1px solid var(--border)" }}>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>.</div>
          </div>
          <ConfigSidebarList>
            <ConfigSidebarGroupLabel>收件箱</ConfigSidebarGroupLabel>
            {inbox.length === 0 && <div className="config-sidebar-message is-empty">无任务</div>}
            {inbox.map((item) => (
              <ConfigSidebarItem key={item.id} onClick={() => void loadRunDetail(cwd, item.ledger?.split("/").pop()?.replace(".md", "") ?? item.name).then(setDetail)}>
                <ConfigStatusDot active={item.status === "running"} color={stageColor(item.status)} />
                <ConfigSidebarText className={`is-grow${item.status === "done" ? " is-muted" : ""}`}>
                  {item.name}
                </ConfigSidebarText>
                <Tag color={stageColor(item.status)}>{item.status}</Tag>
              </ConfigSidebarItem>
            ))}
            <ConfigSidebarGroupLabel>账本</ConfigSidebarGroupLabel>
            {runs.length === 0 && <div className="config-sidebar-message is-empty">暂无运行</div>}
            {runs.map((run) => (
              <ConfigSidebarItem
                key={run.name}
                active={selected === run.name}
                onClick={() => setSelected(run.name)}
              >
                <ConfigStatusDot active={run.stage === "implement"} color={stageColor(run.stage)} />
                <ConfigSidebarText className={`is-grow${run.stage === "done" ? " is-muted" : ""}`}>
                  {run.name}
                </ConfigSidebarText>
                <Tag color={stageColor(run.stage)}>{run.stage}</Tag>
              </ConfigSidebarItem>
            ))}
          </ConfigSidebarList>
        </ConfigSidebar>

        <ConfigDetail>
          {active && (
            <div style={{ padding: "10px 12px", borderBottom: "1px solid var(--border)" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                <span style={{ fontSize: 12, fontWeight: 700, color: "var(--text)" }}>进行中</span>
                <Tag color={stageColor(active.stage)}>{active.stage}</Tag>
                <span style={{ fontSize: 11, color: "var(--text-dim)" }}>任务 {active.taskDone}/{active.taskCount}</span>
              </div>
              <div style={{ display: "flex", gap: 5, flexWrap: "wrap", alignItems: "center" }}>
                {STAGE_STEPS.map((s, i) => {
                  const reached = STAGE_STEPS.indexOf(active.stage) >= i;
                  const current = active.stage === s;
                  return (
                    <div key={s} style={{ display: "flex", alignItems: "center", gap: 5 }}>
                      <span
                        style={{
                          padding: "4px 9px",
                          borderRadius: 999,
                          border: "1px solid var(--border)",
                          fontSize: 11,
                          whiteSpace: "nowrap",
                          background: current ? "color-mix(in srgb, var(--accent) 25%, var(--bg-panel))" : "var(--bg-panel)",
                          color: reached ? "var(--text)" : "var(--text-dim)",
                          fontWeight: current ? 700 : 500,
                          boxShadow: current ? "0 0 0 2px color-mix(in srgb, var(--accent) 30%, transparent)" : "none",
                        }}
                      >
                        {s}
                      </span>
                      {i < STAGE_STEPS.length - 1 && <span style={{ color: reached ? "var(--text-muted)" : "var(--text-dim)" }}>→</span>}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          <ConfigDetailStack className="is-fill">
            {selected && detail ? (
              <>
                <ConfigDetailHeader>
                  <ConfigDetailHeaderInfo>
                    <ConfigDetailTitle>{detail.name}</ConfigDetailTitle>
                    <Tag color={stageColor(detail.stage)}>{detail.stage}</Tag>
                    <span style={{ fontSize: 11, color: "var(--text-dim)", fontFamily: "var(--font-mono)" }}>
                      implement={detail.retry.implement} retest={detail.retry.retest_loop}
                    </span>
                  </ConfigDetailHeaderInfo>
                </ConfigDetailHeader>
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                  {(["plan", "spec", "tasks", "smoke"] as PiArtifactKind[]).map((k) => (
                    <ConfigButton key={k} size="small" onClick={() => void openArtifact(k)}>
                      {k}
                    </ConfigButton>
                  ))}
                </div>
                {artifact ? (
                  <div style={{ fontSize: 12, maxHeight: 320, overflow: "auto" }}>
                    <MarkdownBody>{artifact}</MarkdownBody>
                  </div>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                    <ConfigSectionTitle>事件审计</ConfigSectionTitle>
                    {detail.events.length === 0 && <div className="config-empty-state">无事件</div>}
                    {detail.events.slice().reverse().map((e, idx) => (
                      <div key={idx} style={{ display: "flex", gap: 8, fontSize: 11, alignItems: "center" }}>
                        <span style={{ color: "var(--text-dim)", fontFamily: "var(--font-mono)", whiteSpace: "nowrap" }}>{e.at.slice(11, 19)}</span>
                        <Tag color={stageColor(e.stage)}>{e.stage}</Tag>
                        <span style={{ color: "var(--text-muted)", flex: 1 }}>{e.msg}</span>
                      </div>
                    ))}
                  </div>
                )}
              </>
            ) : (
              <ConfigEmptyState>选择左侧账本查看详情</ConfigEmptyState>
            )}
          </ConfigDetailStack>
        </ConfigDetail>
      </ConfigSplitView>

      <ConfigFooter status={<span style={{ fontSize: 11, color: "var(--text-dim)" }}>{runs.length} 次运行 · {inbox.filter((i) => i.status === "queued").length} 等待中</span>}>
        <ConfigField label="新开发任务">
          <div style={{ display: "flex", gap: 6 }}>
            <input
              type="text"
              value={request}
              onChange={(e) => setRequest(e.target.value)}
              placeholder="用 0-loop-dispatcher 开发…"
              style={{ flex: 1, minWidth: 200, height: 32, padding: "0 10px", border: "1px solid var(--border)", borderRadius: 6, background: "var(--bg-panel)", color: "var(--text)", fontSize: 12, outline: "none" }}
            />
            <ConfigButton variant="primary" onClick={() => void submit()} disabled={!request.trim() || submitState === "busy"}>
              {submitState === "busy" ? "入队中…" : "提交"}
            </ConfigButton>
          </div>
        </ConfigField>
        {submitMsg && (
          <span style={{ fontSize: 11, color: submitState === "error" ? "#ef4444" : "#16a34a" }}>{submitMsg}</span>
        )}
        <ConfigButton size="small" onClick={() => void refreshAll()}>刷新</ConfigButton>
      </ConfigFooter>
    </ConfigPanelShell>
  );
}

function OverviewView({ cwd }: { cwd: string }) {
  const [data, setData] = useState<HarnessData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedAgent, setExpandedAgent] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    void loadData(cwd).then((next) => {
      if (cancelled) return;
      setData(next);
      setError(null);
    }).catch((e) => {
      if (!cancelled) setError(e instanceof Error ? e.message : String(e));
    }).finally(() => {
      if (!cancelled) setLoading(false);
    });
    return () => { cancelled = true; };
  }, [cwd]);

  if (loading) return <div className="config-empty-state">加载中…</div>;
  if (error) return <div className="config-empty-state" style={{ color: "#ef4444" }}>{error}</div>;
  if (!data) return null;

  return (
    <ConfigPanelShell embedded title="平台总览" subtitle={shortenPath(data.piDir)} onClose={() => {}}>
      <ConfigSplitView>
        <ConfigSidebar>
          <ConfigSidebarList>
            <ConfigSidebarGroupLabel>Agents</ConfigSidebarGroupLabel>
            {data.agents.map((a) => (
              <ConfigSidebarItem key={a.name} active={expandedAgent === a.name} onClick={() => setExpandedAgent(expandedAgent === a.name ? null : a.name)}>
                <ConfigStatusDot active color="#16a34a" />
                <ConfigSidebarText className="is-grow">{a.name}</ConfigSidebarText>
                <span style={{ fontSize: 10, color: "var(--text-dim)" }}>{a.model ?? "default"}</span>
              </ConfigSidebarItem>
            ))}
          </ConfigSidebarList>
        </ConfigSidebar>

        <ConfigDetail>
          <ConfigDetailStack className="is-fill">
            {expandedAgent && data.agents.map((a) => a.name === expandedAgent && (
              <div key={a.name}>
                <ConfigDetailHeader>
                  <ConfigDetailHeaderInfo>
                    <ConfigDetailTitle>{a.name}</ConfigDetailTitle>
                    <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                      {(a.tools ?? []).map((t) => <Tag key={t} color="#6b7280">{t}</Tag>)}
                    </div>
                  </ConfigDetailHeaderInfo>
                </ConfigDetailHeader>
                <div style={{ fontSize: 12, color: "var(--text-muted)", lineHeight: 1.6, marginBottom: 10 }}>{a.description}</div>
                <pre style={{ margin: 0, padding: 10, borderRadius: 6, background: "var(--bg)", border: "1px solid var(--border)", fontSize: 11, lineHeight: 1.55, color: "var(--text-dim)", whiteSpace: "pre-wrap", maxHeight: 280, overflow: "auto" }}>{a.prompt}</pre>
              </div>
            ))}
            {!expandedAgent && <ConfigEmptyState>选择左侧 Agent 查看定义</ConfigEmptyState>}
          </ConfigDetailStack>
        </ConfigDetail>
      </ConfigSplitView>

      <ConfigFooter status={<span style={{ fontSize: 11, color: "var(--text-dim)" }}>{data.agents.length} agents · {data.skills.length} skills · {data.extensions.length} extensions</span>}>
        <ConfigButton size="small" onClick={() => void loadData(cwd).then(setData)}>刷新</ConfigButton>
      </ConfigFooter>
    </ConfigPanelShell>
  );
}

export function HarnessConfig({ cwd, onClose, embedded = false }: { cwd: string; onClose: () => void; embedded?: boolean }) {
  const [view, setView] = useState<HarnessView>("pipeline");
  const rootClassName = embedded ? "config-panel-root is-embedded" : "config-panel-root is-modal";

  return (
    <div
      className={rootClassName}
      style={{ display: "flex", flexDirection: "column", height: "100%" }}
      onClick={(event) => { if (!embedded && event.target === event.currentTarget) onClose(); }}
    >
      <div style={{ display: "flex", gap: 6, padding: "10px 12px", borderBottom: "1px solid var(--border)", alignItems: "center" }}>
        <span style={{ fontSize: 12, fontWeight: 700, color: "var(--text)", marginRight: 4 }}>平台</span>
        {([
          ["pipeline", "流水线"],
          ["roles", "角色"],
          ["overview", "平台总览"],
          ["extensions", "扩展工具"],
        ] as const).map(([key, label]) => (
          <button
            key={key}
            type="button"
            onClick={() => setView(key)}
            style={{
              padding: "6px 12px",
              border: view === key ? "1px solid var(--accent)" : "1px solid var(--border)",
              borderRadius: 7,
              background: view === key ? "color-mix(in srgb, var(--accent) 12%, transparent)" : "var(--bg-panel)",
              color: view === key ? "var(--text)" : "var(--text-muted)",
              fontSize: 12,
              fontWeight: view === key ? 600 : 500,
              cursor: "pointer",
            }}
          >
            {label}
          </button>
        ))}
      </div>
      <div style={{ flex: 1, minHeight: 0, overflow: "auto" }}>
        {view === "pipeline" && <PipelineView cwd={cwd} />}
        {view === "roles" && <RolesView cwd={cwd} />}
        {view === "overview" && <OverviewView cwd={cwd} />}
        {view === "extensions" && <ExtensionsView cwd={cwd} />}
      </div>
    </div>
  );
}

const ROLE_STATUS: Record<string, { label: string; color: string }> = {
  new: { label: "新", color: "#f59e0b" },
  existing: { label: "现有", color: "#16a34a" },
  future: { label: "后续", color: "#6b7280" },
};

function RolesView({ cwd }: { cwd: string }) {
  const [data, setData] = useState<HarnessData | null>(null);

  useEffect(() => {
    let cancelled = false;
    void loadData(cwd).then((next) => {
      if (!cancelled) setData(next);
    });
    return () => { cancelled = true; };
  }, [cwd]);

  if (!data) return <div className="config-empty-state">加载中…</div>;

  return (
    <ConfigPanelShell embedded title="角色" subtitle={shortenPath(data.piDir)} onClose={() => {}}>
      <div style={{ padding: "12px 14px", display: "flex", flexDirection: "column", gap: 8 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <ConfigStatusDot active color="#16a34a" />
          <span style={{ fontSize: 12, fontWeight: 700, color: "var(--text)" }}>主 Agent（调度）</span>
          <span style={{ fontSize: 11, color: "var(--text-dim)" }}>只持节奏 · 只读结果卡 · 只派任务</span>
        </div>
        <div
          style={{
            display: "flex",
            alignItems: "stretch",
            gap: 8,
            flexWrap: "wrap",
            padding: "10px 0 4px",
          }}
        >
          {ROLE_SPECS.map((role, i) => {
            const agent = data.agents.find((a) => a.name === role.name);
            const status = ROLE_STATUS[role.status];
            return (
              <div key={role.name} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <div
                  style={{
                    flex: "0 1 220px",
                    border: "1px solid var(--border)",
                    borderRadius: 10,
                    padding: "10px 12px",
                    background: "var(--bg-panel)",
                    display: "flex",
                    flexDirection: "column",
                    gap: 6,
                    minWidth: 200,
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <span style={{ fontSize: 10, color: "var(--text-dim)", fontFamily: "var(--font-mono)" }}>{i + 1}</span>
                    <span style={{ fontSize: 12, fontWeight: 700, color: "var(--text)", fontFamily: "var(--font-mono)" }}>{role.name}</span>
                    <span
                      style={{
                        fontSize: 9, padding: "1px 6px", borderRadius: 999,
                        background: `color-mix(in srgb, ${status.color} 13%, transparent)`, color: status.color, fontWeight: 600, marginLeft: "auto",
                      }}
                    >
                      {status.label}
                    </span>
                  </div>
                  <div style={{ fontSize: 12, fontWeight: 700, color: "var(--text)" }}>{role.label}</div>
                  <div style={{ fontSize: 11, color: "var(--text-muted)", lineHeight: 1.45 }}>{agent?.description ?? role.desc}</div>
                  <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                    {ROLE_TOOLS[role.name].map((t) => <Tag key={t} color="#6b7280">{t}</Tag>)}
                  </div>
                  <div style={{ fontSize: 10, color: "var(--text-dim)", lineHeight: 1.4 }}>
                    产出 <span style={{ color: "var(--text-muted)", fontFamily: "var(--font-mono)" }}>{role.output}</span>
                  </div>
                  <div style={{ fontSize: 10, display: "flex", gap: 4, alignItems: "center" }}>
                    {role.writesCode ? (
                      <>
                        <ConfigStatusDot active color="#f59e0b" />
                        <span style={{ color: "var(--text-muted)" }}>
                          {role.name === "merger" ? "仅在 PASS 后写 main" : "只写 worktree"}
                        </span>
                      </>
                    ) : (
                      <>
                        <ConfigStatusDot active color="#16a34a" />
                        <span style={{ color: "var(--text-muted)" }}>只读</span>
                      </>
                    )}
                  </div>
                </div>
                {i < ROLE_SPECS.length - 1 && (
                  <div style={{ color: "var(--text-dim)", fontSize: 14, flexShrink: 0 }}>→</div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </ConfigPanelShell>
  );
}

function ExtensionsView({ cwd }: { cwd: string }) {
  const [data, setData] = useState<HarnessData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void loadData(cwd).then((next) => {
      if (!cancelled) setData(next);
    }).catch((e) => {
      if (!cancelled) setError(e instanceof Error ? e.message : String(e));
    });
    return () => { cancelled = true; };
  }, [cwd]);

  if (error) return <div className="config-empty-state" style={{ color: "#ef4444" }}>{error}</div>;
  if (!data) return <div className="config-empty-state">加载中…</div>;

  return (
    <ConfigPanelShell embedded title="扩展工具" subtitle={shortenPath(data.piDir)} onClose={() => {}}>
      <ConfigDetailStack className="is-fill">
        <ConfigSectionTitle>Extensions（.pi/extensions）</ConfigSectionTitle>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {data.extensions.map((e) => (
            <div key={e.name} style={{ border: "1px solid var(--border)", borderRadius: 8, padding: "10px 12px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, justifyContent: "space-between" }}>
                <span style={{ fontWeight: 700, fontSize: 12, color: "var(--text)" }}>{e.name}</span>
                <Tag color={e.entrypoint === "builtin" ? "#16a34a" : "#f59e0b"}>{e.entrypoint}</Tag>
              </div>
              <div style={{ marginTop: 6, display: "flex", gap: 4, flexWrap: "wrap" }}>
                {e.tools.map((t) => <Tag key={t} color="#6b7280">{t}</Tag>)}
              </div>
              <div style={{ marginTop: 6, fontSize: 11, color: "var(--text-dim)", fontFamily: "var(--font-mono)", overflowWrap: "anywhere" }}>{e.path}</div>
            </div>
          ))}
        </div>
        <div style={{ height: 12 }} />
        <ConfigSectionTitle>Skills（入口 + 环节）</ConfigSectionTitle>
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {data.skills.map((s) => (
            <div key={s.path} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12 }}>
              <Tag color={s.category === "entries" ? "#16a34a" : s.disabled ? "#f59e0b" : "#6b7280"}>
                {s.category === "entries" ? "入口" : "环节"}
              </Tag>
              <span style={{ color: "var(--text)", fontWeight: 600 }}>{s.name}</span>
              <span style={{ color: "var(--text-dim)", fontSize: 10, fontFamily: "var(--font-mono)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: 1 }}>{s.description}</span>
            </div>
          ))}
        </div>
      </ConfigDetailStack>
    </ConfigPanelShell>
  );
}