---
name: task-slice
disable-model-invocation: true
description: "（环节4首步）把冻结 SPEC 切成任务清单写 .pi/tasks/<name>.md，每个任务=一个隔离 worktree + 非重叠文件集，并同步生成 glue/interfaces/ 契约文件（冻结只读）。回归：先读原始需求。"
allowed-tools: read write bash subagent
---

# 环节4首步 · 任务切片 + 契约生成

把冻结 SPEC 切成可由多个 implementer 并行开发的任务清单，并生成契约。它是文档与代码之间的桥。

## 回归（前置，必须最先做）
读 `.pi/plan/<name>.md` 的 **`Original Request`** + SPEC（`.pi/spec/<name>.md`）+ `framework/RULES.md`。
确认：被切的任务集合恰好覆盖原始需求边界，不越界不漏项。

## 输入
1. `.pi/plan/<name>.md`（frozen，尤其 `Original Request`）
2. `.pi/spec/<name>.md`（frozen）
3. run-state 账本 `.pi/runs/<name>.json`（读完更新）

## 工作流
1. 回归 + 读齐输入。
2. 核对账本是否存在；无则 `RESULT: NO_RUN_STATE`。
3. 读 SPEC 的 `Requirements Traceability` 表，把每条 Acceptance Criterion 归并成任务。
4. **切片规则**：
   - 每个任务 = 一个隔离 worktree（`agent/<slug>`），文件集**互不重叠**（尤其 `glue/assembly/` 路由注册点只归一个任务）。
   - 改动面优先按三层切（纯 business 改动 / glue 契约 / infra 持久化与模板 / assembly 路由），避免撞车。
   - 契约文件（`glue/interfaces/**`）只由本环节生成，是只读锚；implementation 不得改契约。
5. **生成契约**：依 SPEC 的 `Interface / Contract` 段，为每项任务产出 `glue/interfaces/` 下对应 .go（只声明形状），并加编译期锚（如 `var _ = Type{}`）。契约对齐 SPEC，不写实现。
6. 写 `.pi/tasks/<name>.md`（见下），并把每项任务 `id/criterion/scope/ctr/branch` 同步进账本 `tasks[]`（`status: pending`）。
7. 产出后回归：回看任务并集 ⊆ 原始需求、契约形状 = 前序产出，无跑偏。

## Output Contract（.pi/tasks/<name>.md）
```markdown
# Tasks: <name>
base_plan: .pi/plan/<name>.md
base_spec: .pi/spec/<name>.md

## Task t1
- criterion: <SPEC 的某条 AC 或最初需求条目>
- scope: [business/foo, glue/interfaces/business/foo.go, ...]
- ctr: [glue/interfaces/business/foo.go]   （只读）
- worktree: .worktrees/<slug>
- branch: agent/<slug>
```

## 更新账本
`stage: tasks`，`tasks[]` 全 `pending`，`events` 追加"TASKS_SLICED"。

末行：`RESULT: TASKS_SLICED path=.pi/tasks/<name>.md`