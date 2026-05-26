# 地图归档 (project-archive)

> **地图归档** — 记录探索成果，构建可检索的开发历史地图
> 仓库名 `project-archive`，口头就叫"地图归档"

## 安装

```bash
# 1. 克隆或下载项目
# git clone <repo-url> project-archive
# cd project-archive

# 2. 设置路径（在 ~/.claude/CLAUDE.md 或项目 CLAUDE.md 中）
export PROJECT_ARCHIVE_PATH="/path/to/project-archive"

# 3. 注册你的项目
python $PROJECT_ARCHIVE_PATH/core/init-project.py /path/to/project

# 或分步
python $PROJECT_ARCHIVE_PATH/core/sync-archive.py --register /path/to/project-a
python $PROJECT_ARCHIVE_PATH/core/update-status.py init --project=project-a

# 4. 安装 skill（Claude Code）
mkdir -p ~/.claude/skills
cp project-archive.md ~/.claude/skills/
cp project-status.md ~/.claude/skills/
cp project-recall.md ~/.claude/skills/
```

## 路径设置

在使用 project-archive 的 Agent 配置中（如 `~/.claude/CLAUDE.md`）添加：

```bash
# project-archive 工具路径
export PROJECT_ARCHIVE_PATH="/home/user/project-archive"
```

在所有 skill 和脚本调用中，必须使用 `$PROJECT_ARCHIVE_PATH/core/` 而非相对路径。

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
├── adapters/
│   ├── claude-code.md          ← CC skill 格式
│   ├── codex.md                ← Codex skill 格式
│   └── generic.md              ← 通用格式
├── references/
│   └── archive-template.md     ← 归档模板
├── project-archive.md          ← Skill 1: 归档
├── project-status.md           ← Skill 2: STATUS 管理
└── project-recall.md           ← Skill 3: 检索回看
```

## 使用方式

所有命令通过 `$PROJECT_ARCHIVE_PATH` 调用：

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

## 发行

### Claude Code

```bash
# 1. 安装 skill
cp project-archive.md ~/.claude/skills/
cp project-status.md ~/.claude/skills/
cp project-recall.md ~/.claude/skills/

# 2. 在 CLAUDE.md 中设置路径
echo 'export PROJECT_ARCHIVE_PATH="$HOME/project-archive"' >> ~/.claude/CLAUDE.md
```

### 其他 Agent

在 `adapters/` 中选择对应格式的适配器文件。

## License

MIT