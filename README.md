# Hermes — 多 Agent 对证循环基础设施

> **Agent Harness** · 事件驱动的 CC (Claude Code) + Codex CLI 编排框架

---

## 核心理念

**Agent 是商品，Harness 是差异化的。**

Hermes 不是又一个多 Agent 框架。它是一个 **CLI Agent 管理平台**——不包装 API、不调子进程、不依赖单窗口。用 **n8n + tmux** 作为调度层，管理**持久化**的独立 Agent 进程。

| 传统方案 | Hermes |
|---------|--------|
| 插件/子进程调 Codex（`codex exec -p`） | 持久窗口 + send-keys 注入 |
| 单窗口内嵌多 Agent | 每个 Agent 独立 tmux session |
| HWND + 剪贴板注入 | tmux session name + PTY 写入 |
| agent 干完就消亡 | agent 常驻，事件驱动轮询 |
| 框架锁死 | 路由层在 n8n，协议层在 SKILL.md，可替换 |

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
      └──────────────┬───────────────────┘
                     │
                     循环，直到任一方 REVIEW-PASS
```

### 三层设计

| 层 | 职责 | 技术选型 |
|----|------|----------|
| **路由层** | 事件接收、下一步决策、窗口注入 | n8n (Webhook + Code) |
| **会话层** | Agent 持久化、命令注入、输出读取 | WSL + tmux |
| **协议层** | 共享状态格式、Agent 行为规范 | STATUS.md + SKILL.md |

---

## 组件

### n8n 工作流

- **Webhook 节点**：`POST http://localhost:5679/webhook/agent-loop`
- **Code 节点**：解析事件 → 读 session → `wsl tmux send-keys` 注入
- Payload：`{"author": "CC | Codex", "message": "[CC-WSxxx] 做了什么"}`

### tmux sessions（WSL）

每个 Agent 一个持久 session，名字即身份：

```bash
wsl -e tmux new-session -d -s cc              # CC 持久窗口
wsl -e tmux new-session -d -s codex           # Codex 持久窗口
wsl -e tmux new-session -d -s cc-ws001        # 并行工作间
```

注入命令：

```bash
wsl -e tmux send-keys -t cc '/develop-ws' Enter
wsl -e tmux send-keys -t codex '/review-ws' Enter
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

## 工作流程（端到端）

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
   Codex REVIEW-FAIL   → n8n 路由到 CC 修复
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

## License

MIT
