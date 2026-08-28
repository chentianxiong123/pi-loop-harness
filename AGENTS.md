# AGENTS.md — pi-loop-harness（二开基座模板）

这是一个**二开基座模板**。克隆后，把 Pi 的项目目录指向本仓库即可。
`framework/` 的 Go 骨架（business/infra/glue）是你的业务代码起点；`.pi/` 里的
skills + 扩展是开发流程层，随仓库就位，信任一次后用 `/skill:name` 直接调用。

## 开发流程（5 段，按编号顺序）

| 编号 | skill | 环节 | 产出 |
|---|---|---|---|
| 1 | `/1-spec-alignment` | 审问 | `.pi/spec/<name>.md`（frozen） |
| 2 | `/2-contract-translate` | 探索/切译 | `.pi/contracts/<name>.md`（frozen） |
| 3 | `/3-agent-workflow` | 分支开发·单任务查改审 | 一个完成的分支 |
| 4 | `/4-regression-gate` | 回归铁律 | 合并前判定 PASS/FAIL |
| 5 | `/5-loop-dispatcher` | 分支开发·总入口 | 功能并入主线 |

## 怎么开始一个新功能

1. `/1-spec-alignment` —— 和用户对齐需求，产出冻结 SPEC 到 `.pi/spec/`。
2. `/2-contract-translate` —— 探索代码，产出冻结契约到 `.pi/contracts/`。
3. `/5-loop-dispatcher .pi/spec/<name>.md` —— 它自动切片，逐任务派
   `investigator → implementer → reviewer`（通过官方 `subagent` 扩展，每个角色隔离上下文），
   implementer 自己 `git worktree add` 干活，reviewer 出 `VERDICT: PASS/FAIL`，
   过 `4-regression-gate` 后并入主线。

## 物理层（无需自己写）

- **subagent 扩展**：`.pi/extensions/subagent/`，提供 `subagent` 工具（single/parallel/chain），每个子 agent 是隔离的 pi 子进程。
- **question 扩展**：`.pi/extensions/question/`，交互式选择/确认。
- 角色定义：`.pi/agents/{investigator,implementer,reviewer}.md`。

## 约定

- 端口 8100；三层 business/infra/glue；契约在 `glue/interfaces/`。
- `.worktrees/` 是 implementer 临时工作树，已被 gitignore。
- 信任：首次 `pi` 在仓库内运行会请求信任项目文件（或加 `-a` 一次），之后自动加载 `.pi/`。
