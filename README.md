# Hermes — 多 Agent 对证循环基础设施

> **Agent Harness** · 事件驱动的 CC（Claude Code）+ Codex CLI 编排框架
>
> **这是 Hermes 的第二个阶段**——从"被动归档"走向"主动协作"
> 上游阶段：**地图归档**（`map-and-archive` 分支）→ 本项目（`hermes-loop` 分支）→ 下一阶段（`next` 分支）

---

## 为什么从地图归档演化出 Hermes？

### 地图归档的局限

`map-and-archive` 分支解决了**记录**的问题——Agent 的工作可以被追溯、决策可以被继承。但在实际使用中发现了三个更深层的需求：

| 地图归档能做的 | 做不到的 | 需要 Hermes 解决的 |
|----------------|----------|-------------------|
| 事后记录"做了什么" | Agent 会话结束后就停了 | Agent **持久运行**，不依赖单次会话 |
| 单个 Agent 上下文保持 | 多 Agent 之间无法实时通信 | 多 Agent **主动协作**，不靠人工传话 |
| 被动查阅历史记录 | 没有质量把关机制 | **对证验证**——一个 Agent 写，另一个审查 |
| 无并发调度 | 不能根据事件触发下一步动作 | 事件驱动，**自动化编排** |

### Hermes 的核心回答

> **Agent 是商品，Harness 是差异化的。**

市面上各种 AI Agent（Claude Code、Codex CLI、Cursor、Copilot）越来越同质化——模型能力相近，工具接口趋同。真正的差异不在 Agent 本身，而在**你怎么编排它们**。

Hermes 不是又一个多 Agent 框架，它是一个 **CLI Agent 管理平台**——不包装 API、不调子进程、不依赖单窗口。用 **n8n + tmux** 作为调度层，管理**持久化**的独立 Agent 进程。

---

## 核心理念：对证循环（Confrontation Loop）

### 什么是"对证"？

传统开发流程：人写代码 → 人审查 → 人合并。
Hermes 对证循环：**CC 写代码 → Codex 审查 → 循环直到通过**。

这不是 adversarial（对抗），而是 **constructive confrontation（建设性对证）**——两个 Agent 用不同的角色和思维模式协作，互为质量关卡：

| 角色 | Agent | 模式 | 职责 |
|------|-------|------|------|
| **CC**（发散·开发） | Claude Code | 探索式 | 读 STATUS.md → 实现功能 → commit → 通知 |
| **Codex**（收敛·测试） | Codex CLI | 审查式 | 读 STATUS.md → git diff → REVIEW-PASS/FAIL → 通知 |

### 循环协议

```
CC 写完 → notify → n8n 收到 → 路由到 Codex
Codex 审查 → PASS → 完成
Codex 审查 → FAIL → n8n 收到 → 路由回 CC 修复
      ↓
   循环（最多 N 轮，默认 5），直到任一方写 REVIEW-PASS
```

**循环终止条件（stop rules）** 是 loop engineering 的核心——设计不当的循环会无限跑下去或者过早放弃。Hermes 有两个明确的终止路径：
- Codex 写 `REVIEW-PASS` → 完成，归档
- 超过最大轮次 → 标记卡住，通知人工介入

---

## 架构

```
┌─────────────────────────────────────────────────┐
│                     n8n                         │
│             事件路由器（Webhook → 决策 → 注入）   │
└────┬────────────────────────────────────┬───────┘
     │ wsl tmux send-keys                  │ wsl tmux send-keys
     ▼                                     ▼
┌────────────┐                     ┌────────────┐
│   CC       │                     │  Codex     │
│ (Claude Code)                     │ (Codex CLI)│
│  发散·开发 │                     │ 收敛·测试  │
│            │                     │            │
│ STATUS.md  │◄──────────────────► │ STATUS.md  │
│   读写     │    共享状态          │   读写     │
└─────┬──────┘                     └─────┬──────┘
      │                                  │
      │  git commit                       │  git commit
      │  → notify-agent.sh               │  → notify-agent.sh
      │  → POST n8n webhook               │  → POST n8n webhook
      └────────────────┬─────────────────┘
                       │
               循环，直到 REVIEW-PASS
```

### 三层设计

| 层 | 职责 | 技术选型 | 为什么选它 |
|----|------|----------|-----------|
| **路由层** | 事件接收、下一步决策、窗口注入 | n8n (Webhook + Code) | 可视化编排，不写代码就能改路由逻辑 |
| **会话层** | Agent 持久化、命令注入、输出读取 | WSL + tmux | 真实终端环境，Agent 不丢上下文 |
| **协议层** | 共享状态格式、Agent 行为规范 | STATUS.md + SKILL.md | 纯文本，人类可读可改，不依赖特定工具 |

---

## 组件详解

### n8n 工作流

n8n 是整个系统的**中枢神经**。它不写代码、不跑任务——只做一件事：**根据事件决定下一个动作**。

- **Webhook 节点**：`POST http://localhost:5679/webhook/agent-loop`
- **Code 节点**：解析事件 → 读当前 session → 决定注入哪个 Agent → `wsl tmux send-keys`
- **Payload 格式**：
  ```json
  {"author": "CC | Codex", "message": "[CC-WSxxx] 做了什么"}
  ```

### tmux sessions（WSL）

每个 Agent 一个**持久** tmux session，名字即身份：

