# Project Status

> 多 Agent 共享状态管理 — 读取 STATUS.md 了解上下文，写入 STATUS.md 同步进度
> 依赖：`$PROJECT_ARCHIVE_PATH` 已设置（见 project-archive skill）

## 存储位置

```
~/.project-archive/projects/<项目名>/STATUS.md
```

## STATUS.md 结构

```
# <项目名>
> 更新: YYYY-MM-DD HH:MM

## 当前上下文           ← 给下一位 Agent 的"开机说明"
<<< 正在做什么、卡在哪里、下一步 >>>

## 关键决策（活跃）     ← 从 decisions.json 自动刷新

## 进行中               ← 谁在做什么

## 待办                 ← 未开始

## 已完成（近期）        ← 最多 10 条，自动截断

## 归档
```

## 当触发

- Agent **首次接触项目时**：必须读 STATUS.md
- 用户说："看看状态"、"现在做到哪了"、"有什么待办"
- Agent **会话结束前**：必须更新 STATUS.md
- **多 Agent 交接**：前后 Agent 都必须读写

## 不要触发

- 用户只问代码细节，不涉及进度
- 用户明确说"不用记"

## Agent 执行清单

### 首次启动

- [ ] **1. 读 STATUS.md**
    ```bash
    python "$PROJECT_ARCHIVE_PATH/core/update-status.py" status --project=<项目名>
    ```
    - 理解"当前上下文"（卡在哪、下一步）
    - 看"关键决策"（避免违反架构约定）
    - 看"进行中"（避免重复工作）

### 会话中

- [ ] **2. 开始做某项工作时（标记进行中）**
    ```bash
    python "$PROJECT_ARCHIVE_PATH/core/update-status.py" mark-doing "功能名称" --project=<项目名>
    ```
    - 这一步**必须获取锁**（锁机制自动执行）
    - 如果锁超时：等待或换个任务做

### 会话结束

- [ ] **3. 完成的任务（标记已完成）**
    ```bash
    python "$PROJECT_ARCHIVE_PATH/core/update-status.py" mark-done "功能名称" --project=<项目名>
    ```

- [ ] **4. 更新当前上下文（给下一位 Agent）**
    ```bash
    python "$PROJECT_ARCHIVE_PATH/core/update-status.py" set-context \
      "已完成：X。当前卡点：Y。建议下一位从 Z 开始。" --project=<项目名>
    ```

- [ ] **5. 如有归档，添加引用**
    ```bash
    python "$PROJECT_ARCHIVE_PATH/core/update-status.py" add-archive "YYYY-MM-DD--feat--xxx.md" --project=<项目名>
    ```

- [ ] **6. 如有决策变更，刷新决策区**
    ```bash
    python "$PROJECT_ARCHIVE_PATH/core/update-status.py" refresh-decisions --project=<项目名>
    ```

## 锁机制

| 属性 | 说明 |
|------|------|
| 锁文件 | `~/.project-archive/projects/<项目名>/.status.lock` |
| 锁类型 | 文件级别排他锁（`os.open` + `O_EXCL`） |
| 锁超时 | 15 秒，僵尸锁自动回收 |
| 冲突处理 | 排队等待，超时后提示"稍后重试" |

### 多 Agent 防冲突规则

1. **读不需要锁** —— 任意数量 Agent 可以同时读
2. **写必须排队** —— 每次写操作（mark-doing/mark-done/add-todo/add-archive/set-context）都通过 `update-status.py` 自动加锁
3. **写后立即释放** —— 锁只在单次操作期间持有，不会跨操作

这个锁机制确保即使多个 Agent 同时在修改 STATUS.md 的不同区块，也不会产生写入冲突或数据损坏。

## 多项目支持

```bash
python "$PROJECT_ARCHIVE_PATH/core/update-status.py" status --project=project-a
python "$PROJECT_ARCHIVE_PATH/core/update-status.py" add-todo "..." --project=project-b
```

## 注意事项

1. **不要直接编辑 STATUS.md** - 必须通过 update-status.py
2. 已完成超过 10 条自动截断（旧记录在 archive 里，不会丢）
3. 如果获取锁失败：等几秒再试，或换个项目做