# Hermes — 多 Agent 对证循环基础设施

> **Agent Harness** · 事件驱动的 CC（Claude Code）+ Codex CLI 编排框架
>
> **项目全景**：从"记录"到"协作"的两阶段演化
> `map-and-archive`（第一阶段）→ `hermes-loop`（第二阶段）→ `next`（下一阶段）

---

## 项目叙事：两个阶段，一条主线

### 第一阶段：地图归档（`map-and-archive` 分支）

> **问题**：AI Agent 每次新开会话，之前的工作记忆全丢。为什么选这个方案、踩过什么坑，都没有记录。
>
> **方案**：把归档变成 Agent 的工作流的一部分——做一件事就写一条记录，决策就留一棵树。
>
> **成果**：6 个 Python CLI 工具 + 3 个 Skill 文件，任何 Agent 都能接入历史追溯。

### 第二阶段：Hermes 对证循环（`hermes-loop` 分支）

> **问题**：光是记录不够。单 Agent 写代码没有质量关卡，多 Agent 协作没有实时通道。
>
> **方案**：让两个 Agent（CC 发散·开发 + Codex 收敛·测试）进入对证循环——CC 写，Codex 审，循环直到 REVIEW-PASS。
>
> **成果**：n8n 事件路由 + tmux 持久会话 + STATUS.md 共享协议，三层层叠的 Agent Harness。

### 下一条路（`next` 分支）

> **问题**：对证循环验证了"编排有价值"，但还有更多可能性——多 Agent 并行、Skill 动态注入、自动进化……
>
> **方向**：待定。

---

## 核心哲学

**Agent 是商品，Harness 是差异化的。**

市面上各种 AI Agent（Claude Code、Codex CLI、Cursor、Copilot）越来越同质化——模型能力相近，工具接口趋同。真正的差异不在 Agent 本身，而在**你怎么编排它们**。

Hermes 不是又一个多 Agent 框架。它是一个 **CLI Agent 管理平台**——不包装 API、不调子进程、不依赖单窗口。用 **n8n + tmux** 作为调度层，管理**持久化**的独立 Agent 进程。

---

## 架构（第二阶段）

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

## 关键组件

### n8n 工作流

- **Webhook 节点**：`POST http://localhost:5679/webhook/agent-loop`
- **Code 节点**：解析事件 → 读当前 session → 决定注入哪个 Agent → `wsl tmux send-keys`
- **Payload**：`{"author": "CC | Codex", "message": "[CC-WSxxx] 做了什么"}`

### tmux sessions

每个 Agent 一个持久 session，名字即身份：

```bash
wsl -e tmux new-session -d -s cc              # CC 持久窗口
wsl -e tmux new-session -d -s codex           # Codex 持久窗口
wsl -e tmux new-session -d -s cc-ws001        # 并行工作间
```

### STATUS.md（共享状态）

Agent 之间的通信介质，n8n 可程序化解析：

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

瘦 skill 设计，每个文件只定义一件事：

| Skill | 所属 | 职责 |
|-------|------|------|
| `/develop-ws` | CC | 读 STATUS.md → 开发 → commit → notify |
| `/fix-ws` | CC | 读 STATUS.md → 修复指定问题 → commit → notify |
| `/review-ws` | Codex | 读 STATUS.md → git diff → REVIEW-PASS/FAIL → commit → notify |
| `/check-done` | 双方 | 觉得完成任务 → 写 REVIEW-PASS |

### notify-agent.sh（通知脚本）

Agent commit 后自觉执行，触发下一轮：

```bash
curl -s -X POST http://localhost:5679/webhook/agent-loop \
  -H "Content-Type: application/json" \
  -d '{"author": "CC", "message": "[CC-WS001] 完成 JWT 登录签发"}'
```

---

## 分支结构

| 分支 | 阶段 | 内容 | 标签 |
|------|------|------|------|
| `map-and-archive` | 第一阶段 | 地图归档工具（Python CLI + 3 Skill） | `archive/map-and-archive/v1` |
| `hermes-loop` | 第二阶段 | Hermes 对证循环（n8n + tmux + 持久 Agent） | `archive/confrontation-loop/v1` |
| `hermes` | 默认分支 | 项目总览 + 第二阶段完整架构 | — |
| `next` | 下一阶段 | 新路线起点（待探索） | — |

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

## 项目里程碑

| 日期 | Commit | 说明 |
|------|--------|------|
| 2026-05-26 | `45451eb` | **第一阶段开始**：project-archive v2，平铺归档结构 |
| 2026-05-28 | `9367208` | **第二阶段开始**：注入驱动架构 + 超时检测 |
| 2026-06-12 | `35c7309` | **第二阶段成型**：Hermes 全新架构（n8n + tmux + 持久 Agent） |

---

## License

MIT
