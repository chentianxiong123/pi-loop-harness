# framework 技术栈规则（RULES.md）

本文件是 **framework/ 代码的唯一权威规则来源**：Go / htmx / SQLite 的技术细节都以此为准。
所有 Agent（implementer / reviewer / investigator）与环节 skill（2 / 3 / 4 / 5）动手前必须**先读本文件**。
改代码前若本文件与实现不一致，以本文件为准并修正实现；本文件本身要改，见文末《如何维护》。

---

## 1. 技术栈总览

- 语言：Go（module `pi-loop-harness/framework`，`go 1.26`，**最低版本 1.26**——`modernc.org/sqlite v1.57` 依赖此版本特性，低版本编译不过）
- Web：标准库 `net/http` + `html/template` + **htmx 2.0.9**（服务端渲染，数据/局部刷新）
- 客户端 UI 状态：**Alpine.js 3**（CDN，无构建链）——只做视觉状态，分工红线见 §4.1
- 样式：daisyUI 4（CDN 引入），`<html data-theme="dark">`
- 存储：**SQLite**，驱动 `modernc.org/sqlite`（纯 Go，无 CGO），driver name 是 `"sqlite"`（不是 `sqlite3`）
- 外部依赖：**仅** `modernc.org/sqlite` 一家。禁止再引入别的库（HTTP 用 stdlib、模板用 stdlib）。

## 2. 三层结构铁律（分形解耦）

| 层 | 目录 | 职责 | 禁止 |
|---|---|---|---|
| 业务 | `business/<域>/` | 纯函数，`文件名=函数名`，一个文件一个函数 | import 外部库、碰 HTTP、碰 DB |
| 基础设施 | `infra/` | 可复用技术函数（sqlite 连接/建表/读写、模板解析），无业务逻辑 | 业务判断；造轮子前先 grep 本目录 |
| 胶水 | `glue/` | 契约（`interfaces/`，只声明形状）+ 组装（`assembly/`）+ 进程/部署 | 业务逻辑、技术实现 |

- `glue/interfaces/` 契约：对齐 SPEC 生成、冻结后只读；实现放在对应层。
- 组装在 `glue/assembly/` 做**显式适配**，并加编译期断言兜底：`var _ infra.Store = (*processor)(nil)`。
- 业务函数不感知使用方式：被组装成 HTTP 端点 / 任务 / 主程序，改法只动胶水层。

## 3. SQLite 规则（infra/data/）

- 打开：统一走 `data.Open(ctx, path)`；DSN 固定为
  `file:<path>?cache=shared&_pragma=busy_timeout(5000)&_pragma=journal_mode(WAL)&_pragma=foreign_keys(1)`。
- `SetMaxOpenConns(1)`：SQLite 单写者，**禁止并发写**（不要把连接池调大）。
- 建表：只改 `infra/data/migrate.go` 的 `migrate()`，幂等（`CREATE TABLE IF NOT EXISTS` + `INSERT OR IGNORE`），顺序执行；后续结构变更用带版本号的迁移。
- 读写：一律 `QueryRowContext` / `ExecContext`，带 `context`；取新值用 `RETURNING`。禁止字符串拼接 SQL。
- 路径：默认 `data/harnessd.db`，`HARNESSD_DB` 覆盖；`data/` 已 gitignore，DB 文件不入库。

## 4. Web / htmx 规则（infra/web/ + glue/assembly/）

- 模板在 `infra/web/templates/*.html`，用 `//go:embed templates/*.html` 嵌入，`web.MustTemplates()` 启动期解析（失败即 panic）。
- 完整页面 = 一个模板（如 `hello.html`）；**htmx 片段 = 独立模板文件**（如 `greeting.html`），被 `{{template "greeting.html" .}}` 嵌入或 `hx-target` 整块替换。
- htmx 交互：片段端点返回**部分 HTML 片段**（不是 JSON）；纯数据端点才 `text/plain`。
- 属性约定：`hx-get` / `hx-target="#id"` / `hx-swap="outerHTML"`；htmx 从 CDN 加载（`https://unpkg.com/htmx.org@2.0.9`）。
- 路由：统一在 `glue/assembly/http.go` 的 `registerRoutes(mux, db)` 注册。
- handler 是纯胶水：取数（Store 契约）→ 调业务函数 → 渲染模板；不做业务判断。
- 新增能力链路：`business/<域>/<函数>.go` → `glue/interfaces/business/` 加契约 → `infra/data` 加读写（若要持久化）→ `infra/web/templates/` 加片段 → `glue/assembly/http.go` 适配 + 注册路由。

