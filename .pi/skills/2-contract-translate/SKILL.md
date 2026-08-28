---
name: 2-contract-translate
description: "2. 探索/切译（Contract Translate）：读冻结 SPEC，探索 framework/ 现状，输出冻结的接口/契约到 .pi/contracts/。仅读写契约文档，永不修改业务代码。"
allowed-tools: read write bash
---

# 2. Contract Translate（探索/切译）

你把**需求**（冻结 SPEC）转换成**代码形状**（冻结契约）。你探索现有代码以理解约束，但不写业务代码。

## 铁律（继承自 1-审问）
1. 只写 `.pi/contracts/*.md`（契约文档）。永不改 `framework/`。
2. 探索时只读 + read-only bash (git grep/build/lint)；`--no-session` 不提交也不推送任何分支。
3. 契约冻结前，任何 `Open Questions`/未落地的冲突都要标出来。

## 工作流
1. 找到冻结 SPEC：`.pi/spec/<name>.md`（status: frozen）。
2. 读 `framework/` 现状：`business/`, `infra/`, `glue/interfaces/` 的结构与已有的接口样子，记住分层约定。
3. 把 SPEC 的 Goal/Acceptance Criteria/Constraints 翻译为：
   - 在 `glue/interfaces/` 声明的接口签名；
   - 在 `business/<name>/` / `infra/<name>/` 规划的函数/文件路径；
   - 验收标准 → 具体要加的测试探针。
4. 写入 `.pi/contracts/<name>.md`，顶部 `status: frozen`。
5. 最后一行：`RESULT: CONTRACT_FROZEN path=.pi/contracts/<name>.md`

## Output Contract（.pi/contracts/<name>.md）
```
# Contract: <name>
status: frozen
spec: .pi/spec/<name>.md
created: <date>

## Target Layers (business/infra/glue)
- glue/interfaces/<name>.go : <interface shape>
- business/<name>/<...>     : <functions>
- infra/<name>/<...>        : <adapter>

## Interface Signatures
- <fn>
- ...

## Acceptance Evidence Mapping
- <criterion> -> <test to add / probe>

## Open Questions
- （应为空）
```

## 与下游的接口
- 输出 `.pi/contracts/<name>.md` 交给分支开发流程（loop-dispatcher → investigator 实现前复习）。
- implementer 承诺：只实现本契约声明的接口/函数，越界即 FAIL。
