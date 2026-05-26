# Project Recall

从全局归档中快速检索答案，构建跨项目的开发历史地图。

## 存储位置

归档存储在 `~/.project-archive/projects/<项目名>/archive/`

## 使用方式

```bash
# 当前项目搜索
python core/archive-search.py "chat"
python core/archive-search.py "SSE"

# 全局搜索（所有项目）
python core/archive-search.py --global "游标分页"

# 按分类
python core/archive-search.py --category feat
python core/archive-search.py --global --category design

# 生成索引
python core/archive-search.py --index decisions
python core/archive-search.py --index --global

# 本周摘要
python core/archive-search.py --summary
```

## 自动触发

当用户问以下问题时，**自动检索并返回完整内容**：
- "以前怎么做 chat 的？"
- "找找历史归档"
- "chat 模块的决策是什么？"
- "我们用过哪些技术栈？"
- "SSE 是怎么实现的？"
- "有没有关于游标分页的归档？"
- "我所有项目里用过哪些分页方案？"

**返回格式：** 不是只给文件名，而是每个匹配文件的：
1. 项目名 + 文件名
2. 成果摘要（第一段）
3. 技术栈关键词
4. 关键决策（如有）

## 输出示例

```
找到 3 个相关归档:

1. [HomeSense-Studio] 2026-05-26--feat--chat-module-migration.md
   成果: 老 chat/conversation 废弃，chat2 晋升...
   技术栈: llmService.chatStream, SSE, 游标分页
   决策: 思考链不存 DB -> DB 干净

2. [mybilibili-cloud] 2026-04-15--feat--live-chat-websocket.md
   ...

3. [cc-work] 2026-03-10--feat--agent-sse-stream.md
   ...
```

## 索引文件

运行 `--index` 会在 `~/.project-archive/` 下生成：

- `decisions.md` — 全项目关键决策
- `tech-stack.md` — 全项目技术栈索引
- `timeline.md` — 全项目合并时间线

## 决策追踪

```bash
# 追踪某个决策的变化
python core/archive-search.py --content "思考链"
# → 2026-05-26: 思考链不存 DB
# → 2026-06-01: 推翻，改为存独立 think 表

# 查看完整决策树
python core/archive-decision.py show <decision-id>
```

## 注意事项

- 索引是只读的，由脚本自动生成
- 每次归档后自动重新生成索引
- 检索结果按日期倒序排列（最新的在前）