### 4.1 HTMX / Alpine.js 分工红线（铁律，不可越界）

**一句话分工**：
- **凡是需要跟服务器要数据 / 改数据（增删改查、分页、提交）→ 只用 HTMX。**
- **凡是纯属界面视觉把戏（弹窗显隐、下拉菜单、暗黑模式、按钮 loading 态）→ 只用 Alpine.js。**

**决策红线（触发判据）**：
- 用 **HTMX**：只要触发后 URL 变了、数据库变了、或需要后端重新计算（哪怕只是刷新一个数字）。
- 用 **Alpine.js**：只要触发后页面没刷新、URL 没变、浏览器没发请求（如点开折叠面板，纯粹给用户看的）。

**死规矩（越界即灾难）**：
- **后端数据（用户名、列表、任何来自 Go/DB 的值）永远不准放进 Alpine 的 `x-data`**。
- 数据必须由 **Go 渲染** 或 **HTMX 替换** 进入页面；Alpine 只准碰 CSS 类名（`class`）与样式（`style`）。
- Alpine handler 内禁止 `fetch`/`axios`/任何网络请求——一旦需要请求，改用 htmx 端点。
- 违反任一条 = 脱离需求，reviewer 直接拒合。

## 5. 构建 / 进程 / 冒烟

```bash
make build        # → bin/harnessd
make run          # 编译 + 启动（默认 :8100，HARNESSD_ADDR 覆盖）
go test ./...     # 测试（business 同目录 *_test.go）
glue/process/start.sh | stop.sh | health.sh
docker compose -f glue/deploy/docker-compose.yml up
curl localhost:8100/           # 页面
curl localhost:8100/api/greet  # htmx 片段（计数递增）
curl localhost:8100/api/count  # 纯文本计数
```

> **worktree 提示（implementer/reviewer 必读）**：Agent 的 bash 每次调用是**新进程，`cd` 不跨调用持久**；read/write/edit 工具以**仓库根**为 cwd 基准。
> - git 一律 `git -C .worktrees/<slug> <cmd>`；
> - 读改 worktree 文件路径带 `.worktrees/<slug>/` 前缀；
> - 跑测试用单条命令 `cd .worktrees/<slug> && go test ./...`。

## 6. 新增一个功能的完整最小步骤（Agent 照此落地）

1. 回归：读 `.pi/plan/<name>.md` 的 `Original Request`（本功能在需求边界内）。
2. `business/<域>/<函数>.go`：纯函数 + 同目录 `*_test.go`（不碰 HTTP/DB）。
3. `glue/interfaces/business/<域>.go`：声明业务契约（只声明形状）。
4. `infra/data/`：如需持久化，加建表（migrate.go）+ 读写函数。
5. `glue/interfaces/infra/`：如需，声明 Store 类契约。
6. `infra/web/templates/`：加页面/片段模板（htmx 属性照第 4 节）。
7. `glue/assembly/`：写 processor 适配（编译期断言）+ 路由注册。
8. 自测：`make build` + `go test ./...` + curl 冒烟。

---

## 如何维护（RULES.md 是单一权威源）

**规则只有一处**：`framework/RULES.md`。skills / agents 不复制技术细节，只在动手前**引用并读取**本文件，因此改技术规则只改这一个文件。

- **改技术栈（升级/换库/换版本）**：只改 `framework/RULES.md` 第 1 节，并同步 `go.mod`（新依赖）与 `framework/README.md`（结构/命令简述）。skills / agents 无需改动——它们只依赖"先读 RULES.md"这一句。
- **改编码约定（新增层/新规则/新目录约定）**：加到 `framework/RULES.md` 对应章节，并在 `framework/README.md` 的结构图补一句（可选）。若某条规则对某个环节特别关键，才在该 skill 里加一行指针，不要复述。
- **出现 RULES.md 与代码不一致**：以 RULES.md 为准修代码，不允许反过来迁就 RULES.md 旧文；修完后在 commit message 标注"sync RULES.md"。
- **reviewer 复测时**：以 RULES.md 为技术准绳逐条核对实现（违反 RULES 的改动，等同脱离原始需求处理）。
- 版本历史：RULES.md 走普通 git 提交，changelog 记在提交信息里，不在文件里堆历史。