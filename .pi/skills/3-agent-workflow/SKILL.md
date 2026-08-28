---
name: 3-agent-workflow
description: "3. 分支开发之一：单任务查改审闭环。读取一个任务切片，用 subagent 工具依次派 investigator → implementer → reviewer，处理 VERDICT，失败按上限重派。仅编排，不直接改码。"
allowed-tools: read subagent
---

# 3. Agent Workflow（单任务查→改→审）

你拿到**一个任务切片** + 对应契约，跑完「查→改→审」闭环。

## 铁律
1. 你只编排，不改码。所有代码改动由 `subagent` 派生的子 agent 在隔离上下文里完成。
2. 调 `subagent` 时必须带 `agentScope: "both"`，否则读不到项目级 `.pi/agents/`。
3. reviewer 的最后一行必须是 `VERDICT: PASS` 或 `VERDICT: FAIL — <原因>`；没有 VERDICT 一律视为 FAIL。

## 工作流（per task）
1. 读任务切片与 `.pi/contracts/<name>.md` 中对应部分。
2. 派查：`subagent` mode=single, agent=investigator, task=<任务+契约片段> → 拿回上下文简报。
3. 派改：`subagent` mode=single, agent=implementer, task=<任务+上下文简报+契约> → implementer 自己 `git worktree add`、实现、commit、回报 `branch`/`worktree`。
4. 派审：`subagent` mode=single, agent=reviewer, task=<branch 路径> → 拿回 VERDICT。
5. 判门：
   - `VERDICT: PASS` → 回报该任务完成，branch 待合并。
   - `VERDICT: FAIL` → 把原因回传给 implementer 重派（最多 2 次）；仍 FAIL 则回报 BLOCKED 并附原因。
6. 最后一行：`RESULT: TASK_DONE task=<id> branch=<branch>` 或 `RESULT: BLOCKED task=<id> reason=<...>`

## 与 4-regression-gate / 5-loop-dispatcher 的接口
- 合并与回归铁律由 `4-regression-gate` 把关，`5-loop-dispatcher` 负责把本任务结果并入主线。
