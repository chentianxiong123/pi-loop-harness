# 地图归档 (project-archive)

> **地图归档** — 记录探索成果，构建可检索的开发历史地图
> 仓库名 `project-archive`，口头就叫"地图归档"

## 安装

```bash
# 1. 下载地图归档
cd project-archive

# 2. 设置路径
export PROJECT_ARCHIVE_PATH="/path/to/project-archive"

# 3. 注册你的项目
python $PROJECT_ARCHIVE_PATH/core/init-project.py /path/to/project

# 4. 安装 Git hook（在你的项目目录下）
cp $PROJECT_ARCHIVE_PATH/core/hooks/post-commit .git/hooks/post-commit
```

## 目录结构

```
project-archive/
├── core/                           ← Python + PowerShell 脚本
│   ├── init-project.py             ← 项目一键初始化
│   ├── update-status.py            ← STATUS.md 管理（含工作间支持）
│   ├── archive-search.py           ← 归档搜索/索引
│   ├── archive-decision.py         ← 决策树管理
│   ├── archive-validator.py        ← 归档格式校验
│   ├── sync-archive.py             ← 项目注册/同步
│   ├── workspace.py                ← 工作间管理
│   ├── dispatch.py                 ← CC/Codex 终端窗口派发
│   ├── trigger_server.py           ← 事件路由决策器
│   ├── watcher.py                  ← 事件监听 + 超时检测 + 注入 Hermes
│   ├── spawn-agent-window.ps1      ← 创建 WT 终端窗口启动 CC/Codex
│   ├── inject-target.ps1           ← 通用注入脚本（Named Mutex 排队）
│   └── hooks/
│       └── post-commit             ← Git hook 模板（写 commit.log）
├── prompts/                        ← Prompt 模板
│   └── event-handling.md           ← 事件处理 + 超时处理模板
├── references/
│   ├── archive-template.md         ← 归档模板
│   └── injection-tech.md           ← 注入技术参考
├── project-archive.md              ← Skill: 归档（Hermes 专属）
├── project-recall.md               ← Skill: 检索（Hermes 专属）
├── project-status.md               ← Skill: 状态同步（双层 STATUS.md）
├── project-coordinate.md           ← Skill: 协作协议（工作间+对证循环）
└── project-hermes.md               ← Skill: Hermes 行为规范
```

## 架构

地图归档通过 **Windows 终端注入** 驱动多 Agent 协作：Hermes（大脑）、CC（手）、Codex（眼）。

```
用户 ←→ Hermes（常驻交互式终端）
  │
  │  用户派发任务
  ▼
Hermes → dispatch.py → spawn CC 终端窗口 → 注入 prompt → CC 写代码
  │
  ▼
CC commit → post-commit hook → 写 commit.log
  │
  ▼
watcher.py 检测到事件 → 注入到 Hermes 终端
  │
  ▼
Hermes 读事件 → dispatch.py → spawn Codex 终端窗口 → 注入审查 prompt
  │
  ▼
Codex 审查 + commit → hook → watcher → 注入 Hermes
  │
  ├─ REVIEW-FAIL → Hermes 注入修复 prompt 到 CC → 循环（≤5 轮）
  └─ REVIEW-PASS → Hermes 执行归档
```

### 核心机制

| 机制 | 说明 |
|------|------|
| 终端注入 | `AttachThreadInput` + `keybd_event` + 剪贴板，后台注入文字到目标终端 |
| Named Mutex | `Global\HermesInjectMutex` 排队，确保并发注入顺序执行 |
| 事件文件 | hook 写 `commit.log`，watcher 轮询检测，通过 `.last-processed` 去重 |
| 超时检测 | dispatch 后开始计时，30 分钟无事件自动注入超时警告 |

### 角色

| 角色 | 底层 | 启动方式 | 做什么 | 不做什么 |
|------|------|----------|--------|----------|
| Hermes | 独立 agent | 你手动打开终端 | 需求对齐、编排、调度、终审、归档 | 不写代码 |
| CC | Claude Code | `spawn-agent-window.ps1` 创建 WT 窗口 | 写代码、修复、commit | 不归档、不终审 |
| Codex | Codex CLI | `spawn-agent-window.ps1` 创建 WT 窗口 | 审查代码、找问题、commit | 不归档、不终审 |

### 三签制

```
CC（commit）→ Codex（REVIEW-PASS/FAIL）→ Hermes 终审 → 归档
```

只有 Hermes 能归档。CC 和 Codex 都不能直接写 archive/。

### 权限矩阵

