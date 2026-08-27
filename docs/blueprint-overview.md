# pi-loop-harness · 蓝图总览（综合）

> 本文档汇总本机全部相关文档，收敛为一张蓝图。
> 综合来源：
> - `docs/two-frameworks.md`（双框架总纲）
> - `docs/docmap-ai-framework.md`（资产索引）
> - `~/文档/杂/Harness工程宣言.md`
> - `~/文档/杂/AI开发框架共识与Harness设计.md`
> - `~/文档/杂/对证循环架构通览.md`
> - `~/文档/杂/Skills体系与Agent协议设计.md`
> - `~/文档/杂/handover-agent-loop.md`
> - `~/文档/杂/agent-migration-plan.md`
> - `~/文档/杂/STATUS更新规则-系统提示词.md`
> - `~/文档/todo/AI循环工程Go技术选型.md`
> 合并日期：2026-08-27

---

## 一、一句话蓝图

> **搭一个可以并发进行、自动进行、可以有银弹的软件工程项目** —— 用「AI 框架（harness + loop）」驱动，用「GO 项目框架（SpringBoot/若依式骨架）」承载。人写循环，AI 干活，做得完、不停工、不跑偏。

---

## 二、两个框架（全图核心）

| | AI 框架 | GO 项目框架 |
|---|---------|-----------|
| **本质** | 马具（约束工程）+ loop（循环工程） | 应用工程骨架，类比 SpringBoot / 若依 |
| **性质** | 方法论，与语言无关 | 技术实现底座 |
| **技术栈** | 不绑定 | **GO + SQLite + HTMX**（+ templ + daisyUI + SSE） |
| **回答** | "AI 怎么自主、可靠地干活" | "落地成什么工程结构" |
| **承载** | 灵魂（引擎） | 骨架（容纳引擎） |

> 两者不冲突，反而互补：若依给模板和路径，AI 框架给原则和边界。

---

## 三、AI 框架的三个来源汇总

### 3.1 Harness = 马具（约束工程）

**权威定义（Harness 工程宣言）**：骨架型基础设施——不产生业务价值，协调多个独立组件协同工作。

判断标准：
- 不写业务代码（不做 JWT、CRUD、UI）
- 只搭协作框架（协议 + 路由 + 行为规范）
- 协调多个进程
- 各层可独立替换
- 体积小、模块化

**框架 vs Harness 的本质区别：**

| 维度 | 框架（Framework） | Harness（马具） |
|------|------------------|----------------|
| 立场 | "你的代码按我的方式写" | "你的代码继续你的方式，我只管通信" |
| 侵入性 | 需 import / 继承 | 零侵入（文件协议）|
| 升级 | 大版本可能 breaking change | 不改协议就不受影响 |
| 心智负担 | 高 | 低（一个文件 + 几条规则）|
| 调试 | 黑箱 | 全透明，STATUS.md 就是日志 |
| 可替换性 | 切框架=重写 | 换路由层不改协议 |

> **Agent 是商品，Harness 是差异化的。** CC/Codex/模型会变，"写 → 审 → 循环直到通过"这个模式不会变，Harness 就是把模式固定下来，让底层 Agent 可替换。

**三层可替换架构：**
```
路由层   n8n → Dify → LangGraph → 自建脚本   （事件 → 决策 → 注入）
会话层   Windows终端 → WSL tmux → Docker exec （Agent 收到命令）
协议层   STATUS.md → JSON → 数据库            （Agent 能读能写）
```
每一层都是协议接口，不改协议就能换实现。

### 3.2 约束工程（三种硬约束）

文档主线方法论的执行机制，全部是**结构强制**而非 prompt 软提醒：

| 约束 | 机制 | 效果 |
|------|------|------|
| **工具门禁** | 当前阶段能调什么工具由代码拦截 | 阶段错了，工具不存在 |
| **输出契约** | 每步输出必须满足 verify 条件 | 不满足就不算完成 |
| **上下文锁** | 每轮只注入 spec + 当前阶段 + 当前 task | 其他历史不可见 |

> 三者互补：**看不见 → 做不了 → 做不完。**

**验证测试是编码的终点**：一个 task 不满足 verify，代码再漂亮也不算完成。验证阶段只读模式（只能跑测试，不能写）。

