---
name: 5-retest
description: "（环节5）复测：回归（先读原始需求）后，派另一个 agent（reviewer）拿最初需求逐条核对实现 diff，每一条必须能追溯到最初需求；找不到来源→拒。必须出 VERDICT: PASS/FAIL。"
allowed-tools: read subagent
---

# 环节5 · 复测

**另一个** agent（reviewer，独立于实现者）对实现做最终核对。

## 回归（前置，必须最先做）
读 `.pi/plan/<name>.md` 的 **`Original Request`** + SPEC + `framework/RULES.md`。
复测的唯一准绳是**最初需求**：不是实现者的自述，不是 SPEC 之外的东西。技术准绳是 RULES.md：违反 RULES 的改动等同脱离需求。

## 工作流
1. 回归（读原始需求 + SPEC）。
2. 拿到环节4的 `branch`/`worktree`。
3. 派复测：`subagent` mode=single, agent=reviewer, agentScope=both,
   task=<branch/worktree + 原始需求 + SPEC + "技术准绳 framework/RULES.md"+ "拿最初需求逐条核对 diff：每一条修改必须能追溯到最初需求/SPEC 的某一条；找不到来源的修改 → 拒绝。可跑测试作辅助证据。最后一行必须 VERDICT: PASS 或 VERDICT: FAIL — <原因>">。
4. 判结果：
   - `VERDICT: PASS` → `RESULT: RETEST_PASS branch=<branch>`
   - `VERDICT: FAIL` → `RESULT: RETEST_FAIL branch=<branch> reason=<...>`，退回环节4修复后重走 4→5
5. **循环上限**：4→5 循环累计 **≤2 轮**（全程实现尝试至多 4 次）。第 2 轮仍 `VERDICT: FAIL` → `RESULT: BLOCKED`，停下交人，不再自动回退。

## 铁律
- 复测者只读、不改码；与被测产出者不同视角。
- **找不到需求来源的改动 = 拒**（这是"回归"的硬判，不是主观印象）。
- 全部任务 `RETEST_PASS` 后才允许进入环节6。
- 达到循环上限必须 `BLOCKED` 停下，不许悄悄放行或无限重试。