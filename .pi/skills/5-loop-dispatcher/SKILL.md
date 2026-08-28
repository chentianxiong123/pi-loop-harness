---
name: 5-loop-dispatcher
description: "5. 分支开发之三（总入口）：读冻结 SPEC + 契约，切片成任务，逐个跑 3-agent-workflow 查改审闭环，过 4-regression-gate 后并入主线。这是分支开发流程的统一入口。"
allowed-tools: read bash subagent
---

# 5. Loop Dispatcher（分支开发总入口）

你拿到一个功能（`.pi/spec/<name>.md` + `.pi/contracts/<name>.md`，均 frozen），把它变成可合并的代码。

## 前置检查
- `.pi/spec/<name>.md` 的 `status: frozen`，且 `Open Questions` 为空。
- `.pi/contracts/<name>.md` 的 `status: frozen`。

## 工作流
1. 读 SPEC + 契约，切成任务（一条 Acceptance Criterion / 一个 interface ≈ 一个任务）。列出任务清单。
2. 对每个任务，调用 **`3-agent-workflow`** 跑查→改→审，拿回 `RESULT: TASK_DONE branch=<b>` 或 `RESULT: BLOCKED`。
3. BLOCKED 的任务汇总原因，向用户报告，不私自跳过。
4. 每个 `TASK_DONE` 分支，过 **`4-regression-gate`** 校验：
   - `GATE_PASS` → 并入主线（默认 `main` 或项目约定分支）：
     ```bash
     git merge --no-ff <branch>        # 在仓库根执行，确认 main 当前 HEAD
     ```
   - `GATE_FAIL` → 退回该任务，重新走 `3-agent-workflow`。
5. 全部任务并入后，清理 worktree：`git worktree remove --force .worktrees/<slug>`（若 implementer 未自清）。
6. 最后一行：`RESULT: DISPATCH_DONE feature=<name> merged=<n> blocked=<m>`

## 铁律
1. 你只编排与合并，绝不直接写业务代码；代码由 subagent 派生角色完成。
2. 调 `subagent` 一律 `agentScope: "both"`。
3. 合并前**必须**过 regression-gate；无 gate 不放行。
4. 并行可用 `subagent` mode=parallel 同时派多个独立任务（≤4），但每个仍独立走查改审 + 回归门。
