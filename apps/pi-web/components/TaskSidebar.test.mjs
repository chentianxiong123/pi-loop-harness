import { test } from "node:test";
import assert from "node:assert/strict";
import { mergeActionEvents } from "../lib/task-sidebar-events.ts";

test("event stream: start/update/end aggregate into one tool card", () => {
  const start = { type: "tool_execution_start", toolCallId: "t1", toolName: "read", args: { filePath: "a.go" } };
  const update = { type: "tool_execution_update", toolCallId: "t1", toolName: "read", partialResult: "# Rules" };
  const end = { type: "tool_execution_end", toolCallId: "t1", toolName: "read", result: "# Rules done", isError: false };

  let actions = mergeActionEvents([], [start]);
  assert.equal(actions.length, 1);
  assert.equal(actions[0].toolName, "read");
  assert.equal(actions[0].args, "a.go");
  assert.equal(actions[0].status, "running");

  actions = mergeActionEvents(actions, [update]);
  assert.equal(actions[0].partial, "# Rules");

  actions = mergeActionEvents(actions, [end]);
  assert.equal(actions[0].status, "done");
  assert.equal(actions[0].result, "# Rules done");
  assert.equal(actions.length, 1);
});

test("event stream: bash args surface the raw command", () => {
  const start = { type: "tool_execution_start", toolCallId: "t2", toolName: "bash", args: { command: "git worktree add -b agent/x .worktrees/x" } };
  const actions = mergeActionEvents([], [start]);
  assert.equal(actions[0].args, "git worktree add -b agent/x .worktrees/x");
});

test("event stream: error result flips status to error", () => {
  const start = { type: "tool_execution_start", toolCallId: "t3", toolName: "bash", args: { command: "go test" } };
  const end = { type: "tool_execution_end", toolCallId: "t3", toolName: "bash", result: "FAIL", isError: true };
  const actions = mergeActionEvents(mergeActionEvents([], [start]), [end]);
  assert.equal(actions[0].status, "error");
});

test("event stream: later calls append in order and keep order numbers", () => {
  const a = { type: "tool_execution_start", toolCallId: "t1", toolName: "read", args: { filePath: "a.go" } };
  const b = { type: "tool_execution_start", toolCallId: "t2", toolName: "bash", args: { command: "go vet" } };
  const actions = mergeActionEvents(mergeActionEvents([], [a]), [b]);
  assert.equal(actions.length, 2);
  assert.equal(actions[0].order, 1);
  assert.equal(actions[1].order, 2);
});

test("event stream: irrelevant events are ignored", () => {
  const noise = { type: "message_update", toolCallId: "t9", toolName: "nope", partial: { text: "x" } };
  const actions = mergeActionEvents([], [noise]);
  assert.equal(actions.length, 0);
});

test("event stream: start then update to existing card keeps single entry", () => {
  const start = { type: "tool_execution_start", toolCallId: "t4", toolName: "write", args: { filePath: "b.go" } };
  const update = { type: "tool_execution_update", toolCallId: "t4", toolName: "write", partialResult: "partial text" };
  const actions = mergeActionEvents(mergeActionEvents([], [start]), [update]);
  assert.equal(actions.length, 1);
  assert.equal(actions[0].partial, "partial text");
});