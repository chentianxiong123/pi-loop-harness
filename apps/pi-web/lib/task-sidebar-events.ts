export interface ToolAction {
  id: string;
  toolName: string;
  args: string;
  partial: string;
  result: string;
  status: "running" | "done" | "error";
  order: number;
}

function extractToolCall(event: Record<string, unknown>): { id: string; toolName: string; args: string } | null {
  if (event.type !== "toolcall_start" && event.type !== "tool_execution_start") return null;
  const id = (event.toolCallId ?? event.id) as string | undefined;
  const toolName = (event.toolName ?? "") as string;
  let args = "";
  if (typeof event.args === "string") args = event.args;
  else if (typeof event.args === "object" && event.args !== null) {
    try {
      const obj = JSON.parse(JSON.stringify(event.args)) as Record<string, unknown>;
      const file = typeof obj.filePath === "string" ? obj.filePath : typeof obj.path === "string" ? obj.path : "";
      const command = typeof obj.command === "string" ? obj.command : "";
      args = file || command || JSON.stringify(obj).slice(0, 120);
    } catch {
      args = JSON.stringify(event.args).slice(0, 120);
    }
  }
  return id && toolName ? { id, toolName, args } : null;
}

export function mergeActionEvents(prev: ToolAction[], events: Record<string, unknown>[]): ToolAction[] {
  const next = [...prev];
  const orderRef = { n: prev.reduce((m, a) => Math.max(m, a.order), 0) };
  const byId = new Map(prev.map((a) => [a.id, a]));
  for (const ev of events) {
    const call = extractToolCall(ev);
    if (call) {
      const existing = byId.get(call.id);
      if (existing) existing.args = call.args;
      else {
        const entry: ToolAction = { ...call, partial: "", result: "", status: "running", order: ++orderRef.n };
        byId.set(entry.id, entry);
        next.push(entry);
      }
      continue;
    }
    const id = (ev.toolCallId ?? ev.id) as string | undefined;
    const toolName = (ev.toolName ?? ev.name ?? "") as string;
    if (!id || !toolName) continue;
    const entry = byId.get(id);
    if (ev.type === "tool_execution_update" || ev.type === "toolcall_delta" || ev.type === "message_update") {
      if (entry) {
        const partial = (ev.partialResult ?? (ev.partial as Record<string, unknown> | undefined)?.text) as string | undefined;
        if (typeof partial === "string") entry.partial += partial;
        else if (ev.partialResult !== undefined) entry.partial += JSON.stringify(ev.partialResult);
      }
      continue;
    }
    if (ev.type === "tool_execution_end" || ev.type === "toolcall_end") {
      if (entry) {
        entry.status = Boolean(ev.isError) ? "error" : "done";
        const result = ev.result;
        if (typeof result === "string") entry.result = result.slice(0, 200);
        else if (result !== undefined) entry.result = JSON.stringify(result).slice(0, 200);
      }
      continue;
    }
  }
  return [...next];
}