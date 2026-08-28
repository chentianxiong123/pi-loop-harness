# Run-State 账本协议（单一权威源）

所有环节（0-loop 编排的 1→7，及 bug-triage）统一读写一个账本文件，实现断点续跑与审计。**schema 以本文件为准。**

## 位置与命名

- 路径：`.pi/runs/<name>.json`；`<name>` 与 `.pi/plan/<name>.md` 同名。
- `.pi/runs/` 已 gitignore（运行时状态，不入库；`.pi/plan|feasibility|spec|tasks|smoke/` 是入库的正式制品）。
- 不存在 → 环节1 创建；其余环节先读，无则报错 `RESULT: NO_RUN_STATE`。

## Schema（JSON）

```jsonc
{
  "name": "<feature>",            // 与 plan 同名
  "stage": "<阶段名>",            // plan|explore|spec|tasks|implement|retest|merge|smoke|blocked|done
  "entry": "feature|bug",        // feature 走 0-loop；bug 走 bug-triage
  "created": "ISO8601",
  "updated": "ISO8601",
  "plan_path": ".pi/plan/<name>.md",
  "original_request": "<逐字原始需求>",   // 回归锚（冗余存，防 plan 丢失）
  "retry": {                     // 重试计数（环节内 + 4→5 循环）
    "implement": 0,              // 环节4 重派次数，<=2
    "retest_loop": 0             // 4→5 循环轮数，<=2
  },
  "tasks": [                     // task-slice 产出；单任务 feature 也建 1 项
    {
      "id": "t1",
      "criterion": "<对应最初需求/SPEC 条目>",
      "scope": ["<涉及文件相对仓库根>"],
      "ctr":   ["<glue/interfaces 契约文件>"], // 只读，切片时生成
      "branch": "agent/<slug>",  // implementer 回报后填
      "worktree": ".worktrees/<slug>",
      "status": "pending|implemented|retested|merged|blocked"
    }
  ],
  "events": [                    // 追加式审计日志
    {"at": "ISO8601", "stage": "spec", "msg": "SPEC_FROZEN -> .pi/spec/<name>.md"}
  ]
}
```

## 读写规则（所有环节遵守）

1. **环节开头（回归之后）**：读账本，确认 `stage` 与当前环节匹配（防跳步/重复执行）。
2. **环节结束**：更新 `stage`/`retry`/`tasks`/`events`，写回 `.pi/runs/<name>.json`，然后才输出 `RESULT:`。
3. **改出限**：任何重试计数超限 → `stage: blocked`，`RESULT: BLOCKED`，停下交人。
4. **断点续跑**：主 agent 看到账本 `stage` 即可从对应环节继续，不依赖对话记忆重试计数。
5. groundwork：**审计**靠 `events`（追加不删），复盘看它。