```bash
wsl -e tmux new-session -d -s cc              # CC 持久窗口（发散·开发）
wsl -e tmux new-session -d -s codex           # Codex 持久窗口（收敛·测试）
wsl -e tmux new-session -d -s cc-ws001        # 并行工作间（多任务时）
```

**为什么不用 `exec` 调子进程？**

子进程模型（`codex exec -p "prompt"`）的问题是：Agent 干完就消亡，没有持久状态，下次重新调又是从零开始。tmux session 让 Agent **常驻**，保持上下文，n8n 可以随时注入新指令。

**注入命令：**

```bash
wsl -e tmux send-keys -t cc '/develop-ws' Enter
wsl -e tmux send-keys -t codex '/review-ws' Enter
```

### STATUS.md（共享状态）

Agent 之间的通信介质，n8n 可以程序化解析：

```markdown
# ws001 — 任务名

## 任务
实现 JWT 登录签发

## 约束
用 pyjwt，token 有效期 24h

## 迭代记录
| 轮次 | 提交者 | 结果 | 详情 |
|------|--------|------|------|
| 1    | CC     | 完成 | 实现 JWT 登录签发 |
| 2    | Codex  | REVIEW-FAIL | token 过期校验缺失 |
| 3    | CC     | 完成 | 修复过期校验 |
| 4    | Codex  | REVIEW-PASS | 审查通过 |

## 状态
completed
```

### SKILL.md（Agent 行为协议）

**瘦 skill 设计**——每个文件只定义一件事，不塞大段逻辑：

| Skill | 所属 | 职责 |
|-------|------|------|
| `/develop-ws` | CC | 读 STATUS.md → 开发 → commit → notify-agent.sh |
| `/fix-ws` | CC | 读 STATUS.md → 修复指定问题 → commit → notify-agent.sh |
| `/review-ws` | Codex | 读 STATUS.md → git diff → REVIEW-PASS/FAIL → commit → notify |
| `/check-done` | 双方 | 觉得任务完成 → 写 REVIEW-PASS |

### notify-agent.sh（通知脚本）

Agent commit 后自觉执行，触发下一轮：

```bash
curl -s -X POST http://localhost:5679/webhook/agent-loop \
  -H "Content-Type: application/json" \
  -d '{"author": "CC", "message": "[CC-WS001] 完成 JWT 登录签发"}'
```

---

## 完整工作流程（端到端）

```
1. Hermes 初始化
   写 STATUS.md → tmux new-session cc → tmux new-session codex
   → send-keys -t cc '/develop-ws'

2. CC 收到 /develop-ws
   读 STATUS.md → 开发 → git commit
   → ./scripts/notify-agent.sh CC → n8n webhook

3. n8n 收到事件
   解析 author=CC → 路由到 codex
   → wsl tmux send-keys -t codex '/review-ws'

4. Codex 收到 /review-ws
   读 STATUS.md → git diff → REVIEW-PASS/FAIL → git commit
   → ./scripts/notify-agent.sh Codex → n8n webhook

5. 循环（≤5 轮），直到任一方写 REVIEW-PASS
   Codex REVIEW-PASS  → Hermes 归档
   Codex REVIEW-FAIL   → n8n 路由回 CC 修复
```

---

## 环境要求

| 组件 | 说明 |
|------|------|
| Windows 11 | WSL2 + 镜像网络模式 |
| WSL (Ubuntu) | tmux 运行环境 |
| n8n | Webhook 路由引擎 |
| tmux | Agent 会话管理 |
| Claude Code | CC Agent（npm 全局安装） |
| Codex CLI | Codex Agent（npm 全局安装） |

---

## 快速开始

```powershell
# 1. 启动 n8n
cd D:\DockerFiles\n8n-native && n8n start

# 2. 创建 Agent sessions
wsl -e tmux new-session -d -s cc
wsl -e tmux new-session -d -s codex
wsl -e tmux send-keys -t cc 'claude' Enter
wsl -e tmux send-keys -t codex 'codex-cli' Enter

# 3. 写入初始 STATUS.md
# 4. 注入第一条命令
wsl -e tmux send-keys -t cc '/develop-ws' Enter
```

---

## 与地图归档的关系

| 维度 | 地图归档（map-and-archive） | Hermes（hermes-loop） |
|------|----------------------------|----------------------|
| 阶段 | 第一阶段：记录 | 第二阶段：协作 |
| 核心问题 | 会话间如何保留上下文 | 多 Agent 如何实时协作 |
| 工作方式 | 被动：Agent 自己记，人以后查 | 主动：n8n 根据事件驱动下一步 |
| Agent 生命周期 | 单会话内有效 | 持久化，跨会话运行 |
| 质量保障 | 无（依赖 Agent 自觉） | 有（Codex 对证，REVIEW-PASS/FAIL） |
| 技术栈 | Python CLI + flat files | n8n + tmux + send-keys |
| 文件 | 6 个 Python 脚本 + 3 个 Skill | README（架构文档） |

**演化逻辑**：地图归档证明了"记录有价值"，Hermes 在此基础上加了一层"实时协作+对证验证"。两者都是同一个项目哲学的不同面向：**让 AI Agent 的开发过程可观测、可协作、可追溯**。

---

## 版本历史

| 版本 | 日期 | 关键变化 |
|------|------|----------|
| v0.1 | 2026-05-28 | 注入驱动架构：tmux send-keys + 超时检测 + workspace |
| v0.2 | 2026-06-12 | 全新 Hermes 架构：n8n + tmux + 持久 Agent，废弃旧模型 |

---

## License

MIT
