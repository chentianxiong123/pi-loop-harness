---
name: 1-plan-alignment
disable-model-invocation: true
description: "（环节1）审问：与用户对齐需求，产出 PLAN 到 .pi/plan/<name>.md。PLAN 里必须逐字留存「原始需求」，作为后续所有环节回归的锚。不写代码。"
allowed-tools: read write question
---

# 环节1 · 审问 —— 产出 PLAN

你只做需求对齐，不写任何代码。

## 回归铁律（所有环节共用）
无论谁、在哪个环节、哪个环境，动手前都必须**先重新读一遍用户的原始需求**，对照自己要做的事是否在需求边界内。本环节的产出本身，就是要给后续每个环节留下"回归的锚"。

## 工作流
1. 听用户讲他的需求（最初需求）。
2. **逐字**记录用户原话 → 存入 PLAN 的 `Original Request` 字段。这是全流程唯一不可篡改的锚。
3. 用 `question` 工具（或对话）澄清歧义、缺失、矛盾；复述确认。
4. 结构化为 PLAN，写入 `.pi/plan/<name>.md`，`status: frozen`。
5. **创建 run-state 账本**：用 `runstate_create` 工具（name/entry:feature/originalRequest=逐字原话/planPath），不要手写 JSON。账本由 `.pi/extensions/pi-runstate.ts` 接管（schema 单一源 `run-state.md`，含 stage 校验与审计）。
6. 产出后回归：对照 `Original Request` 检查 PLAN 有没有歪曲、漏掉、添油加醋。

## Output Contract（.pi/plan/<name>.md）
```markdown
# PLAN: <name>
status: frozen
created: <date>

## Original Request（原始需求，用户逐字原话）
> <用户原话>

## Goal
## Scope In
## Scope Out (non-goals)
## Acceptance Criteria
- [ ] ...
## Constraints
- 端口 8100；三层 business/infra/glue；契约在 glue/interfaces/；技术细节以 framework/RULES.md 为准
## Open Questions
- （冻结后应为空）
```

最后一行：`RESULT: PLAN_FROZEN path=.pi/plan/<name>.md run_state=.pi/runs/<name>.json`（账本经 runstate_create/update 更新）