# 事件处理 Prompt 模板

> Hermes 收到 watcher 注入的 [事件] 消息后，用这些 prompt 派发下一步。
> 这些是 Hermes 内部使用的模板，不是直接注入给 CC/Codex 的。

## 事件到达后 Hermes 的决策 prompt

### CC 提交 → 派 Codex 审查

```
工作间 {workspace} 的 CC 已完成提交。
Read {workspace_dir}/STATUS.md 了解约束条件。

Commit: {hash}
Message: {message}
当前轮次: {round}

请决定下一步：
1. 创建 Codex 审查终端
2. 注入审查 prompt（读取 STATUS.md 和最新 commit 变更）
3. 等待 Codex 完成审查
```

### Codex REVIEW-FAIL → 派 CC 修复

```
工作间 {workspace} 的 Codex 审查未通过。
Read {workspace_dir}/STATUS.md 了解上下文。

Commit: {hash}
Message: {message}
Codex 意见: {message 中的具体意见}
当前轮次: {round}

请：
1. 创建 CC 修复终端
2. 注入修复 prompt（包含 Codex 的具体意见和文件路径）
3. CC 修复后 commit
```

### Codex REVIEW-PASS → 归档

```
工作间 {workspace} 已通过 Codex 审查（REVIEW-PASS）。
Read {workspace_dir}/STATUS.md 了解最终迭代记录。

Commit: {hash}
Message: {message}
共 {round} 轮对证。

请：
1. 更新项目 STATUS.md 标记 ws001 为 completed
2. 读取最终代码，确认质量
3. 执行归档流程（archive-decision.py + update-status.py）
4. 清理工作间分支
```

### 轮次超限 → 仲裁

```
工作间 {workspace} 对证已达 {round} 轮（>=5），仍未统一。
Read {workspace_dir}/STATUS.md 获取完整迭代记录。

Commit: {hash}
Message: {message}

请仲裁：
1. 读取全部 commit 内容
2. 做出技术决策
3. 标记为 completed，写入仲裁意见
4. 执行归档（不完美但已尽力）
```

---

## 注入给 CC 的 prompt 模板

### 初始任务

```
在工作间 {workspace} 下实现任务。

读 ~/.project-archive/projects/{project}/workspaces/{workspace}/STATUS.md 了解约束条件。

任务：{prompt}

要求：
1. 创建代码文件
2. git add + git commit -m "[CC-{workspace.upper()}] {prompt summary}"
3. commit 后 hook 会自动触发下一轮
```

### 修复

```
Codex 审查了你的代码，需要修复。

读 ~/.project-archive/projects/{project}/workspaces/{workspace}/STATUS.md 了解上下文。
查看 git log 了解最新 commit。

Codex 意见：{codex_opinion}

要求：
1. 修改代码修复问题
2. git add + git commit -m "[CC-{workspace.upper()}] 修复: {summary}"
```

---

## 注入给 Codex 的 prompt 模板

### 审查

```
审查工作间 {workspace} 的代码变更。

读 ~/.project-archive/projects/{project}/workspaces/{workspace}/STATUS.md 了解约束条件。
查看 git log 了解最近 commit。

检查项：
1. 安全性（注入、权限验证、认证）
2. 完整性（边界处理、错误处理）
3. 是否符合约束条件
4. 代码风格

如果通过：
  git commit -m "[Codex-{workspace.upper()}] REVIEW-PASS: 审查通过"

如果未通过：
  git commit -m "[Codex-{workspace.upper()}] REVIEW-FAIL: {具体问题}"
  在 commit message 中包含具体修改建议
```

---

## 超时处理

Hermes 收到 `[超时]` 消息时（watcher 检测到某 workspace 长时间无事件）：

```
工作间 {workspace} 已超时（{minutes} 分钟无事件）。

请检查：
1. CC/Codex 进程是否还在运行（tasklist | findstr claude/codex）
2. 如果进程还在 → 可能是卡住了，kill 后重新派发
3. 如果进程已退出 → 检查是否有未 commit 的改动（git status）
4. 如果有未提交改动 → 手动 commit + 继续流程
5. 如果没有改动 → 重新派发任务

超时原因可能是：
- CC/Codex 遇到错误退出
- CC/Codex 在等待输入（注入的 prompt 丢失）
- Hook 没有触发（commit message 格式不对）
```
