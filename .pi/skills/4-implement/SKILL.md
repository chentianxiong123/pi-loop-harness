---
name: 4-implement
description: "4. 实施：看最初需求 + SPEC，派 implementer（subagent）在隔离 worktree 实现代码并自测，回报 branch/worktree。"
allowed-tools: read subagent
---

# 4. 实施代码

你看最初需求 + 冻结 SPEC，把代码真正写出来。

## 工作流
1. 读 `.pi/spec/<name>.md`（frozen）与其引用的 `.pi/plan/<name>.md`（最初需求）。
2. 派实现：`subagent` mode=single, agent=implementer, agentScope=both,
   task=<SPEC + 需求 + "在隔离 worktree 实现并自测">。
   → implementer 自己 `git worktree add -b agent/<slug> .worktrees/<slug> HEAD`，
   实现、自测、commit，回报 `branch`/`worktree`。
3. 判结果：
   - 回报完整 → 最后一行 `RESULT: IMPLEMENTED branch=<branch> worktree=<worktree>`。
   - 失败/自测不过 → `RESULT: IMPLEMENT_FAIL reason=<...>`，可重派（≤2 次）；仍失败→ `RESULT: BLOCKED`。

## 铁律
- 实现人只管实现，不自审、不合并；复测由 `5-retest` 的另一个 agent（reviewer）做。
- 每一 Accepted Criterion 都要有对应自测或可运行验证。