| 能力 | Hermes | CC | Codex |
|------|--------|----|-------|
| 读 STATUS.md | ✓ | ✓ | ✓ |
| 写工作间 STATUS.md | ✓ | ✓ | ✓ |
| 写代码文件 | ✗ | ✓ | ✓ |
| git commit | ✗ | ✓ | ✓ |
| 归档 archive/ | ✓ | ✗ | ✗ |
| 检索 recall | ✓ | ✗ | ✗ |
| 创建工作间 | ✓ | ✗ | ✗ |
| spawn 终端窗口 | ✓ | ✗ | ✗ |
| 注入文字 | ✓ | ✗ | ✗ |

## 启动方式

### 1. 启动 watcher（后台常驻）

```bash
python $PROJECT_ARCHIVE_PATH/core/watcher.py --project YourProject --watch --interval 2
```

### 2. 启动 Hermes 终端

Hermes 是常驻交互式终端。启动后直接对话即可。

### 3. Hermes 自动工作

Hermes 会：
- 跟你对齐需求
- 查历史归档（`archive-search.py`）
- 拆任务创建工作间（`workspace.py create`）
- 用 `dispatch.py spawn-cc/spawn-codex` 派发任务到新终端窗口
- watcher 监听事件自动注入到 Hermes 终端
- 终审 + 归档

### 最小启动

```
终端 1: watcher.py --watch（常驻，轮询事件文件）
终端 2: Hermes（常驻交互式终端）
其余: CC/Codex 由 dispatch.py 自动 spawn 为新 WT 窗口
```

## 5 个 Skill

| Skill 文件 | 谁用 | 什么时候用 | 干什么 |
|-------|------|-----------|--------|
| `project-archive.md` | **仅 Hermes** | 审查达成后 | 归档到 archive/ |
| `project-recall.md` | **仅 Hermes** | 新任务开始前 | 搜归档、查决策链 |
| `project-status.md` | 所有 Agent | 启动/切换/结束时 | 读写双层 STATUS.md |
| `project-coordinate.md` | Hermes | 全流程 | 协作协议、工作间规则、commit 规范 |
| `project-hermes.md` | Hermes | 全流程 | 行为规范、调度、纠偏、归档 |

## 工具使用

```bash
# 工作间管理
python $PROJECT_ARCHIVE_PATH/core/workspace.py create ws001-jwt-auth --project=X --task "实现 JWT 认证"
python $PROJECT_ARCHIVE_PATH/core/workspace.py list --project=X

# 派发 CC/Codex（自动 spawn 终端窗口 + 注入 prompt）
python $PROJECT_ARCHIVE_PATH/core/dispatch.py spawn-cc --workspace=ws001 --project=X --prompt "..." --session-id "uuid"
python $PROJECT_ARCHIVE_PATH/core/dispatch.py spawn-codex --workspace=ws001 --project=X --prompt "..." --session-id "uuid"

# 事件监听
python $PROJECT_ARCHIVE_PATH/core/watcher.py --project=X --watch --interval 2 --timeout 1800
python $PROJECT_ARCHIVE_PATH/core/watcher.py --project=X --once  # 单次检查

# 归档
python $PROJECT_ARCHIVE_PATH/core/update-status.py add-archive "2026-05-26--feat--xxx.md"

# 检索
python $PROJECT_ARCHIVE_PATH/core/archive-search.py "chat" --global

# 校验
python $PROJECT_ARCHIVE_PATH/core/archive-validator.py --project=X
```

## 存储位置

```
~/.project-archive/
├── projects.json
├── projects/
│   ├── project-a/
│   │   ├── STATUS.md                 ← 项目级状态
│   │   ├── archive/                  ← 归档文件
│   │   ├── decisions.json            ← 决策树
│   │   ├── events/
│   │   │   ├── commit.log            ← 事件日志
│   │   │   ├── .last-processed       ← 已处理标记
│   │   │   └── .dispatch-state       ← 超时计时状态
│   │   └── workspaces/
│   │       ├── ws001/
│   │       │   ├── STATUS.md         ← 工作间状态
│   │       │   └── branch            ← 分支名
│   │       └── ws002/
│   └── project-b/
```

## 不装 Skill 也能用

地图归档的核心是 **Python 脚本**，任何 Agent 都能调用。Skill 只是省了记忆成本。

## 下载方式

| 方式 | 命令 |
|------|------|
| git clone | `git clone https://gitee.com/tianxiong123/project-archive.git` |
| ZIP 下载 | Gitee 页面点 `克隆/下载 → 下载ZIP`，解压即用 |
| 仅核心脚本 | 只要 `core/` 目录就能跑，其他是说明书 |

## License

MIT
