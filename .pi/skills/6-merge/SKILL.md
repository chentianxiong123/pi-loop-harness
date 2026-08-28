---
name: 6-merge
description: "（环节6）合并：全部任务 RETEST_PASS 后，回归（先读原始需求）做全局确认没跑偏，再逐个并入主线，清理 worktree，并核对契约文件最终形态。"
allowed-tools: read write bash subagent
---

# 环节6 · 合并代码

所有任务都过复测，现在逐个并入主线。

## 回归（前置，必须最先做）
读 `.pi/plan/<name>.md` 的 **`Original Request`** + 账本 `.pi/runs/<name>.json`。
做**全局回归**：把这一 feature 的所有改动拼起来，回看是否仍然落在最初需求边界内、有没有整体跑偏。
**跑偏 → 停下报告，不许合并。**

## 前置检查
- 账本存在，`stage: retest`；该 feature **所有**任务都是 `status: retested`；无 `pending`/`blocked`。
- 逐一存在对应 `branch`/`worktree`，契约文件（`glue/interfaces/**`）实现期未被动（可 `git diff` 核对）。

## 工作流
1. 回归 + 前置检查。
2. 逐个合并（仓库根，先确认在 `main` 或约定分支）：
   ```bash
   git switch main
   git merge --no-ff <branch>
   ```
   每并完一个，账本该任务 `status: merged`，`events` 追加"MERGED t<id>"。
3. 冲突 → 停下报告；必要时派 implementer 修复后重走复测。
4. 全部并完、契约文件现状与 task-slice 产物一致后，清理已并入分支的 worktree：
   ```bash
   git worktree remove --force .worktrees/<slug>
   git branch -d <branch>
   ```
5. 更新账本 `stage: merge`，`events` 追加"ALL_MERGED"。
6. 末行：`RESULT: MERGED feature=<name> branches=<n> run_state=.pi/runs/<name>.json`

## 铁律
- 无 `RETEST_PASS` 不并；全局回归没跑偏才并；账本未对齐不并。
- 合并动作只在本环节做；合并完成后交给环节7 冒烟。