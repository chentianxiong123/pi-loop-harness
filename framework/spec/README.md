# SPEC 目录（指引）

本目录**不是** SPEC 的权威存放处。项目级 SPEC 统一归档在

```
.pi/spec/<name>.md
```

（`.pi/plan/`、`.pi/feasibility/`、`.pi/spec/`、`.pi/tasks/`、`.pi/smoke/` 为流水线制品目录，由 0-loop-dispatcher 驱动各环节产出。）

存放约定：

- 每个业务功能一个 MD 文件（如 `.pi/spec/disk-monitor.md`）。
- 内容：需求可追溯表（每条 Acceptance Criterion 对应最初需求条目）、接口/契约、约束；不含实现细节。
- 冻结后只读；修改需重新走对齐环节。

本目录（`framework/spec/`）仅保留模板说明，业务 SPEC 勿写到这里。契约实现形状在 `glue/interfaces/`（SPEC 对齐后生成，冻结只读）。