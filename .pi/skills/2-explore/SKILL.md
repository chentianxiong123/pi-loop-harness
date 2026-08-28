---
name: 2-explore
description: "（环节2）探索可行性：回归（先读原始需求）后，派 investigator 根据 PLAN 探索当前代码是否支持。可行→报告注意点写 .pi/feasibility/；有问题→回归提问（附 reason 回到环节1）。"
allowed-tools: read subagent
---

# 环节2 · 探索可行性

拿 PLAN 探明：这件事在现有代码上能不能做出来？

## 回归（前置，必须最先做）
先读 `.pi/plan/<name>.md` 的 **`Original Request`**（用户原始需求）与 `Goal/Scope`。
确认：本次探索要探的，确实落在原始需求边界内。边界外的探索直接停。
同时读 `framework/RULES.md`（技术栈规则：Go/htmx/SQLite），作为评估"现有代码是否支持"的技术准绳。

## 工作流
1. 回归完成（读原始需求 + PLAN + `framework/RULES.md`）。
2. 派探查：`subagent` mode=single, agent=investigator, agentScope=both,
   task=<"评估可行性：现有 framework/ 代码是否支持？缺口？风险点？"+ 原始需求与 PLAN + "技术准绳见 framework/RULES.md">。
3. 判定：
   - **可行** → 写 `.pi/feasibility/<name>.md`（结论 feasible + **注意点/风险清单** + 实现要点），产出后再回归对一遍原始需求没跑偏。末行 `RESULT: FEASIBLE path=.pi/feasibility/<name>.md`。
   - **有问题** → **回归提问**：不写可行性文件，`RESULT: INFEASIBLE reason=<...>`，并带 reason 回到 **环节1** 重新与用户对齐需求。

## 铁律
- 不在原始需求边界内的探索，禁止。
- 有问题就回退，不许硬闯；回退时把原因带给环节1。