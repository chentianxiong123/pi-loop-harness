# Project Archive · Claude Code Adapter

将 project-archive 的三个 skill 按 CC 格式分拆。

## 安装

```bash
mkdir -p ~/.claude/skills
cp project-archive.md ~/.claude/skills/
cp project-status.md ~/.claude/skills/
cp project-recall.md ~/.claude/skills/

# 在 ~/.claude/CLAUDE.md 中设置路径
echo 'export PROJECT_ARCHIVE_PATH="$HOME/project-archive"' >> ~/.claude/CLAUDE.md
```

## 触发规则

| Skill | 触发 | 不触发 |
|---|---|---|
| project-archive | "归档"、"完成了"、"零错误" + 改动表格 | 还没做完、随口问 |
| project-status | Agent 启动、"看看状态"、"现在到哪了" | 只问代码细节 |
| project-recall | "以前怎么做"、"找找历史"、"决策" | 当前代码问题、常识问题 |

## 关联工具

| 工具 | 用途 | 调用方式 |
|---|---|---|
| `init-project.py` | 一键初始化新项目 | `$PROJECT_ARCHIVE_PATH/core/init-project.py /path` |
| `archive-decision.py` | 决策树管理（append / show） | `$PROJECT_ARCHIVE_PATH/core/archive-decision.py append <id> ...` |
| `archive-validator.py` | 归档文件格式校验 | `$PROJECT_ARCHIVE_PATH/core/archive-validator.py --project=<name>` |

## CC 特定配置

所有工具调用必须通过 `$PROJECT_ARCHIVE_PATH` 环境变量定位，**不要使用**相对路径。

CLAUDE.md 示例：

```
# 全局配置
export PROJECT_ARCHIVE_PATH="/home/user/project-archive"