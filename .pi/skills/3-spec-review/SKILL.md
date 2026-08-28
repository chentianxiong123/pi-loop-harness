---
name: 3-spec-review
description: "3. 审查产出 SPEC：看最初需求（PLAN）+ 当前代码 + 两份产出（PLAN/可行性），审查后给出冻结 SPEC 到 .pi/spec/<name>.md。"
allowed-tools: read write subagent
---

# 3. 审查 —— 产出 SPEC

你综合"最初需求 + 当前代码 + PLAN + 可行性报告"，产出可执行的冻结 SPEC。

## 输入
- 最初需求（记录在 `.pi/plan/<name>.md` 的 Goal/Scope/Acceptance）
- `.pi/plan/<name>.md`（frozen）
- `.pi/feasibility/<name>.md`（feasible）
- 当前代码（`framework/`）现状

## 工作流
1. 读上面全部输入。
2. 对当前代码做针对性审查（可派 `subagent` mode=single, agent=investigator, agentScope=both 补齐细节）。
3. 把需求落成 SPEC：明确每条 Acceptance Criterion 对应的接口/函数/文件位置、验收证据（测试探针）、不变量。
4. 写 `.pi/spec/<name>.md`，`status: frozen`，`source: plan + feasibility`。
5. 最后一行：`RESULT: SPEC_FROZEN path=.pi/spec/<name>.md`

## Output Contract（.pi/spec/<name>.md）
```markdown
# SPEC: <name>
status: frozen
source: .pi/plan/<name>.md, .pi/feasibility/<name>.md

## Requirements Traceability
| Acceptance Criterion | 实现位置 | 验收证据 |
|----------------------|----------|----------|
| AC-1 | business/<name>/… | tests/<name>_test.go … |

## Interface / Contract
- 接口签名（将落在 glue/interfaces/）

## Constraints
- 端口 8100；三层分层；不碰 Scope Out 部分
```

## 铁律
- 审查人不是实现人：SPEC 冻结后，实现由 `4-implement` 的 implementer 完成，审查人不亲自下场改码。