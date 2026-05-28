# inject-target.ps1
# 通用注入脚本：可指定目标窗口标题，向其中注入文字
# 用途：向 Hermes / CC / Codex 终端窗口注入 prompt 或事件通知
#
# 用法:
#   powershell.exe -Command "& { & 'path/inject-target.ps1' -HWND 123456 -Message 'prompt text' }"
#   powershell.exe -Command "& { & 'path/inject-target.ps1' -WindowTitle 'hermes:ws001' -Message '事件到达' }"
#   powershell.exe -Command "& { & 'path/inject-target.ps1' -WindowType 'hermes' -Message '事件到达' }"
#
# 参数:
#   -HWND        : 直接指定窗口句柄（最可靠，绕过标题匹配）
#   -WindowTitle : 精确窗口标题匹配
#   -WindowType  : 预定义窗口类型 ('hermes' | 'wt-tab:<标题>')
#   -Message     : 要注入的文字内容
#   -DelayMs     : 注入前等待时间（毫秒），默认 500

param(
    [long]$HWND = 0,
    [string]$WindowTitle,
    [string]$WindowType,
    [string]$Message,
    [int]$DelayMs = 500
)

$ErrorActionPreference = "Stop"

# === 1. 找目标窗口 ===

# 如果直接指定了 HWND，跳过标题匹配
if ($HWND -gt 0) {
    $hWnd = [IntPtr]::new($HWND)
    Write-Host "Using direct HWND: $HWND"
} else {

function Find-Window {
    param([string]$TitlePattern)
    
    Add-Type @"
using System;
using System.Runtime.InteropServices;
using System.Text;
public class W {
    [DllImport("user32.dll")] public static extern IntPtr FindWindow(string c, string w);
    [DllImport("user32.dll")] public static extern IntPtr FindWindowEx(IntPtr parent, IntPtr child, string c, string w);
    [DllImport("user32.dll")] public static extern int GetWindowThreadProcessId(IntPtr hWnd, out int lpdwProcessId);
    [DllImport("user32.dll")] public static extern int GetWindowText(IntPtr hWnd, StringBuilder lpString, int nMaxCount);
    [DllImport("user32.dll")] public static extern int GetClassName(IntPtr hWnd, StringBuilder lpString, int nMaxCount);
    [DllImport("user32.dll")] public static extern bool IsWindowVisible(IntPtr hWnd);
}
"@

    # 先尝试直接 FindWindow
    $buf = New-Object System.Text.StringBuilder(256)
    $hWnd = [W]::FindWindow($null, $TitlePattern)
    if ($hWnd -ne [IntPtr]::Zero) {
        Write-Host "Found window by title: $TitlePattern (HWND: $($hWnd.ToInt64()))"
        return $hWnd
    }
    
    # 枚举所有 WT 窗口，找子窗口标题匹配
    $parent = [IntPtr]::Zero
    while ($true) {
        $parent = [W]::FindWindowEx([IntPtr]::Zero, $parent, "CASCADIA_HOSTING_WINDOW_CLASS", $null)
        if ($parent -eq [IntPtr]::Zero) { break }
        
        # WT 的主窗口子节点
        $hostWindow = [W]::FindWindowEx($parent, [IntPtr]::Zero, "CASCADIA_ROOT_EMBEDDING_WINDOW", $null)
        if ($hostWindow -eq [IntPtr]::Zero) {
            # 可能直接是标题
            [W]::GetWindowText($parent, $buf, 256)
            if ($buf.ToString() -eq $TitlePattern) {
                return $parent
            }
            continue
        }
        
        # 检查子窗口标题
        [W]::GetWindowText($hostWindow, $buf, 256)
        if ($buf.ToString() -eq $TitlePattern) {
            return $parent  # 注入到父 WT 窗口
        }
    }
    
    # 最后尝试用 PowerShell 7 窗口名（Hermes 的主窗口）
    if ($TitlePattern -eq "PowerShell 7" -or $TitlePattern -eq "hermes") {
        $h = [W]::FindWindow("CASCADIA_HOSTING_WINDOW_CLASS", "PowerShell 7")
        if ($h -ne [IntPtr]::Zero) {
            return $h
        }
    }
    
    Write-Host "Window not found: $TitlePattern"
    return [IntPtr]::Zero
}

# 解析 WindowType
$targetTitle = $WindowTitle

if ($WindowType -eq "hermes") {
    $targetTitle = "PowerShell 7"
} elseif ($WindowType -match '^wt-tab:(.+)$') {
    $targetTitle = $Matches[1]
}

if (-not $targetTitle) {
    Write-Host "Error: need -WindowTitle or -WindowType"
    exit 1
}

if (-not $Message) {
    Write-Host "Error: need -Message"
    exit 1
}

$hWnd = Find-Window $targetTitle
if ($hWnd -eq [IntPtr]::Zero) {
    Write-Host "Error: cannot find target window"
    exit 1
}
} # end else (not direct HWND)

Write-Host "Target: HWND=$($hWnd.ToInt64()) Title=$targetTitle"

# === 2. 等待窗口就绪 ===

Start-Sleep -Milliseconds $DelayMs

# === 3. 注入文字 ===

# 使用剪贴板 + Ctrl+V 注入（最可靠的后台注入方式）
$MUTEX_NAME = "Global\HermesInjectMutex"

