# pi-loop-harness

> **loop harness** — AI Agent 循环编排平台
>
> 平台核心在 `.pi/`（TypeScript / Pi Node.js）；`framework/` 是 Go 应用项目模板，不是平台本身。

---

## 这是什么

pi-loop-harness 是一个 **agent 控制监管平台**。它监管 agent 干活的全过程：任务什么时候开始、做到哪一步、复测过没过、该不该回退、断点续跑到哪。

```
┌──────────────────────────────────────────────────────────┐
│                   pi-loop-harness                         │
│                                                              │
│  .pi/                              framework/               │
│  TS 平台核心                        Go 应用模板              │
│                                                              │
│  8 步流水线                     hello + msgwall             │
│  角色硬隔离                      business / infra / glue     │
│  账本断点续跑                    SQLite / HTMX / Alpine      │
│  权限门 / 验证门                 单一二进制                 │
│                                                              │
│  跑在 Pi (Node.js) 上                可选应用骨架模板         │
│                                                              │
│  ← 平台本体                            ← 被监管的目标工程     │
└──────────────────────────────────────────────────────────┘
```

## 平台核心：`.pi/`

TypeScript 代码，跑在 Pi agent (Node.js) 上。这是平台的实际运行代码。

```
.pi/
├─ agents/                    角色定义（investigator / implementer / reviewer）
├─ extensions/                硬约束扩展
│   ├─ pi-permissions.ts      权限门：只读 / 只写 worktree / 禁破坏性 git
│   ├─ pi-runstate.ts         账本校验：schema + stage 防跳步 + 审计事件
│   ├─ subagent/              子进程派发：single / parallel / chain
│   └─ question.ts            交互确认
├─ skills/
│   ├─ entries/               人类触发入口（model 可见）
│   │   ├─ 0-loop-dispatcher  总入口：8 步编排 + 回退 + 断点续跑
│   │   └─ bug-triage         bug 入口
│   └─ steps/                 AI 内部环节（disable-model-invocation）
│       ├─ 1-plan-alignment   审问 → PLAN（frozen）+ 账本
│       ├─ 2-explore          探索可行性
│       ├─ 3-spec-review      审查 → SPEC（frozen）
│       ├─ task-slice         切片 → tasks + 契约
│       ├─ 4-implement        实施（隔离 worktree）
│       ├─ 5-retest           复测（另一 agent）
│       ├─ 6-merge            合并
│       └─ 7-smoke            冒烟回归
├─ plan/  feasibility/  spec/  tasks/  smoke/    制品目录
└─ runs/                                  账本（gitignore）
```

## 应用模板：`framework/`

Go + HTMX + SQLite + Alpine.js 的应用项目骨架。被平台监管，作为目标工程。

```
framework/
├─ business/    纯业务函数（不碰 HTTP / DB）
├─ infra/       基础设施（SQLite 读写 / HTML 模板）
├─ glue/        胶水层（契约接口 / HTTP 路由 / 部署）
├─ spec/        设计文档
├─ RULES.md     技术栈唯一权威规则
└─ Makefile     构建 / 启动 / 测试
```

当前包含：hello（问候）+ msgwall（留言板，全栈 POST → SQLite → HTMX 局部刷新）。

## 文档

- [架构总纲](docs/two-frameworks.md) — 平台（TS）与模板（Go）的关系
- [蓝图总览](docs/blueprint-overview.md) — 综合全部文档的一张蓝图
- [软件工程哲学](docs/philosophy.md) — 意图驱动的分形软件工厂（思想底座）
- [应用模板选型研究](docs/framework-research.md) — 若依 × SpringBoot → Go 映射
- [framework/README.md](framework/README.md) — Go 应用项目骨架说明
- [文档地图](docs/docmap-ai-framework.md) — 资产索引

## 怎么开始

新功能：对 Pi 说 `用 0-loop-dispatcher 开发 <功能>`。
修 bug：对 Pi 说 `用 bug-triage 修 <症状>`。

## 分支结构

- `main` — 主线：平台 + 文档
- `project-archive-skills` — 地图归档工具（Python CLI + Skill）
- `confrontation-loop-workflow` — 多 Agent 对证循环流程
- `next` — 新路线
