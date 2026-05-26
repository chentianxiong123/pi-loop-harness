# Project Archive — 全局归档地图系统

> 记录探索成果，构建可检索的开发历史地图

## 安装

```bash
# 1. 克隆或下载项目
git clone <repo-url> project-archive
cd project-archive

# 2. 一键初始化项目
python core/init-project.py /path/to/project

# 3. 或分步注册
python core/sync-archive.py --register /path/to/project-a
python core/sync-archive.py --register /path/to/project-b
python core/update-status.py init --project=project-name
```

## 目录结构

```
project-archive/
├── core/
│   ├── init-project.py        ← 项目一键初始化
│   ├── update-status.py      ← STATUS.md 管理（加锁）
│   ├── archive-search.py     ← 归档搜索/索引
│   ├── archive-decision.py   ← 决策树管理
│   ├── archive-validator.py  ← 归档格式校验
│   └── sync-archive.py       ← 项目注册/同步
├── adapters/
│   ├── claude-code.md        ← CC skill 格式
│   ├── codex.md              ← Codex skill 格式
│   └── generic.md            ← 通用格式
├── references/
│   └── archive-template.md   ← 归档模板
├── project-archive.md        ← Skill 1: 归档
├── project-status.md         ← Skill 2: STATUS 管理
└── project-recall.md         ← Skill 3: 检索回看
```

## 使用方式

### 1. 注册项目

```bash
python core/sync-archive.py --register /path/to/project
```

### 2. 归档（session 结束时）

```bash
# 写归档文件（手动或使用 project-archive skill）
# 然后更新 STATUS.md
python core/update-status.py add-archive "2026-05-26--feat--xxx.md"
python core/update-status.py mark-done "前端历史消息懒加载"
```

### 3. 检索

```bash
# 当前项目
python core/archive-search.py "chat"

# 全局
python core/archive-search.py --global "SSE"

# 生成索引
python core/archive-search.py --index --global
```

## 存储位置

所有数据存储在 `~/.project-archive/`：

```
~/.project-archive/
├── projects.json
├── projects/
│   ├── project-a/
│   │   ├── STATUS.md
│   │   ├── archive/
│   │   ├── decisions.json
│   │   └── .status.lock
│   └── project-b/
│       ├── STATUS.md
│       ├── archive/
│       ├── decisions.json
│       └── .status.lock
├── timeline.md
├── decisions.md
└── tech-stack.md
```

## 发行

### Claude Code

```bash
cp project-archive.md ~/.claude/skills/
cp project-status.md ~/.claude/skills/
cp project-recall.md ~/.claude/skills/
```

### 其他 Agent

在 `adapters/` 中选择对应格式的 skill 文件。

## License

MIT