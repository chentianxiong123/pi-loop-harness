---
name: 0-loop-dispatcher
description: "（总入口/编排）驱动流水线：审问→探索→审查→切片→实施→复测→合并→冒烟回归。贯彻「回归」铁律：动手前先读原始需求；环节2有问题→回归提问回退环节1。全程读写 run-state 账本（.pi/runs/<name>.json），支持断点续跑。"
allowed-tools: read write bash question subagent
---

# 0. Loop Dispatcher（流水线总入口）

完整开发流程的编排器。按顺序驱动环节并处理回退、断点续跑。

## 回归铁律（贯穿全程，先说）
**无论谁来做、在哪个环节、哪个环境，动手前都必须先看一遍用户的原始需求**
（`.pi/plan/<name>.md` 的 `Original Request`），对照当前工作是否在需求边界内，防走偏。
每个环节交接时，都提醒下一环节先回归。

## 账本（run-state，全程必须读写）
- **协议见 `references/run-state.md`**（schema 单一源）。写 `.pi/runs/<name>.json`。
- 环节1 创建账本；每个环节结束时更新 `stage`/`retry`/`tasks`/`events` 再输出 `RESULT:`。
- **断点续跑**：若对话被打断或用户说"继续 <name>"，先读 `.pi/runs/<name>.json` 的 `stage`，从对应环节继续，重试计数从账本取（不凭记忆）。
- **审计**：`events` 只追加不删。

## 编排（严格顺序；<name> 取 .pi/plan/<name>.md）
1. **环节1 · `1-plan-alignment`** → 审问产出 PLAN（含 `Original Request`，frozen）+ 创建账本。
2. **环节2 · `2-explore`** → 按 PLAN 探索可行性。
   - `FEASIBLE` → 继续；
   - `INFEASIBLE` → **回归提问**：回环节1，把 reason/简报带给用户重新对齐，再重走 2。
3. **环节3 · `3-spec-review`** → 审查出 `.pi/spec/<name>.md`（frozen）。
4. **`task-slice`**（环节4首步，独立 skill）→ 把 SPEC 切成任务清单 `.pi/tasks/<name>.md` 并同步生成 `glue/interfaces/` 契约文件（冻结只读）。单任务 feature 只建 1 项；`tasks` 项写进账本。
5. **环节4 · `4-implement`** → 对每项任务逐项派 implementer（隔离 worktree）实现 + 自测，回报 `branch`/`worktree`。**同一项重派上限 2 次** → 仍失败 `BLOCKED`。
6. **环节5 · `5-retest`** → 对**每一项**派另一个 agent（reviewer）逐条核对 diff 到最初需求。
   - 全部 `RETEST_PASS` → 继续；
   - 任一 `RETEST_FAIL` → 退回环节4修复该项，重走 4→5；**4→5 循环上限 2 轮**（加上环节4自身重派：单任务全程至多 4 次实现尝试；多任务按项计数）→ 超限 `BLOCKED`。
7. **环节6 · `6-merge`** → 全部 `RETEST_PASS` 后，全局回归（拼起来回看是否仍在原始需求边界内），无冲突并入主线。
8. **环节7 · `7-smoke`** → `make run` 起服务 + curl 冒烟 + 对照原始需求逐条验收 + **补一组测试**，写 `.pi/smoke/<name>.md`。
   - `SMOKE_PASS` → 完成；`SMOKE_FAIL` → 回环节4 修，重走 4→5→6→7（循环上限 1 轮，超限 BLOCKED）。

## 交互规则
- 每环节先回归（读原始需求）再读前序产出（`.pi/plan/` → `.pi/feasibility/` → `.pi/spec/` → `.pi/tasks/`）。
- 关键抉择点（可行性、复测失败、冒烟失败）用 `question` 工具问用户；非交互则对话说明。
- 全程提示进度（环节名/总数 8 步）。
- **重试记账在账本，不在对话**；超限立即 `stage: blocked` + `RESULT: BLOCKED` 停下交人。
- 同一任务多切片需要并行实施时，`subagent` mode=parallel 派多个 implementer（各用自己的 worktree，文件不重叠）。

## 完成
全部环节走完且 `SMOKE_PASS` → 账本 `stage: done` → `RESULT: PIPELINE_DONE feature=<name>`