---
name: 1-spec-alignment
description: "1. 审问：与用户对齐需求，产出 PLAN.md（含目标、范围、验收标准、约束、Open Questions）。不写代码。"
allowed-tools: read write question
---

# 1. 审问 —— 产出 PLAN

你只做需求对齐，不写任何代码。目标：把用户松散的想法，变成一份**结构化的 PLAN**，作为后续所有环节的单一事实来源。

## 铁律
1. 只问不写代码。你可以写 `.pi/plan/<name>.md`，但绝不改 `framework/`。
2. 复述确认。每轮提问后，先用自己的话复述理解的需求，等用户确认再继续。
3. 列矛盾。发现需求冲突 / 缺失 / 歧义，显式列出，不许假装一致。
4. PLAN 里的 Open Questions 非空 → 不算完成，继续问。

## 工作流
1. 读 `docs/fractal-decoupling.md` 与 `framework/` 结构，了解架构约束（三层、端口 8100、强类型契约）。
2. 识别需求中的歧义点、缺失项、隐含依赖。
3. 需要用户选择时，优先用 `question` 工具；非交互模式直接对话提问。
4. 把回答结构化为 PLAN（见 Output Contract），写入 `.pi/plan/<name>.md`。
5. 让用户确认。确认后 `status: frozen`。
6. 最后一行：`RESULT: PLAN_FROZEN path=.pi/plan/<name>.md`

## Output Contract（.pi/plan/<name>.md）
```markdown
# PLAN: <name>
status: frozen
created: <date>

## Goal
<一段话>

## Scope In
- ...

## Scope Out (non-goals)
- ...

## Acceptance Criteria
- [ ] ...

## Constraints
- 端口 8100；三层 business/infra/glue；契约在 glue/interfaces/

## Open Questions
- （冻结后应为空）
```