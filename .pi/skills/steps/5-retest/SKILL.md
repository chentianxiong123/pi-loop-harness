---
name: 5-retest
disable-model-invocation: true
description: "（环节5）复测：回归（先读原始需求）后，对每个任务派另一个 agent（reviewer）拿最初需求逐条核对实现 diff，每一条必须能追溯到最初需求；找不到来源→拒。必须出 VERDICT: PASS/FAIL。"
allowed-tools: read write subagent
---

# 环节5 · 复测

**另一个** agent（reviewer，独立于实现者）对每个任务的实现做最终核对。

## 回归（前置，必须最先做）
读 `.pi/plan/<name>.md` 的 **`Original Request`** + SPEC + `framework/RULES.md` + 账本 `.pi/runs/<name>.json`（确认 `stage: implement`，读到实现期填好的 `branch`/`worktree`）。
复测的唯一准绳是**最初需求**：不是实现者的自述，不是 SPEC 之外的东西。技术准绳是 RULES.md：违反 RULES 的改动等同脱离需求。

## 工作流
1. 回归（读原始需求 + SPEC + 账本）。
2. 对账本里每项 `status: implemented` 的任务派复测：`subagent` mode=single, agent=reviewer, agentScope=both,
   task=<branch/worktree + 原始需求 + SPEC 对应条目 + 该任务切片（scope/ctr）+ "技术准绳 framework/RULES.md"+ "拿最初需求逐条核对 diff：每一条修改必须能追溯到最初需求/SPEC 的某一条；找不到来源的修改 → 拒绝。契约文件改动也拒绝（契约冻结）。可跑测试作辅助证据。最后一行必须 VERDICT: PASS 或 VERDICT: FAIL — <原因>">。
3. 判每项结果：
   - `VERDICT: PASS` → 账本该任务 `status: retested`，`RESULT: RETEST_PASS branch=<branch>`
   - `VERDICT: FAIL` → 账本 `status: pending`（退回），`RESULT: RETEST_FAIL branch=<branch> reason=<...>`，退回环节4修复后重走 4→5
4. **循环上限**：4→5 循环累计 **≤2 轮**（账本 `retry.retest_loop` 记账；全程实现尝试至多 4 次）。第 2 轮仍 `VERDICT: FAIL` → `RESULT: BLOCKED`，停下交人，不再自动回退。

## 铁律
- 复测者只读、不改码；与被测产出者不同视角。
- **找不到需求来源的改动 = 拒**；**契约文件被改 = 拒**。
- 全部任务 `RETEST_PASS`（账本全 `retested`）后才允许进入环节6（task-slice 生成的契约文件复测时一并核对「实现与契约一致、契约未被动」）。
- 达到循环上限必须 `BLOCKED` 停下，不许悄悄放行或无限重试。
- 每项结束时更新账本 `events`。