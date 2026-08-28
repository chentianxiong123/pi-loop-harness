# AGENTS.md — pi-loop-harness（二开基座模板）

这是一个**二开基座模板**。克隆后，把 Pi 的项目目录指向本仓库即可。
`framework/` 的 Go 骨架（business/infra/glue）是你的业务代码起点；`.pi/` 里的
skills + 扩展是开发流程层，随仓库就位，信任一次后用 `/skill:name` 直接调用。

## 开发流程（6 环节，总入口是 0-loop-dispatcher）

| # | skill | 环节 | 产出 |
|---|---|---|---|
| 0 | `/0-loop-dispatcher` | **总入口/编排** | 驱动 1→6，含 2 环节的回归回退 |
| 1 | `/1-spec-alignment` | 审问 | `.pi/plan/<name>.md`（frozen） |
| 2 | `/2-explore` | 探索可行性 | `.pi/feasibility/<name>.md` 或 `INFEASIBLE`→回归 1 |
| 3 | `/3-spec-review` | 审查 | `.pi/spec/<name>.md`（frozen） |
| 4 | `/4-implement` | 实施代码 | 一个实现分支 + 自测 |
| 5 | `/5-retest` | 复测 | `VERDICT: PASS/FAIL`（另一个 agent） |
| 6 | `/6-merge` | 合并 | 并入主线 |

## 怎么开始一个新功能

直接对 Pi 说：
> 用 0-loop-dispatcher 开发 <功能>

它会自动走 审问→探索→审查→实施→复测→合并，关键抉择点用 question 问你，
不可行/复测不过会自动回退。

## 物理层（无需自己写）

- **subagent 扩展**：`.pi/extensions/subagent/`，提供 `subagent` 工具（single/parallel/chain），每个子 agent 是隔离的 pi 子进程。
- **question 扩展**：`.pi/extensions/question.ts`，交互式选择/确认。
- 角色定义：`.pi/agents/{investigator,implementer,reviewer}.md`。

## 约定

- 端口 8100；三层 business/infra/glue；契约在 `glue/interfaces/`。
- **技术栈规则**：`framework/RULES.md`（Go/htmx/SQLite 唯一权威源）。所有写代码的 Agent/skill（investigator/implementer/reviewer、环节 2–5）动手前必须先读它。修改只改这一个文件（维护说明见该文件文末《如何维护》）。
- `.worktrees/` 是 implementer 临时工作树，已被 gitignore。
- 制品目录：`.pi/plan/` `.pi/feasibility/` `.pi/spec/` `.pi/contracts/`。
- 信任：首次 `pi` 在仓库内运行会请求信任项目文件（或加 `-a` 一次），之后自动加载 `.pi/`。