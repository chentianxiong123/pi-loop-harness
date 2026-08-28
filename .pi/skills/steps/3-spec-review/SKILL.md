---
name: 3-spec-review
disable-model-invocation: true
description: "（环节3）审查出 SPEC：回归（先读原始需求）后，看最初需求 + 审查当前代码，结合前两份产出（PLAN、可行性报告），给出冻结 SPEC 到 .pi/spec/<name>.md。"
allowed-tools: read write subagent
---

# 环节3 · 审查 —— 给出 SPEC

综合「原始需求 + 当前代码 + PLAN + 可行性报告」，产出可执行的冻结 SPEC。

## 输入（按顺序读齐）
1. 原始需求（`.pi/plan/<name>.md` 的 `Original Request`）
2. `.pi/plan/<name>.md`（frozen）
3. `.pi/feasibility/<name>.md`（feasible）
4. 当前代码（`framework/` 现状）
5. `framework/RULES.md`（技术栈规则，SPEC 的 Constraints 据此写）
6. 账本 `.pi/runs/<name>.json`（确认 `stage: explore`；缺失则 `RESULT: NO_RUN_STATE`）

## 回归（前置，必须最先做）
先读 `Original Request`。确认：接下来要把内容落到 SPEC 里的事，全部在原始需求范围内。
**SPEC 里的每一条，都必须能追溯到最初需求的某一条**；追不到的不许进 SPEC。

## 工作流
1. 回归 + 读齐输入。
2. 对当前代码做针对性审查（可派 investigator 补细节）。
3. 产出 SPEC：每一条 Acceptance Criterion 对应到最初需求的条目 + 实现位置 + 验收证据。
4. 写 `.pi/spec/<name>.md`，`status: frozen`。
5. 产出后回归：回查 SPEC 每条是否都能追溯到 `Original Request`。漏/偏 → 改到对齐为止。
6. 更新账本：`stage: spec`，`events` 追加"SPEC_FROZEN"。

## Output Contract（.pi/spec/<name>.md）
```markdown
# SPEC: <name>
status: frozen
source: .pi/plan/<name>.md, .pi/feasibility/<name>.md

## Requirements Traceability（每条必须追溯到最初需求）
| 最初需求条目 | Acceptance Criterion | 实现位置 | 验收证据 |
|---|---|---|---|
## Interface / Contract
## Constraints
```

末行：`RESULT: SPEC_FROZEN path=.pi/spec/<name>.md run_state=.pi/runs/<name>.json`