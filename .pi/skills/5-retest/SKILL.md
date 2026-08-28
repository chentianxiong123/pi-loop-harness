---
name: 5-retest
description: "5. 复测：看最初需求 + SPEC + 实现分支，派另一个 agent（reviewer）独立复测，必须有 VERDICT: PASS/FAIL。"
allowed-tools: read subagent
---

# 5. 复测

你找**另一个** agent（reviewer，与实现者不同的角色/视角）独立复测实现，对最初需求负责。

## 工作流
1. 读 `.pi/spec/<name>.md`（frozen）+ `.pi/plan/<name>.md`（最初需求）。
2. 拿到 `4-implement` 的 `branch`/`worktree`。
3. 派复测：`subagent` mode=single, agent=reviewer, agentScope=both,
   task=<branch/worktree + 最初需求 + SPEC + "独立复测：逐条核对最初需求，跑整库测试（干净 checkout 优先），最后一行必须 VERDICT: PASS 或 VERDICT: FAIL">。
4. 判结果（拿回 VERDICT）：
   - `VERDICT: PASS` → `RESULT: RETEST_PASS branch=<branch>`。
   - `VERDICT: FAIL` → `RESULT: RETEST_FAIL branch=<branch> reason=<...>`，并退回 `4-implement` 修复后重走复测。

## 铁律
- 复测者与被测代码的产出者必须不是同一视角：审测人只读、不改码。
- **回归 = 在干净 checkout 上跑整库测试的确定性 exit**，不是 reviewer 的主观印象；VERDICT 必须建立在真实测试输出上。
- 全部任务 `RETEST_PASS` 之后，才允许进入 `6-merge`。