# Project Coordinate

> 多 Agent 协作协议 — 工作间模型、对证循环、Windows 自动化注入
> 依赖：project-status、project-hermes 已就绪
> 核心机制：hook → 事件文件 → watcher → 注入 Hermes → Hermes 决策 → 注入 CC/Codex

## 架构总览

```
人 <---> Hermes（常驻交互式终端，注入驱动）
  |
  | 用户派发任务
  v
Hermes spawn CC 终端窗口 -> 注入 prompt -> CC 干
  |
  v
CC 写代码 + git commit -> post-commit hook
  |
  v
hook -> 写 commit.log + .new-event -> watcher 检测到
  |
  v
watcher -> 注入到 Hermes 终端: "事件到达：CC commit 完成，派发审查？"
  |
  v
Hermes 读事件 -> spawn Codex 终端窗口 -> 注入审查 prompt
  |
  v
Codex 审查 + commit -> hook -> watcher -> 注入 Hermes
  |
  v
Hermes 决定: CC 修复 / Codex 通过
  |
  v
Codex REVIEW-PASS -> watcher -> 注入 Hermes: "归档？"
  |
  v
Hermes -> 执行归档流程
```

## 组件

| 组件 | 职责 | 触发方式 |
|------|------|----------|
| Hermes | 常驻交互 agent，决策统筹 | 用户手动打开 |
| CC | 写代码 | spawn 终端 + 注入 prompt |
| Codex | 审查代码 | spawn 终端 + 注入 prompt |
| post-commit hook | commit 后写事件 | git 事件 |
| watcher.py | 监控事件，注入到 Hermes | 文件变化 |
| spawn-agent-window.ps1 | 创建新终端窗口，启动 CC/Codex | watcher 调用 |
| inject-target.ps1 | 通用注入，可指定目标窗口 | 注入脚本 |
| workspace.py | 工作间管理 | Hermes 调用 |
| update-status.py | STATUS.md 管理 | Hermes 调用 |

## 角色

| 角色 | 类型 | 做什么 | 不做什么 |
|------|------|--------|----------|
| Hermes | 常驻交互式 agent | 需求对齐、任务编排、调度、终审、归档 | 不写代码 |
| CC | 短进程（终端窗口） | 写代码、修复 | 不归档、不终审、不派发 |
| Codex | 短进程（终端窗口） | 审查代码、找问题 | 不归档、不终审、不派发 |

## 工作间模型

每个任务创建一个独立工作间：

```
~/.project-archive/projects/<项目>/workspaces/
├── ws001/
│   ├── STATUS.md           ← 工作间状态（迭代记录、结论）
│   ├── branch              ← 记录分支名
│   └── .session-cc         ← CC session 历史
│   └── .session-codex      ← Codex session 历史
├── ws002/
│   ├── STATUS.md
│   └── branch
└── ...
```

### 工作间 STATUS.md 结构

```
# ws001 — jwt-auth
> 分支: ws/ws001-jwt-auth
> 创建: 2026-05-28

## 任务
实现 JWT 认证模块

## 约束
使用 pyjwt，token 有效期 24h

## 迭代记录

| 轮次 | CC 做了什么 | Codex 审了什么 | 结论 |
|------|-------------|----------------|------|
| 1    | 实现登录签发 | REVIEW-FAIL: 缺少刷新 token | CC 修复 |
| 2    | 增加 refresh token | REVIEW-PASS | 通过 |

## 审查意见（最新）
- Codex: PASS

## 状态
completed
```

### commit message 约定

```
[CC-WS001] 实现 JWT 登录签发
[Codex-WS001] REVIEW-FAIL: 缺少 token 过期校验
[Codex-WS001] REVIEW-PASS: 审查通过
```

> **注意：** workspace 标识在 commit message 中统一大写（`WS001`），hook 会转小写后写入 commit.log（`ws001`）。工作间目录也统一小写。

### 事件格式

