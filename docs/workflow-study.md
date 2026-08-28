# 多 Agent 编排 / Loop 工程 工作流研究

> 研究日期：2026-08-28
> 目标：为 `pi-loop-harness` 的"主 Agent 读 SPEC + 派发查改审三角色 + 协议层 SKILL.md + 物理层一次性子进程 + 回归铁律"架构，从现有开源项目学习工作流设计。
> 仓库克隆于：`/mnt/shared/pi-workflows-study/`（10 个项目，均为 shallow clone）。

---

## 一、全景速览

10 个项目分两大阵营：**Pi 生态原生编排**（直接可装可学）与 **通用 Loop 工程**（跨 harness，理念通用）。

### Pi 生态（5 个）

| # | 项目 | 编排流派 | 一句话定位 |
|---|---|---|---|
| 01 | [QuintinShaw/pi-dynamic-workflows](https://github.com/QuintinShaw/pi-dynamic-workflows) | 确定性 VM 脚本 | 工作流写成 JS 跑 `node:vm`，`agent()/parallel()/pipeline()` + callHash journal 断点续跑；**恢复能力最强** |
| 02 | [ruizrica/agent-pi](https://github.com/ruizrica/agent-pi) | 模式×角色×团队 | 43 扩展 / 6 操作模式 + 三套声明式 YAML（team/chain/pipeline），子进程带 `--session` 记忆 |
| 03 | [l3wi/agents-workflow](https://github.com/l3wi/agents-workflow) | worktree 并行 swarm | **最贴本方案**：`.agent-state.json` 心跳 + 30s supervisor 对账 + sha 钉定合并门 |
| 04 | [BlackBeltTechnology/pi-flows](https://github.com/BlackBeltTechnology/pi-flows) | YAML DAG 引擎 | 步骤图编译成 DAG 波 + 路由节点，`max_iterations` 表达回归，typed inputs/outputs |
| 05 | [stew675/pi-orchestration](https://github.com/stew675/pi-orchestration) | goal-based LLM 编排器 | `implementation-plan.md` 落盘可人工改，状态机 + 断点恢复 + validator 用工具信号判 PASS/FAIL |

### Loop 工程（5 个，跨 harness）

| # | 项目 | 核心思想 |
|---|---|---|
| 06 | [BotondCsereklye/LoopEngineer](https://github.com/BotondCsereklye/LoopEngineer) | 显式状态机 ANALYZE→PLAN→IMPLEMENT→TEST→REVIEW→DECIDE/FIX，Zod 校验结构化握手，确定性 tester |
| 07 | [lSAAGl/loop-harness](https://github.com/lSAAGl/loop-harness) | bash 定时调度 + worktree + 主 agent(skill) + skeptical 第二会话 `VERDICT: PASS` 才发包 |
| 08 | [kayoslab/karl](https://github.com/kayoslab/karl) | 纯 bash 逐票流水线，TDD 先行 + rework loop 按 `failure_source` 归因（改码还是改测试） |
| 09 | [subrit/athena-loops](https://github.com/subrit/athena-loops) | Python 确定性 harness：decompose→扇出→aggregate→verifier→review→feedback→loop |
| 10 | [ruchirk22/loopd](https://github.com/ruchirk22/loopd) | PM-Sovereign：**accept 按钮按轮动态从 schema 里删除**，pristine worktree 重放全部验证 |

---

## 二、逐项目深读

### 01 · pi-dynamic-workflows（确定性 VM 工作流运行时）

**编排模型**：工作流脚本经 acorn 解析（`src/workflow.ts`）在 `node:vm` 沙箱执行；前导屏蔽 `Math.random/Date.now/new Date()` 求确定性（best-effort，非安全墙）。注入运行时标准库：`agent()/parallel()/pipeline()/workflow()/verify()/judgePanel()/loopUntilDry()/completenessCheck()/retry()/gate()/checkpoint()/phase()/budget()`。`WorkflowManager` 是 EventEmitter，支持 pause/resume/stop。触发受门禁约束（`WORKFLOW_GATE_GUIDELINE`）：仅用户显式 opt-in（触发词、`/workflows run`）才调用。

**子代理派发**：不走 CLI 子进程，而是在扩展进程内 `createAgentSession`（SDK）创建专职会话。角色由 frontmatter 解析（`.pi/agents/*.md` 与 `~/.pi/agent/agents/*.md`），字段 `name/tools/disallowedTools/model/isolation`，正文为 prompt。每次调用确定性命名 + 缓存：`hashAgentCall`（prompt/model/tier/phase/agentDef/schema 的 sha256）→ 结果写 journal，供恢复重放。

**三角色**：由 agentType 注册表 + 内置模式承载，而非写死三份文件：
- 查（research/finders）：code-review 的 7 路 finder 角度 A–G（分档 small/medium/big）。
- 审（review）：adversarial-review 三阶段 Investigate→Refute→Consensus，每个 finding 由 N 个 skeptical reviewer 独立裁定，达 `agreementThreshold` 才存活。
- 改（synthesis）：code-review 的 big-tier 合成器输出排序报告。

**验证门**：`verify(item,{reviewers,threshold})` 对抗性审查者投票 real/false，过阈值才判真；`judgePanel(attempts,{judges,rubric})` 打分取均；`completenessCheck` 批判"还缺什么"；`loopUntilDry` 研究饱和收敛。规模护栏：`MAX_DIFF_CHARS=200_000`、`MAX_CONCURRENCY=16`、`MAX_AGENT_RETRIES=3`。

**状态与恢复（三项目最强）**：`PersistedJournalEntry {index, runId, hash, result}` + `PersistedAgentState`。恢复按"最长未变前缀"规则重放——`firstMiss` 后所有调用强制 live 重跑；嵌套 `workflow()` 上游 miss 即彻底断开 journal。`SharedStore` in-memory KV 走 deltaKey=`runId:callIndex` 增量恢复。原子写全链路（temp+rename+backup）。worktree 按 runId+callIndex 确定性命名（`.pi/worktrees/`、`pi/wf/<name>`），结果不自动合并。

**最可借鉴**：① 质量辅助全部建在 `agent()/parallel()` 之上 → 自动 journal、自动纳入恢复；② callHash 恢复协议（prompt+模型+角色定义哈希决定缓存命中）；③ opt-in 触发门禁；④ agentType frontmatter 角色协议；⑤ SharedStore delta 化跨代理状态。

---

### 02 · agent-pi（模式+角色+团队的调度套餐）

**编排模型**：6 种操作模式（Shift+Tab 循环 NORMAL/PLAN/SPEC/PIPELINE/TEAM/CHAIN），模式决定 `before_agent_start` 钩子接管并注入强制 prompt。三种编排机制：
- **TEAM**：主代理成纯调度者（只有 `dispatch_agent` 一个工具），专科代理各持独立 Pi session，团队从 `agents/teams.yaml` 选择。
- **CHAIN**：`run_chain` 顺序管线，`$INPUT`（上步输出）/`$ORIGINAL`（原始 prompt）模板注入，链定义 `agents/agent-chain.yaml`。
- **PIPELINE**：阶段管线 UNDERSTAND→GATHER→PLAN→EXECUTE→REVIEW，阶段内并行，`review_max_loops:3` 截断审查循环。

**子代理派发**：标准模板（`extensions/agent-team.ts`）：
```
pi --mode json -p --no-extensions
   -e tasks.ext -e footer.ext -e memoryCycle.ext [-e commander.ext]
   --model <model> --tools <tools> --thinking off
   --append-system-prompt <角色系统提示(定义文件正文+Commander纪律)>
   --session <会话文件> [-c 续跑已有会话] <任务文本>
```
会话文件 `.pi/agent-sessions/<agent>.json`：exit 0 后 `-c` 续接 → 每个专科代理跨调用保记忆。检测到 `isContextLossError` 清除会话重派。stdout 按行解析 JSON 事件流式入 widget（上下文占用 %）。

**三角色**：`agents/builder.md`（tools=read/write/edit/bash/grep/find/ls，实现者）、`agents/scout.md`（read/grep/find/ls，只读侦察）、`agents/reviewer.md`（read/bash/grep/find/ls，输出 `APPROVED/NEEDS CHANGES` + Critical/High/Medium/Low 严重度）。

**验证门**：reviewer 是事实上的门，判词返回主代理；PIPELINE 的 REVIEW 阶段据结果决定 approve/re-dispatch，`review_max_loops:3` 兜底。无自动 CI 门禁——质量靠 reviewer + 模式提示词纪律。

**状态与恢复**：会话文件续跑（`-c`）是主恢复手段；`memory-cycle` 管理上下文压缩；Commander tracker 持久化任务状态（claim/completion/失败原因）；进程态不落盘，崩溃后依赖会话续跑。

**最可借鉴**：① `--session` 会话延续跨调用记忆；② `--tools` 白名单 + `-e` 扩展工具恒可用（extension 注册工具无法被 `--tools` 过滤，天然免自研 MCP）；③ 主代理无工具化（纯调度者）；④ teams/chain/pipeline 三份 YAML 声明式编排；⑤ JSON 模式 stdout 事件流解析做轻量可观测。

---

### 03 · agents-workflow（worktree + 状态文件心跳的并行 swarm）

**编排模型**：技能三段式 `/skill:plan`（PRD→Spec→Plan→Tasks 制品）→ `/skill:swarm`（worktree 并行实现+合并+PR）→ `/skill:validate-plan`（spec 对齐+测试+覆盖率，PASS/PARTIAL/FAIL）。`orchestration.ts` 提供 `orchestration_init/agent_spawn/agent_status/agent_terminate/worktree_*/agent_logs_*`。**background-supervisor** 30s `setInterval` 对账：读每个 worktree 的 `.agent-state.json`，`in_progress` 且 30 分钟无心跳且 pid 死 → blocked；agent 完成自动跑 lint+test 把 `{sha,status,report_path}` 写回编排状态。

**子代理派发**：worktree 内 detached 一次性子进程（`orchestration.ts`）：
```
spawn("pi", [
  "--mode","json","-p","--no-session",
  "--append-system-prompt", <agentMarkdownFilePath>,
  ...(model/provider/tools/thinking 由 frontmatter 转 CLI flag)
], { cwd: <worktreePath>, detached: true, stdio: ["ignore", outFd, errFd] })
```
`--no-session` 无记忆、每次全新；`detached` + `proc.unref()` 后台跑；pid 与 log 路径持久化入 `.orchestration-state.json`；stdout/stderr 直写磁盘文件（继承 fd 防管道阻塞）。frontmatter→CLI flag：`parseAgentDefinition` 解析 `name/model/provider/tools/thinking`，`--tools` 仅接受内置工具（BUILTIN_TOOLS 过滤，extension 工具恒在）。

**三角色**：`agents/worker.md`（`model: claude-sonnet-4-5`、`tools: read/write/edit/bash/grep/find`、`thinking: high`）——TDD 实现协议，铁律写死正文：commit 后必写 `.agent-state.json`、每 10 分钟至少心跳、测试不过不许标 completed、只改 task 列文件。`agents/reviewer.md`（`model: gpt-5.3-codex`、`tools: read/bash/grep/find`、`thinking: xhigh`）——输出 `.review-report.json {status(spec_coverage), findings[severity]}`；Pass = 无 high + spec_coverage≥80% + 质量门全过。

**验证门（三层防线）**：① 合并前自动验证：`worktree_merge` 查 `validation.phase.status==="pass" && sha===当前 HEAD`，否则阻塞（force 逃生口）；② scope 门禁：`allowed_files` 经 glob 匹配 `git diff --name-only`，越界直接拦合；③ `/skill:validate-plan`：spec 对齐逐条 + 单元/集成/E2E + 覆盖率≥80% → PASS/PARTIAL/FAIL。

**状态与恢复**：双文件持久化 + supervisor 对账。主仓库 `.orchestration-state.json`（feature/base/agents{pid,branch,task_file,status,worktree_path,run_id,log_dir,validation}）原子写；每 worktree `.agent-state.json`（worker 心跳：status/progress/files/updated_at/error，原子写带 3 次重试）；日志按 run_id 存 `.orchestration-logs/<branch>/<runId>/`。`--resume` 跳过 spawn 直进监控；supervisor 重用 `isPidAlive` 对账（dead→failed，stale→blocked）。

**最可借鉴**：① worktree 隔离 + `.agent-state.json` 心跳协议（零共享内存，全靠文件观测）；② 合并前验证门（sha 钉定，杜绝验旧版混入新版）；③ `allowed_files` 范围门禁拦越界 diff；④ stdout/stderr 直写磁盘 fd；⑤ plan/spec/tasks 制品化 + 会话分支清理。

---

### 04 · pi-flows（声明式 YAML DAG 流程引擎）

**编排模型**：静态声明式 DAG，非动态 LLM 编排。流程定义在 `.pi/flows/flows/<ns>/<name>/flow.yaml`；引擎把扁平步骤按控制流节点切分为 DAG segment（并行波）与 separator step（顺序/路由节点）。并行度由 `max_concurrent`（默认 4）与 `blockedBy` 依赖控制。**没有"主 Agent"**——DAG 本身即编排者，主会话保持交互。五种显式 step type：`agent/fork/agent-decision/code/code-decision`，路由靠 `fork`/`*-decision` 的 `branches:` 显式描述，不靠模型自决。

**子代理派发**：单一 choke point `spawnAgent`（`extensions/flow-engine/execution.ts`），经 SDK `createAgentSession` **同进程内**创建隔离会话。工具以小写数组传入并白名单拦截。`guard.ts` 依 `access` 拦读写与 bash；`fork_session:true` 会 fork 主会话数据。数据流靠 `${{...}}` 模板在派发时拼接上游 `finish({...})` 输出（`${{result.<id>.<output>}}`）；文件类数据传**路径**而非内容。

**三角色**：无内置强制阶段——角色按需组合成 flow，靠 agent 元数据表达。典型 verify/fix 循环用 `blockedBy` 串 `implementer → verifier → should-fix(agent-decision) → fixer/done`，`should-fix` 的 `branches` + `max_iterations:3` 显式表达回归闭环。验证是用户自建 agent（引擎不内建）。

**验证门/回归**：靠 `*-decision` 节点 + 分支路由表达；回归强制靠 `max_iterations`，后向分支必须声明，返回不在 branches 里的分支则硬失败。确定性校验用 `code`/`code-decision` 节点（默认导出 `async (input,ctx)=>output`），把"测试跑没跑过"做成可编程代码而非又一轮 LLM。失败模型 `success/soft/hard`，soft 走 `on_error` 路由。

**状态与恢复（最弱一环）**：不持久化可恢复状态，仅通过 `pi.appendEntry`/`flow:event` 推事件供 TUI/外部观察。无断点续跑——一次跑完，中断即重跑。

**最可借鉴**：① 显式类型化三角色契约：`inputs/outputs/access` 在 frontmatter 声明，typed outputs 跨步骤以真实 JSON 传递、`finish` 层强制校验；② `context_files` + `skills:` 协议注入：`context_files` 把 AGENTS.md 等多文件注入系统提示前置段，`skills:` 只把 SKILL.md 名字/描述/位置注入、正文留待 `read` 按需拉取——即"协议层用 SKILL.md、正文按需加载"的现成范式；③ `fork_session` 与一次性会话隔离。

---

### 05 · pi-orchestration（goal-based 动态编排）

**编排模型**：动态 LLM 编排器（supervisor 模式）。Orchestrator LLM 把 goal 拆成 tasks，经阶段状态机推进：`planning→implementing→verifying→completed`（可 `paused/stopped/failed`）。最小系统提示 + 按触发点 `pi.sendMessage()` 注入情境指导（非把巨型提示塞进 LLM）。

**子代理派发**：每个 task 一次性子进程（`runner/subagent-spawner.ts`）：
```
pi --mode json --no-session --tools <grantlist>
   --append-system-prompt <promptFile> -p "<desc>"
```
工具权限二态：`READ_ONLY_TOOLS="read,ls,find,grep"` vs `FULL_TOOLS="read,write,bash,edit"`；只读型 task 因 `isTaskReadOnly` 拿只读工具集并跳摘要。stdout 走 JSONL 事件流接入 `monitor` + `LoopDetector`，`process-manager.ts` 管生命周期（SIGTERM→SIGKILL 宽限 5000ms）。并发由 `parallelTasks` 控制，`schedulingLock` 防重入。

**三角色**：查 = planner/orchestrator 在 planning 期用只读工具探索建 plan；改 = implementation 子进程（full tools）；审/验 = **Validator 子 agent**（只读 + `orchestrate_validate_pass/fail` 终止信号工具）+ **Code-review 子 agent**（写 `code-review.md`，`orchestrate_code_review_approve/reject`）+ plan-reviewer + summarizer。上下文经 `context-builder.ts` 组装（goal + 依赖摘要 + 已完成任务结果 + `implementation-plan.md` 相关片段按标题匹配抽取，<5 行则跳过），带 JSON data block + 反提示注入警告。

**验证门/回归**：双层门。任务级 Validator（复杂/只读任务后派只读 validator，要求恰好调 `pass/fail` 一个并停；verdict 靠解析 JSONL 工具名判定，fallback regex `VERDICT: PASS/FAIL`，`MAX_ATTEMPTS=2`）。计划级 Code-review + 终审 `orchestrate_approve_goal`；从 `verifying` 可转回 `implementing`（矫正）/ `replanning`（恢复）/ `completed`——这就是**动态回归闭环**：失败经状态机回退 + 补任务。

**状态与恢复（完整断点恢复型）**：磁盘状态在 `.pi/orchestration/plans/`（`plan.json`、`plan.md`、`implementation-plan.md`、`plan-review.md`、`code-review.md`）。`plan.json` 是 `PlanDatabase.toJSON()`；`loadPlan()` 会话启动即恢复，含损坏自愈；原子写（temp+rename+`.old`）；`1000ms` debounced auto-save（`isDirty()` 判定）。`PlanDatabase` 事务 API：深克隆→执行回调→全量校验（依赖环/file-conflict/过大任务）→提交或回滚。恢复路径：`/om-pause`→`paused`、`/om-resume`、`recoverInterruptedTasks()` 重置中断任务为 pending。

**最可借鉴（最贴近本方案的直接范本）**：① 一次性子进程 + 显式工具白名单（`--append-system-prompt` 注入 context）；② 读一条主 SPEC + 按需注入相关片段（避免把整个 SPEC 塞给子 agent，主 Agent 持完整 SPEC、只派发裁剪上下文）；③ 验证门 = 只读 validator + terminate 信号工具（"只审不写"，工具调用而非自由文本做 verdict，防验证者越权）。

---

### 06 · loopengineer（状态机驱动的 loop 编排器）

**编排模型**：Node.js/TS 编排器，显式状态机 `ANALYZE→PLAN→IMPLEMENT→TEST→REVIEW→(FIX|DECIDE)`，仅进 FIX 时 cycle+1。预算 `max_cycles/max_runtime/stop_on_no_progress`；进度由 diff 哈希与失败计数等**机械信号**判定，不请 LLM 判进度。

**子代理派发**：一次性子进程。写角色：`claude -p --output-format json`（acceptEdits + 编辑工具集，任何模式不放行 Bash）；只读角色跑仓库根、写角色跑独立 worktree；上下文经 `<<<UNTRUSTED-DATA` 防火墙包裹。Codex 走 `codex exec --json --sandbox`。

**三角色**：7 个角色模板 + Zod handoff schema；权限双保险（配置层 superRefine 硬绑定 + 调用前 assertRolePermission）。tester 是唯一确定性环节——`shell:false` 精确执行 allowlist 命令，拒 shell 元字符与破坏性命令。

**验证门**：`quality_gates`（require_tests_pass / require_clean_review / block_severities）客观判档；final_judge 无权推翻（clampDecision）。

**状态与恢复**：marked worktree、零 commit/push、逐相位握手产物落盘 run-store。无跨调用记忆（每次全新会话）。

**最可借鉴**：provider 适配抽象、harness 钳制 LLM 判决、确定性测试执行器、上下文防火墙。

---

### 07 · loop-harness（bash 定时调度 + 验证门）

**编排模型**：纯 bash 定时调度器。常驻 orchestrator 每 30s tick，按 cron/every Xm 判到期，受并发上限约束。单条 loop = "一次性会话"：mkdir 锁 → git worktree → 主 agent（`claude -p` 追加 skill.md 作系统提示，`allowedTools` 按 YAML 注入，仅暴露 `LOOP_CONNECTORS/OUTBOX/STATE_SUMMARY` 三环境变量）→ 解析 `RESULT: items=` 行 → 第二 Claude 会话作 skeptical verifier → `VERDICT: PASS` 才许发包 → state 更新。权限边界走物理层：写循环隔离在 worktree，任何外部动作只能 stage 成 `NN-` 前缀 outbox 文件，编排器验证后统一 flush，**主 agent 永不直接评论/推送**。

**三角色**：由 skill.md 定义角色/步骤/成功标准/`RESULT:` 行契约；definitions.yaml 定义节奏/权限/输出类型。验证门是双 LLM 交叉而非确定性命令，机器可查的只有尾行 `VERDICT`——相对 06 是弱项。

**状态与恢复**：小 JSON 文件（processed 去重账本/failures/metrics）；worktree 与锁带超时回收。

**最可借鉴（与"主Agent读SPEC+查改审+SKILL协议层+一次性子进程"几乎一一对应）**：SKILL.md 作为协议层（角色/步骤/成功标准/`RESULT` 行契约）、definitions.yaml 作元数据层（节奏/权限/输出类型）、outbox staging 防越权。

---

### 08 · karl（纯 bash 逐票流水线 + TDD rework loop）

**编排模型**：纯 bash 驱动 Claude 原生 subagent 的逐票流水线。`while` 循环按 PRD 优先级选票，每票经历 planning（planner↔reviewer 审批环 ≤3 轮）→ architect → tester_generate（TDD 先行）→ rework_loop（developer↔tester 交替 ≤10，`failure_source` 归因决定改码还是改测试）→ deploy_gate → merge_safe_check → commit_finalize 合并回 main。

**子代理派发**：统一 `subagent_invoke`：`claude --agent <name> --print --json-schema <SCHEMA> --dangerously-skip-permissions -p`，结构化输出由模型层强制合规、无需后置解析，限流配指数退避。

**三角色**：`.claude/agents/*.md` 的 11 个原生 agent，frontmatter 声明工具白名单（reviewer 只读、developer/tester 含 Bash），禁改 prd.json。

**验证门（三层，均为 LLM 门禁，弱确定性）**：planner 审批 / tester 判罚 / deployment 门。真正确定性的是 `merge_safe_check`（净工作树 + `merge-tree` 干跑查冲突标记）。

**状态与恢复**：状态即 `prd.json`，靠 mkdir 原子锁串行认领/合并/ADR；多实例靠 worktree+仲裁器，每阶段 checkpoint commit 可回溯。

**最可借鉴**：`--json-schema` 模型级输出契约、mkdir 锁三角复用、`failure_source` 归因分流、harness 对 LLM 合并声明的复核。

---

### 09 · athena-loops / agentloop（Python 确定性 harness）

**Harness 模型（核心信条）**：`README.md` ——"**the loop is a harness (deterministic code), not a skill.** A prompt can *describe* 'decompose, review, loop until done' but can't *guarantee* it. So the control flow lives in code, and the model-facing judgement lives in swappable prompts." 分层：`orchestrator.py`+`scheduler.py`+`types.py`（Harness）/ `agent.py`+`adapters/`（Agent seam）/ `roles.py`（Skills=纯字符串，可热改）。闭环 `run_loop`：`budget_exhausted? → iteration++ → _decompose → execute() 扇出 → aggregate() → CommandVerifier → _review → history.append → checkpoint → 判断门`；`review.gates_passed AND review.goal_complete AND all(r.ok) AND all(v.ok) → DONE`，否则 `feedback=build_feedback()` 回 while 顶部 refine。阶段是一等状态（`Phase` 枚举 + `_transition` 广播 `phase_changed`）。子 agent raise 不击穿循环 → 沦为 FAILED TaskResult（可重试）。

**子代理派发**：`Agent` 协议 seam（`AgentRequest{role,system,prompt,context,expects_json}` + `Agent.run()->AgentResponse`）；三角色是同一 `Agent` 用不同 system prompt。CLI 适配（`adapters/cli.py`）：
```
claude -p "{prompt}" --append-system-prompt "{system}" --output-format json [--model M] [--dangerously-skip-permissions]
codex exec [--dangerously-bypass-approvals-and-sandbox] "{combined}"   # {combined}=system+"\n\n"+prompt
opencode run --print-logs [--dangerously-skip-permissions] "{combined}"
aider --message "{combined}" --no-auto-commits [--yes-always|--yes]
```
无占位符走 stdin；有占位符 `stdin=DEVNULL`（防嵌套 CLI 继承 MCP stdin）。worktree 隔离：默认 `isolate=True` → `git worktree add -b agentloop/<ts>-<uuid>`；**每次迭代后 commit checkpoint**；清理策略 auto/always/never。

**三角色（roles.py）**：`DECOMPOSER_SYSTEM`（最小独立子目标 JSON 数组）、`SUBAGENT_SYSTEM`（"ALWAYS inspect current state first and CONTINUE from it, never restart"）、`REVIEWER_SYSTEM`（三闸 quality/consistency/goal_aligned + `goal_complete`，"Be strict"）。retry 时把失败信息写进 `subgoal.notes`，下一轮 `decompose_prompt` 的 REFINEMENT 段 "Plan subgoals ONLY for what still REMAINS"。

**验证门 / "模型不能自证 done"**：确定性 `CommandVerifier`（`subprocess.run(check=False,timeout)`，`exit_code==0` 决定 ok，超时即失败）。reviewer 强制注入 "VERIFICATION RESULTS FROM REAL COMMANDS … If any required verification failed, goal_complete must be false"。完成硬条件 AND：`review.gates_passed && review.goal_complete && all(r.ok) && verification_ok`，验命令红即进不了 DONE。Budget：`max_iterations=5, max_task_retries=1, max_seconds, max_agent_calls`，每轮顶格检查。

**状态与恢复**：`runs.py`：`run_id=时间戳-uuid`，后台线程；`<cwd>/.agentic/runs/<run_id>/`（meta.json、events.jsonl append-only、status.json、result.json、workers/iter<N>_<subgoal>.out）。MCP 工具面：`orchestrate`（默认 detach）/ `orchestrate_status`/`_tail`/`_result`/`_list`。resume：仅 intake 级（`needs_input` 时 base64 token，`orchestrate_resume` 续跑）；进程级随线程死，但 durable = events.jsonl + worktree 每迭代 checkpoint commit。

**最可借鉴**：① Agent 协议 seam（role 是元数据不是类）；② 命令模板 + {prompt}/{system}/{combined} 占位符 + stdin 兜底；③ worktree + 每迭代 commit；④ feedback 管道结构化回灌；⑤ 兜底不崩（分解 JSON 解析失败退化单目标、review JSON 失败=不通过）。

---

### 10 · loopd（PM-Sovereign 运行时）

**Harness 模型**："**PM-Sovereign**: a persistent planner owns judgment; a disposable developer owns implementation; and **the orchestrator owns the rules neither agent can override.**" `loop.py`："this loop decides what is ALLOWED to happen: gates run here, never by an agent, and an empty gate list fails; `accept` is only offered when gates are green … `task_complete` triggers final verification + regression sweep in a PRISTINE worktree." 生命周期：brief→architecture spine→forecast→plan→[dispatch→developer⇄gates→handover→review]→accept·reject·replan·descope·abort→finalize→grade。

**子代理派发**（最激进的"模型不能自证 done"）：verdict 枚举按轮**动态生成**（`pm.py` `directive_schema`）——闸红时 `accept`/`task_complete` **根本不在 schema 里**。"A model therefore cannot mark work done over a failing check; the impossibility is structural." 单次调用 `run_claude`：
```
claude -p <prompt> --output-format json [--model] [--append-system-prompt <pm|dev_system.md>]
   [--allowedTools ...] [--permission-mode bypassPermissions] [--resume <session>]
   [--fork-session] [--json-schema <schema>] [--max-turns N] [--add-dir ...]
```
角色权限分离：PM 只读 `Read,Glob,Grep`；dev 可写 `Read,Edit,Write,Bash,Glob,Grep`。隔离：每次 run 独占分支 `agentic/run-<ts>`，每个 accepted step 一个 commit；最终验证用 `git worktree add --detach HEAD` 的 pristine checkout。门红时用同一 dev session 续跑（`--resume <sid>`）带 gate transcript 重试。

**三角色（prompts/）**：`pm_system.md` 诚实契约——验证命令由 orchestrator 跑"never by you or the developer's self-report"；accept 时每条 criterion 引 ground-truth 证据（真实 git diff 或 gate transcript 原文），token-overlap 校验，禁词表 `_BANNED_EVIDENCE` 干掉废话；integrity flag 触发必须给 `integrity_ack`。`dev_system.md` 一次一步，"Never weaken/delete/trivially-satisfy a check"，结尾 schema-强制结构化摘要。reject 后 `next_prompt` 续同一 dev session。

**验证门 / "模型不能自证 done"**：`gates.py` `run_gates`：空 verify 列表 = 硬失败；`timeout=N;` 前缀；每命令 `start_new_session=true` 独立进程组，超时 killpg 整组；`shell=True` 仅沙箱内。`is_trivial_command` 按 POSIX 退出语义代数分类（拒绝 `true`/bare `echo`/`ls`/`pytest || true`）——PM 没法用空转糊弄绿闸门。三连防堵漏：① trivial 筛查；② 结构不可为（闸红时 schema 无 accept）；③ pristine 重放：`task_complete` 后把 final_verify + **每个 accepted step 的 verify** 全部在 pristine checkout 重跑，exit 0 才算完成。证据接地 + integrity flags（NO_OP_DIFF/TESTS_TOUCHED/GATE_TARGETS_TOUCHED/GATE_CONFIG_TOUCHED→high_risk→需 `integrity_ack`）。

**状态与恢复**：全部在 `<repo>/.agentic/`：`state.json`（原子+fsync）、`log.jsonl`、`handovers/`、`report.md`。run 标识 = started 时间戳。`--resume-run` 重载 state.json 回第一个未完成 step；崩溃精确对账（`pending_commit` 标记 + `adopt_head_if_matches` + `merge-base --is-ancestor`）。PM 每 8 次 review 或 150KB handover 做 checkpoint→`pm.reincarnate()` 丢弃旧 session 重播种（长 run 不涨爆上下文）。

**最可借鉴**：① 动态 verdict schema（结构性防橡皮图章）；② pristine-checkout 重放全部 step verify（"回归铁律"直接模板，exit 0 才算 done）；③ 证据接地校验（token-overlap + 禁词表）；④ integrity flags + `integrity_ack`；⑤ trivial 命令 POSIX 语义筛查；⑥ deterministic 探针词汇表（http/port/docker-build/env-file/proc-up/flow/isolation）；⑦ 每调用后记账 + 超时按历史最大值计费 + retry cap 防洗。

---

## 三、共性设计模式（跨 10 个项目收敛）

1. **控制流=代码，判断=提示词/数据**（09/10 的信条）：`loop 是 harness 不是 skill`。划界了协议层（保护判断 rubric）与物理层（保证流程必定发生）。

2. **模型不能自证 done**（10 最极致）：验证命令 exit 0 AND LLM 评审通过，缺一不可；loopd 在**全新 worktree 上重放全部 step 验证**才算完成——即"回归铁律"的现成模板。

3. **一次性子进程是标准物理层配方**（02/03/05/06/09/10 一致）：
   ```
   pi --mode json -p --no-session --tools <白名单>
      --append-system-prompt <角色文件> "<任务>"
   ```

4. **角色 = frontmatter 即定义**：`name/model/tools/thinking` + 正文铁律（03 的 worker.md 最典型：commit 后必写心跳、测不过不标 done、只改 task 列文件）。

5. **隔离双件套**：worktree（写角色隔离、不自动合并）+ 每迭代 checkpoint commit（09/10），或状态文件心跳（03）。

6. **评审判词结构化**：`VERDICT: PASS` 尾行、`APPROVED/NEEDS_CHANGES`+严重度、`approve/reject` 专用工具调用、`exit code`——全部机器可判。

7. **上下文裁剪而非全量塞**：子 agent 只收相关片段（05 按标题匹配抽 implementation-plan.md）、`${{result.step.summary}}` 模板变量（04）、摘要落 STATE 文件（03）。

8. **恢复三件套**：run_id + 日志账本 + 可续状态；从轻到重 = 会话续跑（02）→ 状态文件对账（03）→ callHash journal 重放（01）。

9. **角色协同 = 最小权限**：验证者/审查者恒只读（`READ_ONLY_TOOLS` / reviewer frontmatter 无 write）；实现者才拿 write/bash；工具白名单化是共同铁律。

10. **预算与终止护栏**：迭代/重试/墙钟/成本，全部由 harness 计数（09）或逐调用记账（10），超限即停且可恢复，防 NO-分支死循环。

---

## 四、对本架构（pi-loop-harness）的映射建议

| 我们组件 | 直接参考 | 参考文件路径 |
|---|---|---|
| SKILL 协议层（角色/步骤/成功标准/RESULT 行） | 07 loop-harness | `07-loop-harness/skills/*.md`、`definitions/*.yaml` |
| 三角色 agent 定义骨架 | 03 agents-workflow | `03-agents-workflow/agents/{worker,reviewer}.md` |
| 派发命令模板 | 03 / 05 | 见"三.3"命令行模板 |
| 回归铁律 | 10 loopd + 03 | 10 的 pristine 重放逻辑、03 的 sha 钉定合并门 |
| 状态/心跳 | 03 | `.orchestration-state.json` + `.agent-state.json` |
| 验证门判词 | 07 + 09 | `VERDICT: PASS` 契约、`CommandVerifier` exit-code 决定 |
| 上下文裁剪 | 05 | `context-builder.ts` 按标题抽取 SPEC 片段 |

### 定位结论（与已拍板方向一致）

- **协议层用 SKILL.md**：参考 07 的 skill 契约（角色/步骤/成功标准/`RESULT` 行），把判断 rubric 收进可热改的纯文本，物理层不必懂业务。
- **三角色 = 三个独立子 skill / agent 定义**：frontmatter（`name/model/tools/thinking` + `allowed-tools`）即角色协议，正文写死铁律。
- **物理层 = 一次性子进程**：`pi --mode json -p --no-session --tools <白名单> --append-system-prompt <角色文件> --session-dir <worktree>`。这是 02/03/05 验证过的标准配方，**不需自造引擎**。
- **回归铁律 = 确定性验证 + 结构化 verdict**：exit code 决定 ok（09 `CommandVerifier`）AND 独立 reviewer 判词（07/03）；pristine worktree 重放（10）作为"回归铁律"的强形态，轻量版可只做 sha 钉定合并门（03）。
- **状态与恢复**：轻量版用主 Agent 轮询 + STATUS.md + 一次性子进程（我们原方案）；若要并行安全借鉴 03 的 `.agent-state.json` 心跳 + supervisor 对账，但那是重工程，需用户拍板。

---

## 五、参考仓库本地路径

```
/mnt/shared/pi-workflows-study/
├── 01-pi-dynamic-workflows/   extensions/ skills/ src/ docs/
├── 02-agent-pi/               agents/ commands/ extensions/ prompts/ skills/ themes/
├── 03-agents-workflow/        scripts/ references/ setup-workflow.sh
├── 04-pi-flows/               agents/ extensions/ skills/ openspec/ docs/
├── 05-pi-orchestration/       index.ts core/ process/ runner/ tools/ commands/
├── 06-loopengineer/           src/ docs/workflow.md docs/architecture.md
├── 07-loop-harness/           orchestrator.sh definitions/ skills/ config.example.yaml
├── 08-karl/                   karl.sh lib/ Input/ Output/ docs/
├── 09-athena-loops/           agentloop/ docs/ (Python: orchestrator.py scheduler.py roles.py)
└── 10-loopd/                  orchestrator/ commands/ docs/ (Python: loop.py gates.py pm.py)
```
