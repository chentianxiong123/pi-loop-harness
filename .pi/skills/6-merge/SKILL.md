---
name: 6-merge
description: "（环节6）合并：全部任务 RETEST_PASS 后，回归（先读原始需求）做全局确认没跑偏，再并入主线，清理 worktree。"
allowed-tools: read bash subagent
---

# 环节6 · 合并代码

所有任务都过复测，现在并入主线。

## 回归（前置，必须最先做）
读 `.pi/plan/<name>.md` 的 **`Original Request`**。
做**全局回归**：把这一 feature 的所有改动拼起来，回看是否仍然落在最初需求边界内、有没有整体跑偏。
**跑偏 → 停下报告，不许合并。**

## 前置检查
- 该 feature **所有**任务都是 `RETEST_PASS`；无未处理 `RETEST_FAIL` / `BLOCKED`。

## 工作流
1. 回归 + 前置检查。
2. 逐个合并（仓库根，先确认在 `main` 或约定分支）：
   ```bash
   git switch main
   git merge --no-ff <branch>
   ```
3. 冲突 → 停下报告；必要时派 implementer 修复后重走复测。
4. 清理已并入分支的 worktree：
   ```bash
   git worktree remove --force .worktrees/<slug>
   git branch -d <branch>
   ```
5. 末行：`RESULT: MERGED feature=<name> branches=<n>`

## 铁律
- 无 `RETEST_PASS` 不并；全局回归没跑偏才并。
- 合并动作只在本环节做。