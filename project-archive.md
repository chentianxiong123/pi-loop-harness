# Project Archive

> 地图归档系统 — 全局存储，记录所有项目的开发历史
> 使用前必须设置 `PROJECT_ARCHIVE_PATH`（见下方说明）
>
> **权限：Hermes 专属。** CC 和 Codex 不能归档，只有 Hermes 有写入 archive/ 的权限。
> 归档前必须经过对证循环：CC commit → Codex 审查（REVIEW-PASS）→ Hermes 终审 → 归档。见 project-coordinate skill。

## 路径设置

Agent 需要在 `~/.claude/CLAUDE.md`（或项目 CLAUDE.md）中定义：

```bash
# project-archive 工具路径
export PROJECT_ARCHIVE_PATH="/path/to/project-archive"
```

如果未设置，Agent 应依次检查：
1. `$PROJECT_ARCHIVE_PATH`
2. `~/Desktop/project-archive/`
3. `~/project-archive/`

## 当触发

- **仅 Hermes**：三签达成（cc_verdict=approved + codex_verdict=approved）后，Hermes 启动归档
- **仅 Hermes**：用户对 Hermes 说"归档"、"存档"、"记录一下"
- **仅 Hermes**：Hermes 完成验收后自动触发

## 不要触发

- 用户只是随口问"要不要归档"
- 工作还在进行中，没有明确的完成信号
- 改动清单少于 3 个文件
- 用户说"等一下"、"还没完"
- **CC 或 Codex 尝试直接归档 — 拒绝，必须通过 Hermes**

## 存储位置

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
├── timeline.md
├── decisions.md
└── tech-stack.md
```

## 归档文件规范

```
YYYY-MM-DD--category--topic.md
分类: feat, fix, test, design, spike, refactor, ops, docs, env
```

## Agent 执行清单

> 以下步骤 **必须** 逐项执行。所有脚本通过 `$PROJECT_ARCHIVE_PATH/core/` 调用。

- [ ] **1. 检测完成信号**
    - 扫描当前会话输出：改动表格(3+文件) + "完成了"/"零错误"/"效果："

- [ ] **2. 生成归档建议**
    - 文件名：`YYYY-MM-DD--分类--主题.md`
    - 向用户确认："要归档为 `YYYY-MM-DD--分类--主题.md` 吗？"

- [ ] **3. 用户确认后写入文件**
    - 路径：`~/.project-archive/projects/<项目名>/archive/YYYY-MM-DD--分类--主题.md`
    - 模板：
    ```markdown
    # YYYY-MM-DD · 主题

    > ✅完成 | 分类 | 涉及范围

    ## 探索成果
    - 从会话输出提取，3-8 条，动词开头

    ## 技术栈
    - 从改动的文件中提取关键词，3-8 个

    ## 关键决策
    - 本次做了什么决策
    - 如有决策变更，需执行 archive-decision.py

    ## 变更
    文件: +新增 · ~修改 · -删除
    ```

- [ ] **4. 更新 STATUS.md**
    ```bash
    python "$PROJECT_ARCHIVE_PATH/core/update-status.py" add-archive "YYYY-MM-DD--feat--xxx.md" --project=<项目名>
    python "$PROJECT_ARCHIVE_PATH/core/update-status.py" mark-done "功能名称" --project=<项目名>
    ```

- [ ] **5. 如有决策变更**
    ```bash
    python "$PROJECT_ARCHIVE_PATH/core/archive-decision.py" append <decision-id> \
      --not "老方案" --but "新方案" --type supersede --supersedes N \
      --source "archive/YYYY-MM-DD--feat--xxx.md"
    python "$PROJECT_ARCHIVE_PATH/core/update-status.py" refresh-decisions --project=<项目名>
    ```

- [ ] **6. 更新当前上下文（异步交接用）**
    ```bash
    python "$PROJECT_ARCHIVE_PATH/core/update-status.py" set-context \
      "已完成 X，下一个 Agent 请从 Y 开始" --project=<项目名>
    ```

## 检索

```bash
python "$PROJECT_ARCHIVE_PATH/core/archive-search.py" "关键词"
python "$PROJECT_ARCHIVE_PATH/core/archive-search.py" --global "关键词"
python "$PROJECT_ARCHIVE_PATH/core/archive-search.py" --category feat
```

## 注意事项

1. 归档文件创建后**必须**调用 update-status.py
2. 决策变更**必须**调用 archive-decision.py + refresh-decisions
3. 归档只写做了什么，**不要**写"下一阶段"、"后续计划"（那些归 STATUS.md）
4. **不要**贴详细代码 — git log 更准