# Project Status

> 多 Agent 共享状态管理 — 双层 STATUS.md 架构
> 依赖：`$PROJECT_ARCHIVE_PATH` 已设置（见 project-archive skill）

## 存储位置

```
~/.project-archive/projects/<项目名>/
├── STATUS.md                 ← 项目级（Hermes 管理）
├── workspaces/
│   ├── ws001/
│   │   └── STATUS.md         ← 工作间级（CC/Codex 写）
│   └── ws002/
│       └── STATUS.md
└── events/
    └── commit.log            ← 事件日志（hook 写入）
    └── .last-processed       ← watcher 处理标记
    └── .decision-*.json      ← 路由决策
```

## 项目 STATUS.md 结构

```
# <项目名>
> 更新: YYYY-MM-DD HH:MM

## 当前上下文
<<< 正在做什么、卡在哪里、下一步 >>>

## 工作间状态
- ws001: jwt-auth → completed（2轮通过）
- ws002: permission → in-progress（第1轮，CC 执行中）
- ws003: test → pending

## 关键决策（活跃）

## 已完成（近期）
*（无）*

## 归档
*（无）*
```

## 工作间 STATUS.md 结构

```
# ws001 — jwt-auth
> 分支: ws/ws001-jwt-auth
> 创建: YYYY-MM-DD

## 任务
任务描述

## 约束
约束条件

## 迭代记录
| 轮次 | CC 做了什么 | Codex 审了什么 | 结论 |
|------|-------------|----------------|------|

## 审查意见（最新）
- 

## 状态
created / in-progress / completed / escalated
```

## 当触发

- Agent **首次接触项目时**：必须读项目 STATUS.md
- Agent **进入工作间时**：必须读工作间 STATUS.md
- 用户说："看看状态"、"现在做到哪了"
- **多 Agent 交接**：前后 Agent 都必须读写对应层级的 STATUS.md

## 不要触发

- 用户只问代码细节，不涉及进度
- 用户明确说"不用记"

## Agent 执行清单

### 首次启动（Hermes）

- [ ] **1. 读项目 STATUS.md**
    ```bash
    python "$PROJECT_ARCHIVE_PATH/core/update-status.py" status --project=<项目名>
    ```

### CC/Codex 进入工作间

- [ ] **1. 读工作间 STATUS.md**
    ```bash
    python "$PROJECT_ARCHIVE_PATH/core/update-status.py" status --workspace=<工作间ID> --project=<项目名>
    ```

### 完成工作时

- [ ] **2. 更新工作间 STATUS.md**
    ```bash
    python "$PROJECT_ARCHIVE_PATH/core/update-status.py" add-review-log \
      "1 | CC | done | 完成 JWT 签发" --workspace=<工作间ID> --project=<项目名>
    ```

- [ ] **3. 标记状态**
    ```bash
    python "$PROJECT_ARCHIVE_PATH/core/update-status.py" set-status completed \
      --workspace=<工作间ID> --project=<项目名>
    ```

## 锁机制

| 属性 | 说明 |
|------|------|
| 锁文件 | `~/.project-archive/projects/<项目名>/.status.lock` |
| 锁类型 | 文件级别排他锁（`os.open` + `O_EXCL`） |
| 锁超时 | 15 秒，僵尸锁自动回收 |
| 冲突处理 | 排队等待，超时后提示"稍后重试" |

### 多 Agent 防冲突规则

1. **读不需要锁** — 任意数量 Agent 可以同时读
2. **写必须排队** — 每次写操作都通过 `update-status.py` 自动加锁
3. **写后立即释放** — 锁只在单次操作期间持有
4. **项目级和工作间级独立锁** — 不同层级的写入互不阻塞

## 注意事项

1. **不要直接编辑 STATUS.md** — 必须通过 update-status.py
2. **项目 STATUS.md 由 Hermes 管理** — CC/Codex 只写工作间 STATUS.md
3. 如果获取锁失败：等几秒再试
