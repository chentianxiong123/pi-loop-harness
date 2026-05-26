# 地图归档 (project-archive)

> **地图归档** — 记录探索成果，构建可检索的开发历史地图
> 仓库名 `project-archive`，口头就叫"地图归档"

## 安装

```bash
# 1. 下载地图归档（见下方"下载方式"）
cd project-archive

# 2. 设置路径（在任何 Agent 的配置文件中）
export PROJECT_ARCHIVE_PATH="/path/to/project-archive"

# 3. 注册你的项目
python $PROJECT_ARCHIVE_PATH/core/init-project.py /path/to/project
```

## 目录结构

```
project-archive/
├── core/
│   ├── init-project.py         ← 项目一键初始化
│   ├── update-status.py        ← STATUS.md 管理（加锁）
│   ├── archive-search.py       ← 归档搜索/索引
│   ├── archive-decision.py     ← 决策树管理
│   ├── archive-validator.py    ← 归档格式校验
│   └── sync-archive.py         ← 项目注册/同步
├── references/
│   └── archive-template.md     ← 归档模板
├── project-archive.md          ← Skill 1: 归档
├── project-status.md           ← Skill 2: STATUS 管理
└── project-recall.md           ← Skill 3: 检索回看
```

## 使用方式

核心是 **6 个纯 Python CLI 脚本**，任何 Agent（Claude、Codex、GPT 等只要能执行 shell 命令）都能调用：

```bash
# 初始化项目
python $PROJECT_ARCHIVE_PATH/core/init-project.py /path/to/project

# 归档
python $PROJECT_ARCHIVE_PATH/core/update-status.py add-archive "2026-05-26--feat--xxx.md"
python $PROJECT_ARCHIVE_PATH/core/update-status.py mark-done "功能名称"

# 记录决策
python $PROJECT_ARCHIVE_PATH/core/archive-decision.py append <id> --not "..." --but "..." --type initial
python $PROJECT_ARCHIVE_PATH/core/update-status.py refresh-decisions

# 检索
python $PROJECT_ARCHIVE_PATH/core/archive-search.py "chat"
python $PROJECT_ARCHIVE_PATH/core/archive-search.py --global "SSE"

# 校验
python $PROJECT_ARCHIVE_PATH/core/archive-validator.py --project=<项目名>
```

## 存储位置

所有数据存储在 `~/.project-archive/`：

```
~/.project-archive/
├── projects.json
├── projects/
│   ├── project-a/
│   │   ├── STATUS.md
│   │   ├── archive/          ← 平铺归档文件
│   │   ├── decisions.json    ← 决策树
│   │   └── .status.lock      ← 多 Agent 锁
│   └── project-b/
├── timeline.md
├── decisions.md
└── tech-stack.md
```

## 3 个 Skill

Skill 是 Agent（AI 助手）的说明书文件，告诉它"什么时候该干什么"。地图归档本身是 **Python 脚本**，Skill 只是教 Agent 怎么调用这些脚本。

**你用地图归档只需要两样东西：**
1. **`core/` 里的 Python 脚本** — 跑命令用
2. **3 个 `.md` Skill 文件** — 装进 Agent 让它知道怎么帮你调用脚本

| Skill 文件 | 什么时候用 | 干什么 |
|-------|-----------|--------|
| `project-archive.md` | 模块做完时 | 写归档、更新状态、记录决策 |
| `project-status.md` | 启动/切换/结束时 | 读上下文、同步进度 |
| `project-recall.md` | 用户问历史时 | 搜归档、查决策链 |

装进 Agent 的方法也很简单——直接把 .md 文件复制到 Agent 的 skill 目录：

```bash
# Claude Code 示例
mkdir -p ~/.claude/skills
cp project-archive.md ~/.claude/skills/
cp project-status.md ~/.claude/skills/
cp project-recall.md ~/.claude/skills/
```

**任何 Agent 都能用** — 不装 Skill 也能用，自己记住命令手动调用脚本就行。Skill 只是省了记忆成本。

## 下载方式

| 方式 | 命令 |
|------|------|
| git clone | `git clone https://github.com/chentianxiong123/-project-archive.git` |
| ZIP 下载 | GitHub 页面点 `Code → Download ZIP`，解压即用 |
| 仅核心脚本 | 只要 `core/` 目录就能跑，其他是说明书 |

## License

MIT