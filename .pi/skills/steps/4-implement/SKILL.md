---
name: 4-implement
disable-model-invocation: true
description: "（环节4）实施代码：回归（先读原始需求确认边界）后，对 task-slice 的每项任务派 implementer 在隔离 worktree 实现并自测，回报 branch/worktree。"
allowed-tools: read write subagent
---

# 环节4 · 实施代码

把 `.pi/tasks/<name>.md` 的每个任务变成代码。

## 回归（前置，必须最先做）
读 `.pi/plan/<name>.md` 的 **`Original Request`** + SPEC + `framework/RULES.md` + 账本（`runstate_get`，name=<name>, expectStage=tasks，读到 tasks[]）。
确认：本次要实现的，全部在原始需求与 SPEC 边界内。**不属于需求的任务 → 立即停止，报告主 Agent。**

## 工作流
1. 回归（读原始需求 + SPEC + `framework/RULES.md` + `runstate_get` 的 tasks）。
2. 对账本里每项 `status: pending` 的任务：
   - 派实现：`subagent` mode=single, agent=implementer, agentScope=both,
     task=<该任务切片（criterion/scope/ctr 契约只读）+ 原始需求 + SPEC 对应条目 + "技术栈规则必须遵循 framework/RULES.md；契约 .go 在 glue/interfaces/ 只读不可改（权限门会硬拦截越界写）；在隔离 worktree 实现并自测，自测通过再 commit；注意：bash 每次调用是新进程 cd 不持久，git 一律用 git -C .worktrees/<slug>，读改文件路径以仓库根为基准带 .worktrees/<slug>/ 前缀">。
   - implementer 自己 `git worktree add -b agent/<slug> .worktrees/<slug> HEAD`，实现、自测、commit，回报 `branch`/`worktree`。
   - 多任务可 `subagent` mode=parallel 并发（各用自己的 worktree，文件不重叠）。
   - **权限门提示**：implementer 子进程带 PI_SUBAGENT_ROLE=implementer，越界写（非 .worktrees/）与改契约会被硬拦截并报错——遇到拦截说明越界，改回 worktree 内。
3. **每次修改后回归**：implementer 每改一处，对照 SPEC/原始需求自查——这条改动是否属于需求的一部分？不属于 → 停止报告。落实在给 implementer 的 task 指令里。
4. 判每项结果：
   - 完整回报 → `runstate_update`（taskStatus: {id, status: implemented, branch, worktree}, event="IMPLEMENTED t<id>"），最终 `RESULT: IMPLEMENTED branch=<branch> worktree=<worktree>`
   - 失败/自测不过 → `RESULT: IMPLEMENT_FAIL reason=<...>`，该项重派（**≤2 次**，`runstate_update` retry.implement 记账）；仍失败 → `RESULT: BLOCKED`。

## 铁律
- 只实现任务切片内的事；越界即停。契约文件 `glue/interfaces/**` 只读，一概不改。
- 不自审、不合并；复测交给环节5（另一个 agent）。
- **重派上限 2 次**（账本记账）：超限即 `BLOCKED`，停下交给主 agent（不再自动重试）。