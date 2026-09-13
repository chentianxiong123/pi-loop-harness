# 计划：平台可视化 + 知识库改造（个人→项目，单项目）

> 状态：已确认，开始实施
> 日期：2026-09-13

## 一、定案要点

| 决策 | 落地方案 |
|---|---|
| 知识库范围 | **单项目**，不加 Project 多租户模型；定位从「个人第二大脑」改为「本项目知识库」 |
| 入库审核 | **自动入库天然走现成审核管道**：流水线产物写成 `KnowledgeCaptureBatch`(PROPOSED) → 人在 memorynote 收件箱审核 ACCEPT/REJECT → 通过才成为正式知识 |
| 可视化形态 | **在 pi-web 基础上插件式加出**：新增独立页面 + API，旁挂不动现有聊天主界面 |

## 二、A 部分：pi-web 插件式可视化（新增模块 `harness`）

### A1. API（`app/api/pi/*`，只读扫描，复用现有安全门）

```
pi/agents/route.ts        扫 .pi/agents/*.md → 角色卡片（frontmatter+body）
pi/skills/route.ts        扫 .pi/skills/{entries,steps} → 步骤面板
pi/extensions/route.ts    列 extension 工具（名称/描述/参数）
pi/runs/route.ts          列 .pi/runs/*.json + 状态统计
pi/runs/[name]/route.ts   单账本详情：stage/tasks/retry/events 时间线
pi/artifacts/route.ts     浏览 plan/spec/tasks/smoke 制品
```

### A2. 页面（`app/` 新增，AppShell 侧栏加入口）

```
/platform           平台总览：agents + skills + extensions + settings
/pipeline           流水线中心：运行列表 + 8 步流程条（当前 stage 高亮）+ 收件箱提单
/pipeline/[name]    单次运行：stage/retry/tasks 表 + events 审计流 + 制品 markdown(复用 MarkdownBody)
```

- 账本用 SSE/轮询刷新（复用 `agent-event-connection` 模式）
- **收件箱提交**一并做在 /pipeline（Web UI 提交立即闭环）

### A3. 后台收件箱 + 自动入库

```
.pi/orchestrator/
├── inbox.ts     SQLite inbox 表：queued→running→done/blocked
├── runner.ts    常驻轮询 → pi -p 跑 0-loop-dispatcher → 回写账本+inbox
├── ingest.ts    smoke 通过后：结账本→ 产物(PLAN/SPEC/smoke/教训)写成
                   KnowledgeCaptureBatch(PROPOSED, sessionId=run name) → memorynote DB
└── start.ts     入口：建表 + 起 runner + 起 api
```

## 三、B 部分：memorynote 改造成「项目知识库」（单项目）

### B1. 文案/定位

- 「个人知识沉淀系统 / 第二大脑」→ 「项目知识库 / 本项目知识中枢」
- 首页统计保持单项目视角，去掉"个人成长"措辞

### B2. 数据模型（不需要 Project 表，单项目）

- **新增** `ProjectRun` 表：name/entry/stage/retry/ledger_path/finishedAt/artifacts 摘要
- `KnowledgeCaptureBatch` 加 `projectRunId?` 关联（可空，迁移安全）
- 其余 Conversation/Document/Wiki 保持，靠 Label 分类

### B3. 审核闭环（复用现成管道）

```
流水线 smoke done → ingest.ts 写 KnowledgeCaptureBatch(PROPOSED)
→ memorynote 收件箱出现新批次（含 PLAN/SPEC/教训条目）
→ 人审核：ACCEPTED(进 wiki 词汇) / REJECTED(带原因) / SNOOZED
→ 下轮 agent 开工前检索已 ACCEPTED 的知识
```

## 四、实施顺序

1. **A1** pi-web `.pi/` 只读 API
2. **A2** 可视化页面（/platform, /pipeline, /pipeline/[name]）+ 收件箱提单
3. **A3** inbox/runner/ingest 后台（runner 用 `setsid nohup` 常驻）
4. **B2** memorynote 加 ProjectRun 表 + 迁移
5. **B1+B3** memorynote 改名 + ingest 审核闭环打通
6. 端到端验证

## 五、验证

- pi-web 起 30141：/platform、/pipeline 正确渲染 `.pi/` 内容与账本
- 提一条需求 → runner 自动跑 → 账本 stage 流转 → 完成后 memorynote 出现 PROPOSED 批次 → 审核 ACCEPT
- 造一个必败用例 → 验证 BLOCKED + 不会生成入库批次
