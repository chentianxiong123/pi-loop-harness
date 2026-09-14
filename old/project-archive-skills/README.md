# 地图归档 (project-archive)

> **地图归档** — 为 AI Agent 开发项目绘制"历史地图"，让每一次探索都可以被检索、被继承
> 仓库名 `project-archive`，口头就叫"地图归档"
>
> 这是 Hermes 项目的**第一阶段**，解决的核心问题是：**Agent 会话之间如何保留上下文和决策脉络**。

---

## 为什么会有这个项目？

### 问题背景

在使用 Claude Code、Codex、Cursor 等 AI Agent 写代码时，有三个反复出现的痛点：

1. **上下文断崖**：每次新开会话，Agent 丢失之前的工作记忆。上一次解决了什么问题、为什么选了 A 方案而不是 B 方案，全没了。
2. **决策黑盒**：项目中做了哪些技术选型，没有成文的追溯。回头重构时只能重新踩坑。
3. **多 Agent 协作无共享状态**：当多个 Agent（不同会话、不同工具）同时工作在一个项目上时，没有统一的进度视图，不知道别人在做什么、做了什么。

### 设计目标

**让 AI Agent 的开发过程像探险家画地图一样**——走过的路、做出的决定、发现的风险，都留在地图上，后人可以随时查、可以继承、可以对比。

### 核心思路

把"归档"从**事后补充**变成**实时同步**，把"文档"从**人工维护**变成**Agent 自动产出**：

