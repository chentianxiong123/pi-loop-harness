# spawn-agent-window.ps1
# 创建新的 Windows Terminal 窗口，启动交互式 CC/Codex 会话
# 用法:
#   powershell.exe -ExecutionPolicy Bypass -File spawn-agent-window.ps1 \
#     -Exe "path\claude.exe" -SessionId "uuid" -Workspace "ws001-jwt" -Prompt "..." [-ProjectPath "path"]

param(
    [Parameter(Mandatory=$true)]
    [string]$Exe,
    [Parameter(Mandatory=$true)]
    [string]$SessionId,
    [Parameter(Mandatory=$true)]
    [string]$Workspace,
    [Parameter(Mandatory=$true)]
    [string]$Prompt,
    [string]$ProjectPath = ""
)

$ErrorActionPreference = "Stop"

# === 1. 验证可执行文件 ===
if (-not (Test-Path $Exe)) {
    Write-Host "Error: executable not found: $Exe"
    exit 1
}

$exeName = Split-Path $Exe -Leaf
Write-Host "Spawning $exeName session: $SessionId"

# === 2. 启动交互式终端窗口 ===
# 不用 -p，启动交互式会话
# powershell -NoExit 确保窗口不会因进程退出而关闭

$wtTitle = "$exeName - $Workspace"

if ($ProjectPath) {
    $shellCmd = "cd '$ProjectPath'; & '$Exe' --resume $SessionId"
} else {
    $shellCmd = "& '$Exe' --resume $SessionId"
}

$wtArgs = @(
    "new-tab",
    "--title", $wtTitle,
    "--",
    "powershell", "-NoExit", "-Command", $shellCmd
)

try {
    $proc = Start-Process "wt.exe" -ArgumentList $wtArgs -PassThru -NoNewWindow:$false
    Write-Host "WT window created (PID: $($proc.Id))"
    Write-Host "SESSION=$SessionId"
    Write-Host "TITLE=$wtTitle"

    # === 3. 等待窗口出现 + CC/Codex 初始化 ===
    # CC/Codex 启动 + prompt_toolkit 初始化需要时间
    Write-Host "Waiting for $exeName to initialize (8s)..."
    Start-Sleep -Seconds 8

    # === 4. 注入初始 prompt ===
    $injectScript = Join-Path $PSScriptRoot "inject-target.ps1"

    Write-Host "Injecting prompt to window: $wtTitle"
    $result = & powershell.exe -ExecutionPolicy Bypass -File $injectScript -WindowTitle $wtTitle -Message $Prompt 2>&1
    Write-Host $result

    Write-Host "Done. $exeName session $SessionId is running (interactive mode)."

} catch {
    Write-Host "Error: $_"
    exit 1
}
