# AGENTS.md — pi-loop-harness（二开基座模板）

这是一个**二开基座模板**。克隆后，把 Pi 的项目目录指向本仓库即可。
`framework/` 的 Go 骨架（business/infra/glue）是你的业务代码起点；`.pi/` 里的
skills + 扩展是开发流程层，随仓库就位，信任一次后用 `/skill:name` 直接调用。

## 开发流程（8 步；总入口是 0-loop-dispatcher，bug 入口是 bug-triage）

> **skill 分层**：`.pi/skills/entries/` = 人类直接触发的入口（model 可见）；
> `.pi/skills/steps/` = AI 内部环节（`disable-model-invocation: true`，只由入口编排显式 `/skill:` 调用，模型不会自行乱调）。

| # | skill | 位置 | 环节 | 产出 |
|---|---|---|---|---|
| 0 | `/0-loop-dispatcher` | entries | **总入口/编排** | 驱动全部环节 + 回归回退 + 断点续跑 |
| 1 | `/1-plan-alignment` | steps | 审问 | `.pi/plan/<name>.md`（frozen）+ 账本 |
| 2 | `/2-explore` | steps | 探索可行性 | `.pi/feasibility/<name>.md` 或 `INFEASIBLE`→回归 1 |
| 3 | `/3-spec-review` | steps | 审查 | `.pi/spec/<name>.md`（frozen） |
| — | `/task-slice` | steps | 切片+契约 | `.pi/tasks/<name>.md` + `glue/interfaces/**`（只读） |
| 4 | `/4-implement` | steps | 实施代码 | 每任务一个实现分支 + 自测 |
| 5 | `/5-retest` | steps | 复测 | `VERDICT: PASS/FAIL`（另一个 agent） |
| 6 | `/6-merge` | steps | 合并 | 并入主线 |
| 7 | `/7-smoke` | steps | 联调回归 | 起服务冒烟 + `.pi/smoke/<name>.md` + 补测试 |
| B | `/bug-triage` | entries | **bug 入口** | 症状→复现→根因→修复→回归→合并→冒烟 |

## 怎么开始

- 新功能：对 Pi 说 `用 0-loop-dispatcher 开发 <功能>`。
- 修 bug：对 Pi 说 `用 bug-triage 修 <症状>`。

会走 审问→探索→审查→切片→实施→复测→合并→冒烟；关键抉择点用 question 问你，
不可行/复测不过/冒烟不过会自动回退；次数超限 `BLOCKED` 停下交人。

## run-state 账本（状态唯一源）

- 路径 `.pi/runs/<name>.json`（已 gitignore）；schema 单一源 `.pi/skills/entries/0-loop-dispatcher/references/run-state.md`。
- 每个环节读账本确认 stage、结束时更新 stage/retry/tasks/events。
- **断点续跑**：说"继续 <name>"，从账本 stage 处继续，重试计数不凭记忆。
- 会话丢了不怕：plan/feasibility/spec/tasks/smoke 与账本都在磁盘，接得上。

## 物理层（无需自己写）

- **subagent 扩展**：`.pi/extensions/subagent/`，提供 `subagent` 工具（single/parallel/chain），每个子 agent 是隔离的 pi 子进程；派发时写入 `PI_SUBAGENT_ROLE=<agent>` 环境变量，并从子 agent 末行 JSON 抽取 `[structured]` 输出。
- **question 扩展**：`.pi/extensions/question.ts`，交互式选择/确认。
- **角色定义**：`.pi/agents/{investigator,implementer,reviewer}.md`。

## 硬约束扩展（机制级，不靠约定）

这些把 skill/agent.md 里的"软约束"变成扩展层硬拦截：

| 扩展 | 提供的工具 | 硬约束 |
|---|---|---|
| `pi-permissions.ts` | (事件拦截) | 角色权限门：reviewer/investigator 只读禁写；implementer 只许写 `.worktrees/`；`glue/interfaces/**` 与 `.pi/plan|spec|tasks|smoke/` 任何角色禁改（契约/冻结锚）；禁破坏性 git（push/rebase/merge…） |
| `pi-runstate.ts` | `runstate_get` / `runstate_update` / `runstate_create` | 账本 schema 校验 + stage 防跳步（expectStage）+ 审计事件 |
| `pi-permissions` 注入 | `PI_SUBAGENT_ROLE` | 子 agent 自动带角色，进入对应权限模式 |

**分工**：`pi-permissions` 管"能不能做"，`pi-runstate` 管"做没做对/到哪一步"，`subagent` 管"谁去做、结构化成不成"。三者合起来把流程从"文本约定"升级成"机制约束"。
- 单测：`.pi/extensions/__tests__/pi-permissions.test.ts`（`bun test` 跑）

## 约定

- 端口 8100；三层 business/infra/glue；契约在 `glue/interfaces/`（task-slice 生成，**冻结只读**）。
- **技术栈规则**：`framework/RULES.md`（Go/htmx/SQLite 唯一权威源）。所有写代码的 Agent/skill（investigator/implementer/reviewer、环节 2–7）动手前必须先读它。修改只改这一个文件（维护说明见该文件文末《如何维护》）。
- `.worktrees/` 是 implementer 临时工作树，已被 gitignore。
- 制品目录：`.pi/plan/` `.pi/feasibility/` `.pi/spec/` `.pi/tasks/` `.pi/smoke/`。账本在 `.pi/runs/`（gitignore）。
- 信任：首次 `pi` 在仓库内运行会请求信任项目文件（或加 `-a` 一次），之后自动加载 `.pi/`。