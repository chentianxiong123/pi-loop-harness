---
name: 7-smoke
description: "（环节7）最终联调回归：合并后 make run 起服务 + curl 冒烟 + 对照原始需求逐条验收 + 补一组测试，写 .pi/smoke/<name>.md。回归：先读原始需求。"
allowed-tools: read write bash subagent
---

# 环节7 · 联调回归（真正跑起来）

合并到主线之后，把整个 feature **真正跑起来**验证，并补一组测试留证。这是避免"编译过但其实没跑过"的最后一道门。

## 回归（前置，必须最先做）
读 `.pi/plan/<name>.md` 的 **`Original Request`** + SPEC + `.pi/tasks/<name>.md` + `framework/RULES.md`。
明确验收就是最初需求，不是实现者自述。

## 前置检查
- 账本 `.pi/runs/<name>.json` 存在，`stage: merge`（或至少全部 `retested`）。
- `merge` 后的主线可编译：`cd framework && make build`。

## 工作流
1. 回归 + 前置检查。
2. **起服务冒烟**（framework 目录）：
   ```bash
   make run &   # 或 ./bin/harnessd 后台；注意 HARNESSD_DB 用临时库，别污染 data
   sleep 1; curl -sS localhost:8100/ ; curl -sS localhost:8100/api/greet ; curl -sS localhost:8100/api/count
   ```
   htmx 片段端点返回 200 + HTML 片段（不是 JSON）；纯数据端点返回 text。对照 SPEC/需求核对每条端点行为。
3. **逐条验收**：拿最初需求和 SPEC 的每条 Acceptance Criterion，跑一遍对应端点/行为，记录证据。
4. **补一组测试**：为本次 feature 补 `*_test.go`（business/ 直测；有 DB 的用临时库），保证 `go test ./...` 全绿 —— 这就是本轮回归的自动化留证。
5. 写 `.pi/smoke/<name>.md`：验收证据表（最初需求条目 × 可观测证据 × 测试名）+ curl 输出片段。
6. 账本更新 `stage: smoke`，`events` 追加"SMOKE"。
7. 结束进程：杀掉后台服务（curl 之后 kill）。

## 判结果
- 全部通过 → 末行：`RESULT: SMOKE_PASS`
- 任一红了 → 末行：`RESULT: SMOKE_FAIL reason=<...>`，回环节4修复 → 重走 4→5→6→7（循环上限 1 轮，超限 BLOCKED）

## 铁律
- 冒烟必须真实起服务 + 真实 curl；不许"我确信没问题"。
- 补的测试必须真实跑过（`go test ./...` 全绿），不算口头。
- 结束必须把起的后台进程杀掉，不留僵尸。