**Harness 即缰绳 + 验证器**（AI开发框架共识）：
- Specs 校验器（生成前）：检查 YAML 状态图完备性（无死锁、无不可达状态、类型匹配）
- 生成后静态门禁：lint + typecheck + import 白名单（domain 禁 import infra）
- 节点级契约测试：基于 specs 前后置条件自动生成 property-based test
- Diff 审计钩子：自动高亮生成差异，标注是否超出 specs 允许范围

**反魔法原则**（AI开发框架共识）：
- 程序本质 = 约束快照；语言本质 = 有损压缩
- **YAML/表格即源码，代码只是渲染产物**（specs 是资产，代码可丢弃）
- 三层物理架构告别 Controller/Service/Mapper：
  1. 函数层（domain）：纯业务规则，零外部依赖，显式传参
  2. 适配层（infra）：对接外部世界（DB/HTTP/MQTT）
  3. 胶水层（app/main）：显式编排，手动组装依赖
- 最终形态：无魔法注解、无全局变量、无自动扫描
- 改业务改 specs，改技术只改 infra，domain 毫不知情

### 3.3 Loop = 循环工程

回答"agent 在时间轴上的编排"：
- 什么时候开始、继续、停止
- 上次做到哪，下次从哪接
- 多个 agent 怎么协作

**对证循环（Concordance Loop）——多 Agent 协作蓝本：**
```
Hermes 规划 → 写 STATUS.md → 启动工作间
  CC 读 STATUS.md → 实现 → commit → notify
  Codex 被唤醒 → 审查 → REVIEW-PASS / REVIEW-FAIL
  循环直到 PASS（或超限 5 轮）
```

工作间模型：一个任务 + 一对 Agent + 一个 STATUS.md，工作间之间**可并发**。

地位分工：Hermes=大脑（规划/终审/归档），CC=手（发散实现），Codex=眼（收敛审查）——**写代码和审代码分家，避免"自我评分太宽容"。**

### 3.4 协议层：瘦到不能再瘦

Skills 体系演进（V1 胖 skill → V4 瘦协议）：
- **SKILL.md 不是文档，是 Agent 的启动指令**：触发规则 + 几条关键动作
- 每个文件只定义一件事，不超过 30 行
- 协议层不依赖脚本，读/写/commit 用 CLI 原生操作
- 事件驱动：Agent 不做主动决策，收到指令才动

**STATUS.md 是唯一的交流通道** —— 不接受 Agent 直接通信；文档是主权，Agent 是工具。

**go 无状态**：STATUS.md 标准格式 = 当前方向 / 已完成 / 正在做 / 待办 / 设计决策 / 归档。

---

## 四、GO 项目框架

### 4.1 为什么要 Go

四个判断其实是同一件事（最小化"第二层含义"）：
- 最直观（无魔术）→ 长期最可维护（显式性复利）→ 最容易让 AI 看懂（推理距离最短）
- **Go 全栈覆盖**：从 syscall 到 agent 编排到 CLI，同一个类型系统、同一个二进制，无语言切换

### 4.2 推荐技术栈

| 层 | 选择 |
|----|------|
| Agent 调用 | OpenAI/Claude API (HTTP) |
| MCP 协议 | mark3labs/mcp-go |
| 状态存储 | SQLite / BadgerDB（嵌入式，零运维）|
| 调度 | time.Ticker + robfig/cron |
| Worker Pool | goroutine + channel |
| CLI | cobra / flag |
| 构建 | Makefile（`make build/run/clean`）|
| 前端 | Go + templ + HTMX 2.x + daisyUI + SSE（天生 SSR，零 npm，单一二进制）|

**Go 标准库就能做的事**：ticker 定时循环、goroutine worker pool、结构体 + 序列化做状态持久化。标准库 + 少量第三方包即可，不需要引入大量框架。

### 4.3 若依感：工程骨架该有的

类比 SpringBoot/若依提供开箱即用的底座：数据库、配置、API 壳、部署形态、通用 CRUD/权限。GO 框架同样提供稳定工程底座，**让 AI 引擎直接入驻**。

### 4.4 Harness 载体：以 Pi 插件为核心

> **开发形态确认（2026-08-27）：constraint/loop 引擎全部实现为 Pi 插件（TypeScript），Pi 是实际干活的 agent。**

