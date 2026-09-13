import { test, expect } from "bun:test";
import {
	decidePolicy,
	READ_ONLY_ROLES,
	WRITE_ROLES,
} from "/mnt/shared/pi-loop-harness/.pi/extensions/pi-permissions.ts";

const wt = (p: string): { toolName: "write"; input: { path: string } } => ({
	toolName: "write",
	input: { path: p },
});
const bash = (c: string): { toolName: "bash"; input: { command: string } } => ({
	toolName: "bash",
	input: { command: c },
});
const rd = (p: string): { toolName: "read"; input: { path: string } } => ({
	toolName: "read",
	input: { path: p },
});

test("frozen paths are blocked for every role (incl main)", () => {
	expect(decidePolicy("main", wt("framework/glue/interfaces/infra/store.go")).block).toBe(true);
	expect(decidePolicy("main", wt(".pi/spec/disk-monitor.md")).block).toBe(true);
	expect(decidePolicy("implementer", wt("framework/glue/interfaces/business/foo.go")).block).toBe(true);
	expect(decidePolicy("main", wt(".env")).block).toBe(true);
});
test("read-only roles blocked from write/edit anywhere", () => {
	for (const role of READ_ONLY_ROLES) {
		expect(decidePolicy(role, wt("framework/business/hello/greet.go")).block).toBe(true);
		expect(decidePolicy(role, wt(".worktrees/slug/business/foo.go")).block).toBe(true);
	}
});
test("read-only roles allowed read + safe bash + git diff", () => {
	expect(decidePolicy("reviewer", rd("x")).block).toBe(false);
	expect(decidePolicy("reviewer", bash("git -C .worktrees/x diff main...agent/slug --stat")).block).toBe(false);
	expect(decidePolicy("reviewer", bash("go test ./business/...")).block).toBe(false);
	expect(decidePolicy("reviewer", bash("cd .worktrees/x && go test ./...")).block).toBe(false);
});
test("read-only roles blocked from destructive bash", () => {
	expect(decidePolicy("reviewer", bash("rm -rf foo")).block).toBe(true);
	expect(decidePolicy("investigator", bash("git checkout main")).block).toBe(true);
	expect(decidePolicy("reviewer", bash("git push origin agent/x")).block).toBe(true);
});
test("implementer only writes inside worktree", () => {
	for (const role of WRITE_ROLES) {
		expect(decidePolicy(role, wt(".worktrees/t1/business/hello/data.go")).block).toBe(false);
		expect(decidePolicy(role, wt("framework/business/hello/data.go")).block).toBe(true);
	}
});
test("implementer blocked from git main/history ops, allowed worktree-local", () => {
	expect(decidePolicy("implementer", bash("git -C .worktrees/t1 add business/x.go")).block).toBe(false);
	expect(decidePolicy("implementer", bash("git -C .worktrees/t1 commit -m x")).block).toBe(false);
	expect(decidePolicy("implementer", bash("git -C .worktrees/t1 status")).block).toBe(false);
	expect(decidePolicy("implementer", bash("git -C .worktrees/t1 merge main")).block).toBe(true);
	expect(decidePolicy("implementer", bash("git push origin agent/x")).block).toBe(true);
});
test("main minimal restrictions only", () => {
	expect(decidePolicy("main", bash("rm -rf /")).block).toBe(true);
	expect(decidePolicy("main", bash("rm -rf build/")).block).toBe(false);
	expect(decidePolicy("main", bash("git merge --no-ff agent/x")).block).toBe(false);
	expect(decidePolicy("main", wt("framework/business/hello/greet.go")).block).toBe(false);
});