$mutex = $null
try {
    $mutex = New-Object System.Threading.Mutex($false, $MUTEX_NAME)
    $handle = $mutex.WaitOne(60000)
    
    if (-not $handle) {
        Write-Host "Queue timeout"
        exit 1
    }
    
    Add-Type @`"
using System;
using System.Runtime.InteropServices;
public class I {
    [DllImport("user32.dll")] public static extern int GetWindowThreadProcessId(IntPtr hWnd, out int lpdwProcessId);
    [DllImport("user32.dll")] public static extern bool AttachThreadInput(uint idAttach, uint idAttachTo, bool fAttach);
    [DllImport("user32.dll")] public static extern bool OpenClipboard(IntPtr hWndNewOwner);
    [DllImport("user32.dll")] public static extern bool CloseClipboard();
    [DllImport("user32.dll")] public static extern bool EmptyClipboard();
    [DllImport("user32.dll")] public static extern IntPtr SetClipboardData(uint uFormat, IntPtr hMem);
    [DllImport("user32.dll")] public static extern IntPtr GetClipboardData(uint uFormat);
    [DllImport("user32.dll")] public static extern void keybd_event(byte bVk, byte bScan, uint dwFlags, IntPtr dwExtraInfo);
    [DllImport("kernel32.dll")] public static extern IntPtr GlobalAlloc(uint uFlags, UIntPtr dwBytes);
    [DllImport("kernel32.dll")] public static extern IntPtr GlobalLock(IntPtr hMem);
    [DllImport("kernel32.dll")] public static extern bool GlobalUnlock(IntPtr hMem);
    public const uint GMEM_MOVEABLE = 0x0002;
    public const uint CF_UNICODETEXT = 13;
}
"@`"
    
    $pidOut = 0
    $threadId = [I]::GetWindowThreadProcessId($hWnd, [ref]$pidOut)
    $myThreadId = [System.Threading.Thread]::CurrentThread.ManagedThreadId
    
    [I]::AttachThreadInput($threadId, $myThreadId, $true)
    
    # 复制文本到剪贴板
    # 先保存原剪贴板内容
    $savedClipboard = $null
    [I]::OpenClipboard([IntPtr]::Zero)
    $hClip = [I]::GetClipboardData([I]::CF_UNICODETEXT)
    if ($hClip -ne [IntPtr]::Zero) {
        $pClip = [I]::GlobalLock($hClip)
        if ($pClip -ne [IntPtr]::Zero) {
            $savedClipboard = [System.Runtime.InteropServices.Marshal]::PtrToStringUni($pClip)
            [I]::GlobalUnlock($hClip)
        }
    }
    [I]::CloseClipboard()

    # 写入要注入的文本
    $text = $Message + "`0"
    $bytes = [System.Text.Encoding]::Unicode.GetBytes($text)
    $size = [System.IntPtr]::New($bytes.Length)
    $hMem = [I]::GlobalAlloc([I]::GMEM_MOVEABLE, $size)
    $locked = [I]::GlobalLock($hMem)
    [System.Runtime.InteropServices.Marshal]::Copy($bytes, 0, $locked, $bytes.Length)
    [I]::GlobalUnlock($hMem)
    
    [I]::OpenClipboard([IntPtr]::Zero)
    [I]::EmptyClipboard()
    [I]::SetClipboardData([I]::CF_UNICODETEXT, $hMem)
    [I]::CloseClipboard()
    
    Start-Sleep -Milliseconds 100
    
    # Ctrl+V
    [I]::keybd_event(0x11, 0, 0, [IntPtr]::Zero)  # Ctrl down
    Start-Sleep -Milliseconds 50
    [I]::keybd_event(0x56, 0, 0, [IntPtr]::Zero)  # V down
    Start-Sleep -Milliseconds 50
    [I]::keybd_event(0x56, 0, 2, [IntPtr]::Zero)  # V up
    Start-Sleep -Milliseconds 50
    [I]::keybd_event(0x11, 0, 2, [IntPtr]::Zero)  # Ctrl up
    
    Start-Sleep -Milliseconds 200
    
    # Enter
    [I]::keybd_event(0x0D, 0, 0, [IntPtr]::Zero)
    Start-Sleep -Milliseconds 50
    [I]::keybd_event(0x0D, 0, 2, [IntPtr]::Zero)
    
    [I]::AttachThreadInput($threadId, $myThreadId, $false)
    
    # 恢复原剪贴板
    Start-Sleep -Milliseconds 200
    if ($savedClipboard) {
        $restoreBytes = [System.Text.Encoding]::Unicode.GetBytes($savedClipboard + "`0")
        $restoreSize = [System.IntPtr]::New($restoreBytes.Length)
        $hRestore = [I]::GlobalAlloc([I]::GMEM_MOVEABLE, $restoreSize)
        $lockedRestore = [I]::GlobalLock($hRestore)
        [System.Runtime.InteropServices.Marshal]::Copy($restoreBytes, 0, $lockedRestore, $restoreBytes.Length)
        [I]::GlobalUnlock($hRestore)
        [I]::OpenClipboard([IntPtr]::Zero)
        [I]::EmptyClipboard()
        [I]::SetClipboardData([I]::CF_UNICODETEXT, $hRestore)
        [I]::CloseClipboard()
        Write-Host "Clipboard restored"
    }

    Write-Host "Injected: $Message"
    
} finally {
    if ($mutex) {
        $mutex.ReleaseMutex()
        $mutex.Dispose()
    }
}