Pi = `@earendil-works/pi-coding-agent`（本机 `pi 0.84.2`，数据 `~/.pi/agent`）。它自带完整扩展系统，恰好提供约束工程所需的全部事件拦截点：

| 约束工程 | Pi 插件事件 | 能力 |
|---------|------------|------|
| **工具门禁** | `pi.on("tool_call")` | 可改 `event.input`，可 `{ block, reason, terminate }` 拦截 |
| **上下文锁** | `pi.on("context")` | 每轮 LLM 调用前过滤/注入 messages |
| **输出契约** | `pi.on("tool_result")` / `message_end` / `turn_end` | 修改结果、替换消息、判 verify |
| **Spec 注入** | `before_agent_start` | 注入 message + 改 system prompt |
| **状态持久化** | `pi.appendEntry()` | 跨重启存活（外部 State）|
| **编排指令** | `pi.registerCommand()` | `/loop` `/workspace` 等自定义命令 |
| **子 agent / 事件触发** | `pi.registerTool()` + RPC | 工作间协调、多 agent 调度 |

落地点：`~/.pi/agent/extensions/loop-engine/`（已建空目录，入口 `index.ts`）。

**由此澄清"Go vs TS"**：不是二选一，是分层——
- **Harness/loop 引擎** = Pi 插件（TS），约束/循环逻辑跑在 Pi 里
- **GO 项目框架** = 旁边工程骨架层（SQLite/HTMX/daemon），承载插件驻留

---

## 五、当前状态与下一步

### 已具备
- **方法论层已完成**：Spec-Driven + 约束工程 + Loop Engineering + 一切皆函数
- **阶段一**（project-archive-skills 分支）：地图归档 / STATUS.md / decisions.json，Python CLI + skill
- **阶段二**（confrontation-loop-workflow 分支）：多 Agent 对证循环流程设计
- **三份核心资产文档**：Harness 工程宣言、对证循环架构通览、Skills 体系与协议设计

### 待落地（执行层）
1. **Spec 格式**：YAML/JSON 结构定义（goal/scope/constraints/tasks/verify/prior-decisions）
2. **loop-engine 插件**：`~/.pi/agent/extensions/loop-engine/index.ts`——工具门禁 / 上下文锁 / 输出契约的 Pi 插件实现（核心载体）
3. **DaemonServer**：watchdog 机制，TCP socket 通信，事件驱动（GO 项目框架层）
4. **GO 项目框架骨架**：工程底座（SQLite/HTMX）+ 与 Pi 插件协同

### 落地边界（不可混淆）
- **编排层（主线）**：纯函数，无副作用，只读 spec 和摘要状态
- **执行层（子 agent）**：允许副作用，但过程不回流主线
- 架构原则：**主线纯，子 agent 可脏。脏的留在子 agent 内部，只有清洁摘要回传。**

---

## 六、方法论链条（一条逻辑链）

```
Spec（单一真相源）
  → Go（显式、AI 友好）
    → 一切皆函数（把 spec 变成可执行结构）
      → Loop（函数循环执行）
        → 反复对齐（每一步比对 spec）
          → 约束工程（怎么强制对齐）
            → 子 agent 隔离（对齐的执行单元）
              → 上下文管理（隔离的技术手段）
                → 事件驱动（触发机制，不轮询）
                  → 验证测试（通过才算完成）
                    → 探索优先（探索 45% + 验证 35% + 编码 20%）
```

---

## 七、关键决策速查

| 决策点 | 结论 |
|--------|------|
| 技术语言 | **Go** |
| 前端 | HTMX + daisyUI + templ（SSR，零 npm）|
| 存储 | SQLite / BadgerDB |
| 通信协议 | STATUS.md / Spec 文件（文本即协议）|
| 编排方式 | 事件驱动，不轮询 |
| Loop 结构 | 对证循环（写审分家）+ 工作间并发 |
| 约束实现 | 门禁 / 契约 / 锁，代码强制非提示 |
| 数据源真相 | spec（YAML/表格即源码）|
| **Harness 载体** | **Pi 插件（TS）**——`loop-engine` 扩展，非从零写框架 |
| **"Go vs TS"** | **分层不冲突**：harness 引擎=Pi 插件(TS)，GO 框架=旁侧工程骨架 |
| 架构哲学 | 反魔法：显式、无第二层含义 |