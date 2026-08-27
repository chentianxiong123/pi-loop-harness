# 文档地图：AI 框架资产索引

> 检索 `/home/a1/文档` 目录后整理的主线相关文档索引。
> 检索日期：2026-08-27
> 目的：把散落在本机各处的 harness / loop / 对证循环资产，登记进项目主线，避免再次丢失。

---

## 一、A 类：主线核心资产（AI 框架 = harness + loop）

这些文档直接定义 AI 框架（马具 + 循环工程），是 pi-loop-harness 的**思想基底**。

| 文档 | 位置 | 核心内容 | 对主线的作用 |
|------|------|---------|-------------|
| **Harness 工程宣言** | `~/文档/杂/Harness工程宣言.md` | Harness 定义、框架 vs Harness 的本质区别、Agent 商品化、三层可替换架构 | **权威定义**：Harness 不写业务代码、只搭协作框架、零侵入、可替换 |
| **AI 开发框架共识与 Harness 设计** | `~/文档/杂/AI开发框架共识与Harness设计.md` | 反魔法、specs 即源码、三层物理架构（domain/infra/glue）、Harness = 缰绳+验证器 | **技术选型共振**：一切皆函数、YAML/表格即源码、门禁式校验——与 Go 选型文档一致 |
| **对证循环架构通览** | `~/文档/杂/对证循环架构通览.md` | Hermes/CC/Codex 三 Agent 协作、对证循环流程、STATUS.md 唯一通道、工作间并发 | **多 Agent 循环的完整蓝本** |
| **Skills 体系与 Agent 协议设计** | `~/文档/杂/Skills体系与Agent协议设计.md` | 从 5 个胖 SKILL + 9 脚本 → 瘦 skill 协议（每个文件只定义一件事） | **协议层演进史**：skill 该多瘦、协议怎么解耦 |
| **handover-agent-loop** | `~/文档/杂/handover-agent-loop.md` | agent-loop 指令定义、n8n 路由代码、注入脚本、遗留问题 | **事件驱动循环的落地细节与已知坑** |
| **agent-migration-plan** | `~/文档/杂/agent-migration-plan.md` | 从 opencode 迁移到 Pi 体系，远期"自定义 Harness Go?" | **编排层现状 + Go vs TS 待决点** |
| **STATUS 更新规则** | `~/文档/杂/STATUS更新规则-系统提示词.md` | STATUS.md 标准格式、更新规则 | **协议层最简可执行版本** |

## 二、B 类：技术与方法论选型资产

| 文档 | 位置 | 核心内容 |
|------|------|---------|
| **AI 循环工程 Go 技术选型** | `~/文档/todo/AI循环工程Go技术选型.md` | 完整方法论（Loop Engineering、Spec-Driven、约束工程）+ Go 全栈选型 + HTMX/daisyUI 前端 | 
| **Makefile vs go run** | `~/文档/todo/make-vs-go-run-comparison.md` | Go 构建用 Makefile 的论证 | 

## 三、C 类：历史参考资产（旧归档）

`~/文档/杂/旧归档-架构时代-2026-04-02至05-22/` 保留着早期架构探索，包含大量 harness / agent 相关参考项目源码与 spec：

- `1-老项目-封锁重架构/` — `.trae/specs/` 全套 spec-driven 任务流、`23-sqlite-schema-v2.md`、`SPEC.md`
- `3-新项目-Stdio-架构旧文档/` — HomeSense Studio 交接（`HANDOVER.md`），记忆/经验/Skill 三层、API server、MCP 集成
- 内含 hermes-agent 参考项目全文（`docs/history/References/hermes-agent/`），含 `agent-loop.md`、插件/skill 体系、memory-provider、CLI、API server

## 四、相关但不归属主线

- `~/文档/todo/QQ数据归档_完整文档.md` — 另一个"归档"，是 QQ 数据本体，与地图归档（project-archive）无关
- `~/文档/杂/HomeSense-JARVIS-架构讨论.md` — 单服务约束下的 agent 循环，属 HomeSense 线

---

## 检索方法备注

- 关键字：`harness` / `loop` / `循环` / `对证` / `约束工程` / `工具门禁` / `SKILL` / `STATUS.md` / `project-archive` / `hermes`
- 命中文档总计 10+，重点 A 类 7 份为直接资产
- 后续新发现直接追加本表，保持文档地图为唯一登记入口