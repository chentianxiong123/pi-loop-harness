# Contract Writing Guide

## 把"做什么"翻译成"长什么样"

1. **Goal → interface**：一个 SPEC 目标通常落在 `glue/interfaces/<name>.go` 声明一个 interface。
2. **Acceptance Criteria → tests**：每条 `[ ] ...` 写作 `evidence: tests/...`。
3. **Constraints → layers**：端口 8100 → `infra/`；三层不跨 → 标 `business/` vs `infra/` vs `glue/`。

## 分层约定（抄 framework/）
- `business/<name>/`：纯业务逻辑，无 db/IO/端口调用，只调接口。
- `infra/<name>/`：db/HTTP/外部服务的实现，向 business 适配接口。
- `glue/interfaces/<name>.go`：interface 声明（编译期断言 `var _ infra.Store`）。

## 示例翻译
- SPEC: "用户可查询自己的订单列表"
- Contract: `glue/interfaces/order.go: ListOrders(userID) ([]Order, error)` → tests in `business/order/*_test.go` with mock infra.
