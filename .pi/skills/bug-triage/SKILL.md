---
name: bug-triage
description: "（bug 入口，平级于 0-loop）症状驱动的缺陷工作流：采集症状→复现→根因→修复（隔离 worktree）→回归→合并→冒烟。回归铁律：每阶段先读「原始 bug 报告」防跑偏。全程读写 run-state 账本。"
allowed-tools: read write bash question subagent
---

# Bug Triage（缺陷流水线）

面向 **bug** 的入口，与 feature 的 0-loop 平级。核心区别：起点是**症状**而非需求，每个阶段都对照"原始 bug 报告"回归，绝不在修 bug 途中顺手加功能。

## 回归（前置，必须最先做）
把用户报告的 bug **逐字**记为 `Original Bug Report`，写进 `.pi/plan/<name>.md`（type: bug）+ 账本（`entry: bug`）。
之后每个阶段动手前都先读它：修的是"报告里的问题"，不是别的。

## 工作流
1. **症状采集**：逐字记 bug 报告 → `.pi/plan/<name>.md`(`Original Bug Report`)，创建账本 `.pi/runs/<name>.json`（`entry: bug`）。
2. **复现**：`make run`，按报告步骤复现；**先复现再动手改**。复现不了 → 回问用户要更细步骤（question/对话），不硬猜。
3. **根因**：派 investigator 定位（只读）：症状 → 代码链路 → 最小根因文件:行。记录到隔 `root_cause`。
4. **修复**：回归 + 派 implementer 在隔离 worktree 修（只改根因相关，不顺手重构/加 feature），自测。返回 branch/worktree。
   - **另补一个回归测试**：先写/改一个能捕获此 bug 的测试（红→绿）。
   - 重试上限 2 次 → `BLOCKED`。
5. **复测**：派另一个 agent（reviewer）拿 `Original Bug Report` 核对 diff：修复范围 ⊆ bug 边界（不许夹带），测试真能捕获。`VERDICT: PASS/FAIL`；4→5 循环上限 2 轮 → 超限 `BLOCKED`。
6. **合并**：全局回归（拼起来回看仍只修这个 bug）→ 并入主线 → 清 worktree。
7. **冒烟+回归验证**：`make run`+curl 复现步骤重走一遍（bug 消失）+ `go test ./...` 全绿 → 账本 `stage: done`。

## 输出（各阶段 RESULT 行）
- `RESULT: BUG_REPRODUCED`
- `RESULT: ROOT_CAUSE file=<file>:<line>`
- `RESULT: BUG_FIXED branch=<branch> worktree=<worktree>`
- `RESULT: BUG_RETEST_PASS` / `RESULT: BUG_RETEST_FAIL reason=<...>`
- `RESULT: BUG_MERGED`
- `RESULT: BUG_SMOKE_PASS` / `RESULT: BUG_SMOKE_FAIL reason=<...>`

## 铁律
- **先复现，再修**；复现不了宁可问。
- 只修报告里的问题，不许夹带重构/新功能（reviewer 硬查）。
- 每个修完后必须有一条**红变绿的回归测试**留证。
- 超限一律 `BLOCKED` 停下交人。