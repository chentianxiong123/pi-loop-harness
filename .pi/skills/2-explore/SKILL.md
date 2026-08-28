---
name: 2-explore
description: "2. 探索可行性：根据 PLAN 派 investigator（subagent）探索代码库，判断可行性。可行→报告注意点进入下一步；不可行→回归回到 1-审问。"
allowed-tools: read subagent
---

# 2. 探索可行性

你拿着冻结的 PLAN，确认这件事能不能在现有代码上做出来。

## 铁律
1. 只读探索，不改码。所有探查由 `subagent` 派生的 investigator 在隔离上下文完成。
2. 调 `subagent` 必须带 `agentScope: "both"`。
3. 可行性不过 → 必须显式回归回 `1-spec-alignment`（附 reason），不许硬往下走。

## 工作流
1. 读 `.pi/plan/<name>.md`（frozen）。
2. 派探查：`subagent` mode=single, agent=investigator, agentScope=both,
   task=<PLAN + "评估可行性：现有代码是否支持？缺口在哪？风险点？">
   → 拿回上下文简报 + 风险。
3. 判定：
   - **可行** → 写 `.pi/feasibility/<name>.md`（含：结论 feasible + 注意点/风险清单 + 实现要点），最后一行 `RESULT: FEASIBLE path=.pi/feasibility/<name>.md`。
   - **不可行 / 缺口巨大** → 不写可行性文件，最后一行 `RESULT: INFEASIBLE reason=<...>`，并指示回到 `1-spec-alignment` 重新对齐（可附 investigator 简报作为输入）。

## 与下游的接口
- 可行的 `.pi/feasibility/<name>.md` 交给 `3-spec-review` 作为审查输入之一。
- 「回归提问」就发生在这里：stage 2 发现有硬伤 → 踢回 stage 1。