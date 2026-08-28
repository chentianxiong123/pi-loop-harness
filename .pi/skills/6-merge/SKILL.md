---
name: 6-merge
description: "6. 合并：全部任务 RETEST_PASS 后，把实现分支并入主线，清理 worktree。"
allowed-tools: read bash subagent
---

# 6. 合并代码

所有任务都过了复测，现在把结果并入主线。

## 前置检查
- 该 feature 的**所有**任务都已是 `RETEST_PASS`（有 `5-retest` 的判定）。
- 没有任何 `RETEST_FAIL` / `BLOCKED` 未处理项。

## 工作流
1. 逐个合并：在仓库根执行
   ```bash
   git merge --no-ff <branch>        # 默认并入 main（或项目约定分支）
   ```
2. 有冲突 → 停下报告，不强行解决；需要的话派 implementer 修复后重走复测。
3. 合并完成后清理已并入分支的 worktree：
   ```bash
   git worktree remove --force .worktrees/<slug>
   git branch -d <branch>
   ```
4. 最后一行：`RESULT: MERGED feature=<name> branches=<n>`

## 铁律
- 没有 `RETEST_PASS` 的 branch 一律不并。
- 合并动作只由本环节执行，前面的环节只产出不并。