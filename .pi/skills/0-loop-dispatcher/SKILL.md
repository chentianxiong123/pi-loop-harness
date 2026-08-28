---
name: 0-loop-dispatcher
description: "0. 总入口/编排：跑完整 6 环节流水线（审问→探索→审查→实施→复测→合并），处理 2 环节的回归提问回退。收到一个功能请求后从此入口开始。"
allowed-tools: read bash question subagent
---

# 0. Loop Dispatcher（流水线总入口）

这是完整开发流程的编排器。你按顺序驱动 6 个环节，并负责环节间的衔接与回退。

## 编排（严格顺序）
1. **`1-spec-alignment`** — 审问用户，产出 `.pi/plan/<name>.md`（frozen）。
2. **`2-explore`** — 基于 PLAN 探索可行性。
   - `FEASIBLE` → 继续；
   - `INFEASIBLE` → **回归提问**：回到环节 1，把 reason/简报带回给用户重新对齐，再重走 2。
3. **`3-spec-review`** — 审查产出 `.pi/spec/<name>.md`（frozen）。
4. **`4-implement`** — 实施代码 + 自测，拿 `branch`/`worktree`。
5. **`5-retest`** — 另一个 agent 独立复测。
   - `RETEST_PASS` → 继续；
   - `RETEST_FAIL` → 退回环节 4 修复，重走 4→5。
6. **`6-merge`** — 全部 `RETEST_PASS` 后并入主线。

## 交互规则
- 每个环节先读前序产出（`.pi/plan/` → `.pi/feasibility/` → `.pi/spec/`），不凭空进行。
- 关键抉择点（可行性判断、复测失败多轮）用 `question` 工具问用户；非交互则对话说明。
- 全程提示当前到第几环节/几分之几，让用户知道进度。

## 完成
- 全部环节走完且已合并 → `RESULT: PIPELINE_DONE feature=<name>`