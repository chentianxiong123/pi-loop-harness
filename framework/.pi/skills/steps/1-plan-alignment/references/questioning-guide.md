# Questioning Guide

## 五维提问模板
- 范围：这个功能覆盖哪些用户/场景？不覆盖什么？
- 边界：输入非法/为空/超量时怎么办？
- 验收：怎样算"做完了"？用什么证据（测试/日志/行为）证明？
- 依赖：依赖哪些已有模块/外部服务？有没有不能动的契约？
- 非功能：延迟/并发/端口/兼容要求？

## 把松散回答结构化
- 用户说的"要快" → 落成 `Constraints: p99 < 200ms`。
- 用户说的"和现在一样" → 落成 `Scope Out: 不改现有鉴权流程`。

## 与下游的接口
- 产出 `.pi/plan/<name>.md`（frozen）后，交给 `2-explore` 探索可行性，再经 `3-spec-review` 产出 SPEC，然后 4→5→6 开发。粘合由 `0-loop-dispatcher` 驱动。
- 任何 Open Questions 非空 → 不算 frozen，继续问。

## question 工具用法
```
question({ question: "这个接口要支持哪些鉴权方式？", options: [
  { label: "Bearer Token" },
  { label: "API Key" },
  { label: "两者都要" }
]})
```
非交互模式下该工具不可用，退化为在对话里直接提问。