- **STATUS.md** — 项目的当前快照：我在做什么、做了什么、下一步是什么
- **archive/** — 平铺归档目录：每个里程碑、每次决策、每次探索，一个文件
- **decisions.json** — 决策树：记录了"当初为什么这么选"，用 `initial / supersede / supplement` 三种类型串联
- **Python CLI 工具** — 6 个纯脚本，任何 Agent 都能调用，不绑定特定工具
- **3 个 Skill 文件** — 教 Agent 在什么时机做什么事（归档、查状态、回顾历史）

---

## 安装

```bash
# 1. 克隆仓库
git clone https://github.com/chentianxiong123/project-archive
cd project-archive

# 2. 设置路径（写进任何 Agent 的配置或 ~/.zshrc）
export PROJECT_ARCHIVE_PATH="/path/to/project-archive"

# 3. 注册你的项目
python $PROJECT_ARCHIVE_PATH/core/init-project.py /path/to/project
```

---

## 目录结构

```
project-archive/
├── core/
│   ├── init-project.py         ← 项目一键初始化（创建 STATUS.md + archive/ + decisions.json）
│   ├── update-status.py        ← STATUS.md 管理（加锁，支持多 Agent 并发）
│   ├── archive-search.py       ← 归档全文搜索 + 索引
│   ├── archive-decision.py     ← 决策树管理（append / supersede / supplement）
│   ├── archive-validator.py    ← 归档文件名/格式校验
│   └── sync-archive.py         ← 项目注册/同步到全局
├── references/
│   └── archive-template.md     ← 归档文件模板
├── project-archive.md          ← Skill 1: 归档指令
├── project-status.md           ← Skill 2: STATUS 管理指令
└── project-recall.md           ← Skill 3: 检索回看指令
```

---

## 使用方式

核心是 **6 个纯 Python CLI 脚本**，任何 Agent（Claude、Codex、GPT 等只要能执行 shell 命令）都能调用：

```bash
# 初始化项目
python $PROJECT_ARCHIVE_PATH/core/init-project.py /path/to/project

# 归档（记录一次完成的工作）
python $PROJECT_ARCHIVE_PATH/core/update-status.py add-archive "feat-jwt-login.md"
python $PROJECT_ARCHIVE_PATH/core/update-status.py mark-done "JWT 登录签发"

# 记录决策
python $PROJECT_ARCHIVE_PATH/core/archive-decision.py append <id> \
  --not "用 jsonwebtoken，因为项目不依赖 express" \
  --but "用 pyjwt，简单直接" \
  --type initial

python $PROJECT_ARCHIVE_PATH/core/update-status.py refresh-decisions

# 检索历史
python $PROJECT_ARCHIVE_PATH/core/archive-search.py "jwt"
python $PROJECT_ARCHIVE_PATH/core/archive-search.py --global "SSE"

# 校验归档格式
python $PROJECT_ARCHIVE_PATH/core/archive-validator.py --project=<项目名>
```

---

## 存储位置

所有数据存储在 `~/.project-archive/`（不在项目目录内，避免污染项目）：

```
~/.project-archive/
├── projects.json                  ← 所有注册项目的索引
├── projects/
│   ├── my-app/
│   │   ├── STATUS.md              ← 当前项目快照
│   │   ├── archive/               ← 平铺归档文件（YYYY-MM-DD--类型--描述.md）
│   │   ├── decisions.json         ← 决策树（initial/supersede/supplement）
│   │   └── .status.lock           ← 多 Agent 并发锁
│   └── another-project/
├── timeline.md                    ← 全局时间线
├── decisions.md                   ← 全局决策汇总
└── tech-stack.md                  ← 技术栈清单
```

---

## 3 个 Skill（Agent 指令文件）

Skill 是教 AI Agent "在什么时机做什么" 的说明书。地图归档本身是 Python 脚本，Skill 只是告诉 Agent 怎么调用它们。

**你只需要两样东西：**
1. **`core/` 里的 Python 脚本** — 实际干活的工具
2. **3 个 `.md` Skill 文件** — 告诉 Agent 什么时候调用它们

| Skill 文件 | 什么时候触发 | 干什么 |
|-------|-----------|--------|
| `project-archive.md` | 模块/功能做完时 | 写归档文件、更新 STATUS.md、记录决策 |
| `project-status.md` | 启动新会话 / 切换上下文 / 完成任务时 | 读 STATUS.md、同步进度、建立上下文基线 |
| `project-recall.md` | 用户问"上次做了什么"、"为什么这么选"时 | 搜归档、查决策链、输出历史摘要 |

装进 Agent 的方法：

```bash
# Claude Code
mkdir -p ~/.claude/skills
cp project-archive.md ~/.claude/skills/
cp project-status.md ~/.claude/skills/
cp project-recall.md ~/.claude/skills/
```

**不装 Skill 也能用** — 自己记住命令手动调用脚本就行。Skill 只是省了记忆成本。

---

## 技术决策记录（阶段总结）

| 决策 | 选择 | 原因 |
|------|------|------|
| 归档格式 | 平铺目录（无 YYYY-MM/ 嵌套） | 简化搜索，减少 shell 遍历层数 |
| 数据存储 | `~/.project-archive/` 全局目录 | 不在项目内，不污染 git 历史 |
| 并发安全 | `.status.lock` 文件锁 | 多 Agent 同时写 STATUS.md 不冲突 |
| 决策管理 | 单文件 JSON（`decisions.json`） | 避免多文件割裂，一次读入做完整决策树 |
| Agent 集成 | Skill 文件而非硬编码 | 不绑定特定 Agent，任何能读 md 的工具都能用 |
| 工具语言 | 纯 Python CLI | 不依赖特定运行时，跨平台 |

---

## 下载方式

| 方式 | 命令 |
|------|------|
| git clone | `git clone https://github.com/chentianxiong123/project-archive` |
| ZIP 下载 | GitHub 页面点 `Code → Download ZIP`，解压即用 |
| 仅核心脚本 | 只要 `core/` 目录就能跑，其他是说明书 |

---

## 版本历史

| 版本 | 日期 | 关键变化 |
|------|------|----------|
| v1 | 2026-05-26 | 初始版：嵌套目录、基础脚本 |
| v2 | 2026-05-26 | 重构为平铺结构，引入 decisions.json，重写 skill 为指令格式 |
| v2.1 | 2026-05-28 | 注入驱动架构（→ Hermes，见 hermes-loop 分支） |
| v3 | 2026-06-12 | 全新 Hermes 架构（n8n + tmux），归档工具封入历史 |

---

## 与 Hermes 的关系

地图归档是 Hermes 的**前置探索**。它解决了"记录"的问题，但实际使用中发现：

> 光是记录不够——Agent 之间需要实时协作和对证验证，而被动归档无法满足这个需求。

于是从地图归档演化出了 **Hermes 对证循环**（详见 `hermes-loop` 分支）。

本分支（`map-and-archive`）保留的是**归档工具本身**，供任何需要历史追溯的项目使用，不依赖 Hermes。

---

## License

MIT
