---
name: 4-implement
description: "（环节4）实施代码：回归（先读原始需求确认边界）后，派 implementer 在隔离 worktree 实现并自测，回报 branch/worktree。"
allowed-tools: read subagent
---

# 环节4 · 实施代码

把 SPEC 变成代码。

## 回归（前置，必须最先做）
读 `.pi/plan/<name>.md` 的 **`Original Request`** + SPEC + `framework/RULES.md`。
确认：本次要实现的，全部在原始需求与 SPEC 边界内。**不属于需求的任务 → 立即停止，报告主 Agent。**

## 工作流
1. 回归（读原始需求 + SPEC + `framework/RULES.md`）。
2. 派实现：`subagent` mode=single, agent=implementer, agentScope=both,
   task=<SPEC + 原始需求 + "技术栈规则必须遵循 framework/RULES.md，在隔离 worktree 实现并自测">。
   implementer 自己 `git worktree add -b agent/<slug> .worktrees/<slug> HEAD`，
   实现、自测、commit，回报 `branch`/`worktree`。
3. **每次修改后回归**：implementer 每改一处，对照 SPEC/原始需求自查——这条改动是否属于需求的一部分？不属于 → 停止报告。落实在给 implementer 的 task 指令里。
4. 判结果：
   - 完整回报 → `RESULT: IMPLEMENTED branch=<branch> worktree=<worktree>`
   - 失败/自测不过 → `RESULT: IMPLEMENT_FAIL reason=<...>`，重派（≤2 次）；仍失败 → `RESULT: BLOCKED`

## 铁律
- 只实现需求内的事；越界即停。
- 不自审、不合并；复测交给环节5（另一个 agent）。