hook 写到 `~/.project-archive/projects/<项目>/events/commit.log` 的行：

```
<unix_timestamp>|<git_hash>|<author>|<workspace>|<message>
```

例：
```
1748428800|abc1234|CC|ws001|[CC-WS001] 实现 JWT 登录签发
```

## 权限矩阵

| 能力 | Hermes | CC | Codex |
|------|--------|----|-------|
| 读 STATUS.md | OK | OK | OK |
| 写 STATUS.md | OK | OK（工作间） | OK（工作间） |
| 写代码文件 | NO | OK | OK |
| git commit | NO | OK | OK |
| 归档 archive/ | OK（唯一） | NO | NO |
| 检索 recall | OK（唯一） | NO | NO |
| 创建工作间 | OK（唯一） | NO | NO |
| spawn 终端窗口 | OK（唯一） | NO | NO |
| 注入文字 | OK（唯一） | NO | NO |

## 对证循环规则

1. **Hermes 是决策中心** — CC 和 Codex 不直接对话，Hermes 读事件后调度下一步
2. **每轮必须 commit** — 改了代码就 commit，commit 触发下一轮
3. **<= 5 轮上限** — 超过 5 轮 Hermes 强制仲裁
4. **工作间 branch 隔离** — 多个工作间并发时互不干扰
5. **事件驱动** — hook 写事件文件 → watcher 检测 → 注入 Hermes
6. **无人化注入** — watcher 检测事件后自动注入到 Hermes 终端
7. **并发安全** — 所有注入通过 Named Mutex 排队

## 三签制

```
CC 执行（commit） → Codex 审查（commit） → 双方统一 → Hermes 终审 → 归档
```

只有 Hermes 能归档。CC 和 Codex 都不能直接写 archive/。

## 通信规则

- **不直接对话** — CC 和 Codex 通过 commit + 工作间 STATUS.md + 事件文件中转
- **commit message 即信号** — 前缀标识身份 [CC] / [Codex]，工作间标识 [WS001]
- **事件文件驱动** — hook 写 commit.log，watcher 监控 commit.log 变化（通过 .last-processed 判断）
- **注入到 Hermes** — watcher 检测事件后，通过注入脚本给 Hermes 终端发消息

## 注入流程

### 1. spawn 终端窗口

```powershell
# 创建新终端窗口，启动 CC
# dispatch.py 会构造完整调用，用户不需要手动调用
# 底层调用：
powershell.exe -ExecutionPolicy Bypass -File spawn-agent-window.ps1 `
  -Exe "path\claude.exe" -SessionId "uuid" -Workspace "ws001-jwt-auth" `
  -Prompt "在 src/auth/ 实现 JWT 认证" -ProjectPath "D:\files\HomeSense"
```

### 2. 等待完成（通过 hook）

CC 写代码 + commit → hook 写 commit.log + .new-event

### 3. watcher 检测事件

```bash
python watcher.py --project HomeSense --once
```

watcher 读到新事件后，生成注入文本，调用注入脚本：

```powershell
powershell.exe -Command "& { & 'path/to/inject-target.ps1' -WindowType 'hermes' -Message '事件到达：CC 完成 commit abc123，派发审查？' }"
```

### 4. Hermes 决策 → 派下一个

Hermes 读事件内容，注入 prompt 到 Codex 终端（或 CC 修复终端）。

## 注意事项

1. **Coordination State 通过 update-status.py 写入** — 不直接编辑 STATUS.md
2. **归档是神圣操作** — 写进 archive 的就是永久知识
3. **死循环保护** — 对证超过 5 轮，Hermes 必须介入仲裁
4. **互审目标是质量** — rejected 时必须附带具体理由
5. **注入是阻塞的** — 通过 Named Mutex 排队，确保顺序执行
6. **终端窗口需要手动关闭** — CC/Codex 完成后窗口保留，方便查看
7. **事件文件只追加不删除** — commit.log 是审计记录
