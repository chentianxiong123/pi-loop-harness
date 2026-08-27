# framework — GO 项目框架模板

> pi-loop-harness 的**工程骨架模板**。纯标准库、零第三方依赖、单一二进制、零构建。
> 本模板只做一件事：给 Pi 插件（loop-engine）提供一个可驻留的底座。
> **不承载 loop/harness 逻辑**——那是 Pi 插件（TS）+ Python/skills 的事。

## 结构

```
framework/
├── go.mod                     module: pi-loop-harness/framework
├── Makefile                   build / run / clean
├── cmd/harnessd/
│   ├── main.go                入口：路由 + html/template + HTMX 问候接口
│   └── web/templates/         hello.html(页面) + greeting.html(HTMX 片段)
└── bin/                       构建产物（gitignore）
```

- **视图**：标准库 `html/template` + HTMX 2.x + daisyUI（CDN），下次点击只换片段不刷整页
- **端口**：默认 `:8100`（勿占他人端口），可用环境变量 `HARNESSD_ADDR` 覆盖
- **embed**：模板 `go:embed` 进二进制，单文件分发
- **新增页面**：`web/templates/` 加 `.html`，`main.go` 加路由

## 命令

```bash
make build     # 编译 cmd/harnessd → bin/harnessd
make run       # 编译 + 启动（默认 :8100）
HARNESSD_ADDR=:8100 ./bin/harnessd   # 自定义端口
```

## 冒烟

```bash
curl localhost:8100/          # 页面
curl localhost:8100/api/greet # HTMX 片段（计数递增）
```

## 留意点

- `embed` 默认忽略 `_` 开头文件 → 模板片段不要用 `_` 前缀（用 `greeting.html` 而非 `_greeting.html`）
- 模板 `go:embed` 路径相对 main.go 所在目录 → 静态资源放 `cmd/harnessd/` 下