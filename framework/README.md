# framework — GO 项目框架模板

按《分形解耦架构》组织的工程骨架。三层职责边界清晰，配合契约与 SPEC。

> **技术栈规则在 `framework/RULES.md`**（Go/htmx/SQLite 唯一权威源），Agent 动手前先读它；本文件只讲结构。

## 结构

```
framework/
├── go.mod                     module: pi-loop-harness/framework
├── Makefile                   build / run / clean
├── business/                  第一层：业务函数目录（系统心脏）
│   └── hello/                  示例业务域（纯函数，零技术依赖）
│       ├── greet.go            文件名＝函数名
│       └── greet_test.go       同目录验证
├── infra/                     第二层：基础设施目录（工具箱，无业务）
│   ├── data/                   sqlite 连接/建表/读写
│   └── web/templates/         html/template 页面 + HTMX 片段
├── glue/                      第三层：胶水层（组装车间，无业务无工具）
│   ├── interfaces/            契约文件（只声明形状，不写实现）
│   │   ├── business/hello.go  业务契约
│   │   └── infra/store.go     基础设施契约
│   ├── assembly/              组装：routes(http) + main（接线+启动）
│   ├── process/               启动/停止/健康检查脚本
│   └── deploy/                Dockerfile + docker-compose.yml
└── spec/                      SPEC 文档目录（对齐 Agent 生成，冻结后只读）
```

## 分层铁律

1. **业务目录**：只放业务函数，一个文件一个函数，`文件名=函数名`。不 import 外部库、不碰 HTTP、不碰 DB。
2. **基础设施目录**：无逻辑，只放可复用技术函数。造新轮子前先 grep 这里。
3. **胶水层**：`interfaces/` 合同约（对齐 SPEC 生成，冻结只读）；`assembly/` 显式组装依赖。业务不知道它会被怎么用。
4. **业务函数不感知使用方式**：被组装成 HTTP 端点 / 定时任务 / 主程序，改法只动胶水层。

## 命令

```bash
make build     # 编译 glue/assembly → bin/harnessd
make run       # 编译 + 启动（默认 :8100）
glue/process/start.sh / stop.sh / health.sh   # 进程管理
docker compose -f glue/deploy/docker-compose.yml up   # 容器化
```

## 冒烟

```bash
curl localhost:8100/          # 页面（DTMX 问候）
curl localhost:8100/api/greet # HTMX 片段（计数递增）
curl localhost:8100/api/count # 计数
```

## 留意点

- 契约只存形状，实现放 `assembly/`（编译期断言 `var _ infra.Store = ...` 兜底）
- 新增业务：`business/<域>/<函数>.go` → `glue/interfaces/business/` 加契约 → `assembly/` 接路由