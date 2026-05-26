# Project Status

管理 `~/.project-archive/projects/<项目名>/STATUS.md` 的共享状态。

## 存储位置

```
~/.project-archive/projects/<项目名>/STATUS.md
```

## STATUS.md 结构

```
# <项目名>
> 更新: YYYY-MM-DD HH:MM

## 当前上下文           ← 给下一位 Agent 的"开机说明"
<<<
正在做什么、卡在哪里、下一步
>>>

## 关键决策（活跃）     ← 从 decisions.json 自动刷新

## 进行中               ← 谁在做什么

## 待办                 ← 未开始

## 已完成（近期）        ← 最多 10 条，自动截断

## 归档
```

## 使用方式

所有更新通过 `core/update-status.py` 脚本执行，**不要直接编辑 STATUS.md**。

```bash
# 初始化
python core/update-status.py init

# 查看
python core/update-status.py status

# 设置上下文（异步交接用）
python core/update-status.py set-context "正在做 chat 迁移，卡在游标分页"

# 添加/更新
python core/update-status.py add-todo "前端历史消息懒加载"
python core/update-status.py mark-doing "前端历史消息懒加载"
python core/update-status.py mark-done "前端历史消息懒加载"

# 决策联动
python core/update-status.py refresh-decisions

# 归档联动
python core/update-status.py add-archive "2026-05-26--feat--chat-migration.md"
```

## 锁机制

- 锁文件：`.status.lock`
- 锁类型：文件级别排他锁
- 锁超时：15 秒（僵尸锁自动回收）
- 冲突处理：排队等待

## 多项目支持

```bash
python core/update-status.py status --project=project-a
python core/update-status.py add-todo "..." --project=project-b
```

## 会话结束职责

每次会话结束前，Agent 必须：
1. 更新"当前上下文"块（给下一个 Agent 交接）
2. 如有完成项，调用 `mark-done`
3. 如有归档，调用 `add-archive`
4. 如有决策变更，调用 `archive-decision.py append` + `refresh-decisions`