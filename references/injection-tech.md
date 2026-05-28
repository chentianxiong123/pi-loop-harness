# 注入技术参考

> 通过 Windows API 向终端窗口注入文字的技术方案

## 技术原理

### 注入方法

**剪贴板 + Ctrl+V** — 最可靠的后台注入方式

1. 将文字复制到剪贴板
2. AttachThreadInput 到目标线程
3. keybd_event 模拟 Ctrl+V
4. keybd_event 模拟 Enter

### 并发控制

**Named Mutex** — 全局排队

```
MutexName: Global\HermesInjectMutex
Timeout: 60 秒
排队顺序：先请求先注入
```

## 脚本

### inject-target.ps1

通用注入脚本，可指定目标窗口。

```powershell
powershell.exe -Command "& { & 'path/inject-target.ps1' -WindowTitle 'PowerShell 7' -Message '注入内容' }"
```

参数：
- `-WindowTitle`：精确窗口标题
- `-WindowType`：预定义类型（hermes / wt-tab:xxx）
- `-Message`：注入文字
- `-DelayMs`：注入前等待时间

### spawn-agent-window.ps1

创建新终端窗口，启动 CC/Codex。

```powershell
powershell.exe -Command "& { & 'path/spawn-agent-window.ps1' -Agent cc -Project HomeSense -Workspace ws001 -Prompt '做任务' }"
```

参数：
- `-Agent`：cc | codex
- `-Project`：项目名
- `-Workspace`：工作间 ID
- `-Prompt`：注入的 prompt
- `-ProjectPath`：可选，项目根目录

## 窗口定位

### CC/Codex 窗口

- **类名**：CASCADIA_HOSTING_WINDOW_CLASS
- **父窗口标题**：wt.exe 创建的 tab 标题（如 "claude: ws001"）
- **进程**：claude.exe / codex.exe

### Hermes 窗口

- **类名**：CASCADIA_HOSTING_WINDOW_CLASS
- **标题**：PowerShell 7
- **进程**：hermes.exe（通过 python.exe 运行）

## 已知限制

1. **claude.exe/codex.exe 无独立窗口** — 窗口属于 Windows Terminal
2. **prompt_toolkit 不走 Console API** — SendInput 无效，必须用剪贴板注入
3. **后台注入需要 AttachThreadInput** — 否则 keybd_event 只能打到前台窗口
4. **注入后需要等待** — 目标应用需要时间处理粘贴的内容

## 测试验证

注入脚本已在以下环境验证：
- Windows 10
- Windows Terminal
- PowerShell 7
- prompt_toolkit 应用（包括 Hermes）
