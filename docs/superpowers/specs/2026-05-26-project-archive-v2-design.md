# Project Archive v2 — 全局归档地图系统

> 设计文档 | 2026-05-26

## 问题

1. Archive 分层 `YYYY-MM/` 过度设计，搜索和浏览都不需要这层
2. 决策没有独立的追踪机制，散落在归档中无法形成试错链
3. STATUS.md 职责不清晰，堆积历史导致信息密度低
4. 多 Agent 并发需要更明确的读写边界

## 架构

```
~/.project-archive/projects/<项目名>/
├── STATUS.md                  ← 当前状态 + 近期提示词
├── archive/                   ← 平铺，所有归档扁平化
│   ├── 2026-05-26--feat--chat-module-migration.md
│   ├── 2026-06-01--design--think-history.md
│   └── ...
├── decisions.json             ← 单文件，全部决策，树结构
├── .status.lock               ← 锁文件（多 Agent 防冲突）
```

## Archive 结构

### 文件名规范

```
YYYY-MM-DD--category--topic.md

分类: feat, fix, test, design, spike, refactor, ops, docs, env
```

### 归档内容模板

```markdown
# YYYY-MM-DD · 主题

> ✅完成 | 分类 | 涉及范围

## 探索成果
- 3-8 条，动词开头

## 技术栈
- 3-8 个关键词

## 关键决策
- 引入新决策或变更已有决策时，指向 decisions.json

## 变更
文件: +新增 · ~修改 · -删除
```

## Decisions JSON 结构

### 数据模型

```json
{
  "decisions": [
    {
      "id": "think-chain-storage",
      "title": "思考链存储",
      "tags": ["chat", "DB"],
      "entries": [
        {
          "seq": 1,
          "date": "2026-05-26",
          "type": "initial",
          "not": "把思考链存到 DB",
          "but": "不存，保持查询快",
          "source": "archive/2026-05-26--design--chat-architecture.md"
        },
        {
          "seq": 2,
          "date": "2026-06-01",
          "type": "supersede",
          "supersedes": 1,
          "not": "思考链不存 DB",
          "but": "改为独立 think 表，用户需追溯",
          "source": "archive/2026-06-01--feat--think-history.md"
        },
        {
          "seq": 3,
          "date": "2026-07-15",
          "type": "supplement",
          "supplements": 2,
          "not": "think 表永久保留",
          "but": "加 30 天 TTL，避免膨胀",
          "source": "archive/2026-07-15--ops--think-table-ttl.md"
        }
      ],
      "relates_to": ["chat-arch"]
    }
  ]
}
```

### 关系类型

| type | 含义 | 对旧记录 | 效果 |
|------|------|----------|------|
| initial | 初始决定 | — | 第一条 |
| supersede | 推翻了旧决定 | supersedes: N | 旧记录 ←已推翻 |
| supplement | 在当前决定上加强/细化 | supplements: N | 旧记录 ←有补充 |
| relate | 跨决策关联 | — | 仅标记关联 |

### 决策链 CLI（archive-decision.py）

追加：
```
python core/archive-decision.py append think-chain-storage \
  --not "思考链不存 DB" \
  --but "改为独立 think 表" \
  --type supersede --supersedes 1 \
  --source "archive/2026-06-01--feat--think-history.md"
```

查看：
```
python core/archive-decision.py show think-chain-storage
```

状态摘要（供 STATUS.md 使用）：
```
python core/archive-decision.py status
# → 思考链：不存 DB ❌ → 独立 think 表 ✅
```

## STATUS.md 结构

```markdown
# <项目名>
> 更新: 2026-06-01 14:30 | 最后修改: Agent-A

## 当前上下文
<<<
正在做什么、卡在哪里、下一步
交给新 Agent 时看的"开机说明"
>>>

## 关键决策（活跃）
- 思考链：独立 think 表 ✅ · TTL 30 天 ✅
- chat 架构：chat/conversation 分离 ✅

## 进行中
- [ ] 当前任务（谁在做）

## 待办
- [ ] 未开始的任务

## 已完成（近期 N 条）
- ✅ 已完成任务

## 归档
- archive/2026-05-26--feat--xxx.md
```

### 每个块的职责

| 块 | 读写方式 | 多 Agent 策略 |
|----|----------|---------------|
| 当前上下文 | AI 直接写 | 异步：下一个 Agent 读 |
| 关键决策 | 用 archive-decision.py（自动生成） | 只读，决策链工具管 |
| 进行中 | 用 update-status.py mark-doing（加锁） | 同步：锁防冲突 |
| 待办 | 用 update-status.py add-todo（加锁） | 同步：锁防冲突 |
| 已完成 | 用 update-status.py mark-done（加锁） | 超过 10 条自动截断 |
| 归档 | 用 update-status.py add-archive（加锁） | 同步：锁防冲突 |

## 多 Agent 协同策略

### 异步（默认）

Agent 完成工作后，更新 STATUS.md 的"当前上下文"块，让下一个 Agent 接班。无锁操作。

### 同步（并发）

通过 `update-status.py` 的 `.status.lock` 实现：
1. Agent A 获取锁 → 读 STATUS.md → 看"进行中"没人做 X → 写 mark-doing → 释放锁
2. Agent B 获取锁 → 读 STATUS.md → 看"进行中"X 被 A 占 → 干别的

锁超时 15 秒，僵尸锁自动回收。

### AI 读写规则

- STATUS.md：AI 直接读 ✗，通过 update-status.py 写 ✓（锁）
- archive/*.md：AI 直接读 ✗，直接写 ✗（纯文本，无锁）
- decisions.json：AI 通过 archive-decision.py 读写 ✓（JSON 不可裸编辑）

## 待实现清单

1. [x] 设计文档（本文档）
2. [ ] archive-decision.py — 决策链管理
3. [ ] 重构 update-status.py — 新 STATUS.md 布局
4. [ ] archive 平铺迁移 — 去 YYYY-MM/ 层
5. [ ] init-project.py — 一键初始化
6. [ ] archive-validator.py — 归档校验
7. [ ] 更新三个 skill 文件 — 对齐 v2
8. [ ] 更新 README — 对齐 v2