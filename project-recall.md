# Project Recall

> 跨项目检索历史 — 归档搜索 + 决策追踪
> 依赖：`$PROJECT_ARCHIVE_PATH` 已设置（见 project-archive skill）

## 当触发

用户问以下类型的问题时，**自动检索**：
- "以前怎么做 X 的？"
- "找找历史归档" / "chat 相关的归档"
- "X 模块的决策是什么？"
- "我们用过哪些技术栈？"
- "SSE 是怎么实现的？"
- "有没有关于 Y 的归档？"
- "我所有项目里用过哪些 Z 方案？"

## 不要触发

- 用户问的是当前代码问题（去读代码，不是归档）
- 用户明确说"不用翻历史"
- 问题明显是常识性而不是回顾性

## Agent 执行清单

- [ ] **1. 解析查询意图**：是搜功能（archive-search）还是查决策（archive-decision show）
    - 关键词指向功能模块 → 搜 archive
    - 关键词指向决策/方案选型 → 搜 archive + 查 decision tree

- [ ] **2. 执行搜索**

    搜索归档：
    ```bash
    python "$PROJECT_ARCHIVE_PATH/core/archive-search.py" "关键词"
    python "$PROJECT_ARCHIVE_PATH/core/archive-search.py" --global "关键词"
    python "$PROJECT_ARCHIVE_PATH/core/archive-search.py" --category feat
    ```

    查决策链：
    ```bash
    python "$PROJECT_ARCHIVE_PATH/core/archive-decision.py" show "决策ID"
    python "$PROJECT_ARCHIVE_PATH/core/archive-decision.py" list  # 列出所有决策
    ```

    本周摘要：
    ```bash
    python "$PROJECT_ARCHIVE_PATH/core/archive-search.py" --summary
    ```

- [ ] **3. 呈现结果**

    不要只给文件名。每个匹配结果应该包含：
    1. 项目名 + 文件名
    2. 成果摘要（"探索成果"第一段）
    3. 技术栈关键词
    4. 关键决策（如有）

    决策树结果：
    1. 决策名称 + ID
    2. 当前生效的决定（★标记）
    3. 完整试错链路（初始 → 推翻 → 补充）

## 输出示例

```
找到 2 个相关归档:

1. [HomeSense-Studio] 2026-05-26--feat--chat-module-migration.md
   成果: 老 chat/conversation 废弃，chat2 晋升...
   技术栈: llmService.chatStream, SSE, 游标分页
   决策: 思考链不存 DB → 独立 think 表

2. [mybilibili-cloud] 2026-04-15--feat--live-chat-websocket.md
   成果: WebSocket 实时弹幕...
   技术栈: WSS, protobuf
```

```
📋 思考链存储 (think-chain-storage)

◆ #1 2026-05-26 [initial] ★ 当前生效
   不是 把思考链也存到 DB
   而是 不存，保持查询快

◆ #2 2026-06-01 [supersede] (推翻 #1) ★ 当前生效
   不是 不存 DB
   而是 改为独立 think 表
```

## 注意事项

1. 检索结果按日期倒序（最新的在前）
2. 索引由脚本自动生成，**不要手动编辑**索引文件
3. 决策链只追加不删改，保留完整试错历史
4. 如果没找到结果，告诉用户"没有相关归档"而非沉默