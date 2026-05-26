# Project Archive · Claude Code Adapter

将 project-archive 的三个 skill 按 CC 格式分拆。

## 安装

```bash
mkdir -p ~/.claude/skills
cp project-archive.md ~/.claude/skills/
cp project-status.md ~/.claude/skills/
cp project-recall.md ~/.claude/skills/
```

## 触发规则

| Skill | 触发 |
|---|---|
| project-archive | "归档"、"存档"、"完成了"、"零错误" + 改动表格 |
| project-status | "看看状态"、"更新状态"、"加个待办" |
| project-recall | "以前怎么做"、"找找历史"、"技术栈"、"决策" |

## 关联工具

| 工具 | 用途 |
|---|---|
| `init-project.py` | 一键初始化新项目 |
| `archive-decision.py` | 决策树管理（append / show） |
| `archive-validator.py` | 归档文件格式校验 |

## CC 特定配置

路径指向全局存储 `~/.project-archive/`。

CC 通过 `core/update-status.py` 管理 STATUS.md。
CC 通过 `core/archive-search.py` 检索归档。