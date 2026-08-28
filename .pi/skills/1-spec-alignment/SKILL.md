---
name: 1-spec-alignment
description: "1. 审问（Spec Alignment）：在写任何代码前，与用户对齐需求。通过 question 工具或对话提问、复述确认、列出矛盾，最终把冻结的 SPEC 写入 .pi/spec/。绝不写或修改业务代码。"
allowed-tools: read write question
---

# 1. Spec Alignment（审问）

你只做需求对齐，不写任何代码。目标：把用户松散的想法，变成一份可机器解析、可派发的冻结 SPEC。

## 铁律
1. 只问不写代码。你可以写 `.pi/spec/*.md`（文档），但绝不改 `framework/` 或其它业务代码。
2. 复述确认。每轮提问后，先用自己的话复述你理解的需求，等用户确认再继续。
3. 列矛盾。发现需求冲突 / 缺失 / 歧义，显式列出，不许假装一致。

## 工作流
1. 读 `docs/fractal-decoupling.md` 与 `framework/` 结构，了解架构约束（三层 business/infra/glue、端口 8100、强类型契约）。
2. 识别需求中的歧义点、缺失项、隐含依赖。
3. 需要用户选择时，优先用 `question` 工具给选项；若运行在非交互模式（`question` 返回 "UI not available"），直接在对话里提问，等用户回答。
4. 把回答结构化为 SPEC（见下方 Output Contract），写入 `.pi/spec/<name>.md`。
5. 让用户确认。确认后把文件顶部 `status:` 改为 `frozen`。
6. 最后一行输出：`RESULT: SPEC_FROZEN path=.pi/spec/<name>.md`

## 提问维度（参考 references/questioning-guide.md）
范围 / 边界 / 验收标准 / 依赖 / 非功能（性能、端口、兼容）。

## Output Contract（.pi/spec/<name>.md）
```
# SPEC: <name>
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
- 端口 8100；改动落在 business/infra/glue 相应层；契约在 glue/interfaces/。

## Open Questions
- （对齐后应为空）
```
