---
name: 0-loop-dispatcher
description: "（总入口/编排）驱动 6 环节流水线：审问→探索→审查→实施→复测→合并。贯彻「回归」铁律：无论哪环节，动手前先读用户原始需求防走偏；环节2有问题→回归提问回退环节1。"
allowed-tools: read bash question subagent
---

# 0. Loop Dispatcher（流水线总入口）

完整开发流程的编排器。按顺序驱动 6 个环节，并处理环节间回退。

## 回归铁律（贯穿全程，先说）
**无论谁来做、在哪个环节、哪个环境，动手前都必须先看一遍用户的原始需求**
（`.pi/plan/<name>.md` 的 `Original Request`），对照当前工作是否在需求边界内，防走偏。
每个环节交接时，都提醒下一环节先回归。

## 编排（严格顺序）
1. **环节1 · `1-plan-alignment`** → 审问产出 `.pi/plan/<name>.md`（含 `Original Request`，frozen）。
2. **环节2 · `2-explore`** → 按 PLAN 探索可行性。
   - `FEASIBLE` → 继续；
   - `INFEASIBLE` → **回归提问**：回到环节1，把 reason/简报带给用户重新对齐，再重走 2。
3. **环节3 · `3-spec-review`** → 审查出 `.pi/spec/<name>.md`（frozen）。
4. **环节4 · `4-implement`** → 实施 + 自测，拿 `branch`/`worktree`。每轮失败重派，**同一实现重派上限 2 次** → 仍失败 `BLOCKED` 停下交人。
5. **环节5 · `5-retest`** → 另一个 agent 复测。
   - `RETEST_PASS` → 继续；
   - `RETEST_FAIL` → 退回环节4修复，重走 4→5，**4→5 循环上限 2 轮**（连同环节4自身重派，全程至多 4 次实现尝试）→ 仍不过 `VERDICT: FAIL` → `BLOCKED` 停下交人，不再自动回退。
6. **环节6 · `6-merge`** → 全部 `RETEST_PASS` 后，先全局回归再并入主线。

## 交互规则
- 每环节先回归（读原始需求）再读前序产出（`.pi/plan/` → `.pi/feasibility/` → `.pi/spec/`）。
- 关键抉择点（可行性、复测失败处理）用 `question` 工具问用户；非交互则对话说明。
- 全程提示进度（第几环节/总6）。
- **重试记账**：在对话里持续记录环节4重派次数与 4→5 循环轮数。任何超越上限 → 立即 `RESULT: BLOCKED` 停下交人，暂停自动重试。

## 完成
全部环节走完且已合并 → `RESULT: PIPELINE_DONE feature=<name>`