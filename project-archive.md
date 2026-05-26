# Project Archive

> 归档地图系统 — 全局存储，记录所有项目的开发历史

## 存储位置

所有归档和状态文件存储在 `~/.project-archive/`：

```
~/.project-archive/
├── projects.json                    ← 注册的项目列表
├── projects/
│   ├── <项目名>/
│   │   ├── STATUS.md               ← 项目当前状态（含提示词）
│   │   ├── archive/                ← 归档文件（平铺）
│   │   ├── decisions.json          ← 全部决策树
│   │   └── .status.lock            ← 锁文件（多 Agent）
│   └── ...
├── timeline.md                      ← 全项目合并时间线
├── decisions.md                     ← 全项目合并决策
└── tech-stack.md                    ← 全项目合并技术栈
```

## 首次使用

```bash
# 一键初始化
python core/init-project.py /path/to/project

# 或分步：
# python core/sync-archive.py --register /path/to/project
# python core/update-status.py init --project=project-name
```

## 归档文件规范

```
YYYY-MM-DD--category--topic.md

分类: feat, fix, test, design, spike, refactor, ops, docs, env
```

## 触发条件

当用户完成一个功能模块并产生总结输出时，**自动触发归档流程**。

触发信号：
- 用户说："归档"、"存档"、"记录一下"
- 用户输出包含完成总结（改动清单表格 + "完成了"/"做完了"）
- 用户输出包含"效果："段落

## 归档流程

### 1. 检测完成信号
当用户输出包含以下任一特征时：
- 改动清单表格（3+ 文件改动）
- "零新增错误"、"零错误"
- "完成"、"做完了"
- "效果："段落

### 2. 生成归档建议

```
文件名：YYYY-MM-DD--分类--主题.md
```

### 3. 确认后写入文件

文件位置：`~/.project-archive/projects/<项目名>/archive/`

```markdown
# YYYY-MM-DD · 主题

> ✅完成 | 分类 | 涉及范围

## 探索成果
- 从用户输出中提取
- 3-8 条，动词开头

## 技术栈
- 从改动文件中提取关键词
- 3-8 个关键词

## 关键决策
- 做法 + 原因
- 如果引入了新决策，执行 archive-decision.py append

## 变更
文件: +新增 · ~修改 · -删除
```

### 4. 归档后处理

**必须执行：**
```bash
# 1. 更新 STATUS.md
python core/update-status.py add-archive "YYYY-MM-DD--feat--xxx.md"
python core/update-status.py mark-done "功能名称"

# 2. 如有决策变更
python core/archive-decision.py append <decision-id> \
  --not "..." --but "..." --type supersede --supersedes N \
  --source "archive/YYYY-MM-DD--feat--xxx.md"
python core/update-status.py refresh-decisions

# 3. 同步选项
python core/sync-archive.py --push /path/to/project
```

## 检索

```bash
# 当前项目
python core/archive-search.py "chat"

# 全局搜索（所有项目）
python core/archive-search.py --global "SSE"

# 按分类
python core/archive-search.py --category feat

# 生成全局索引
python core/archive-search.py --index --global
```

## 注意事项

1. **不要**在归档里写"下一阶段"、"后续计划" — 属于 STATUS.md
2. **不要**贴详细代码 — git log 更准
3. 归档文件创建后，**必须**调用 update-status.py 更新 STATUS.md
4. 决策变更时，**必须**调用 archive-decision.py 记录再刷新 STATUS.md