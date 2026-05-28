#!/usr/bin/env python3
"""
dispatch.py — 终端窗口派发工具
通过 spawn-agent-window.ps1 创建 CC/Codex 终端窗口，并标记超时计时。

用法:
  python dispatch.py spawn-cc --workspace WS001 --project HomeSense --prompt "..." --session-id "uuid" [--project-path "..."]
  python dispatch.py spawn-codex --workspace WS001 --project HomeSense --prompt "..." --session-id "uuid" [--project-path "..."]
"""

import os, subprocess, sys, uuid
from pathlib import Path

# 可执行文件路径（通过环境变量或默认值覆盖）
CC_EXE = os.environ.get("CC_EXE", r"D:\Program Files (x86)\nvm\v22.22.2\node_modules\@anthropic-ai\claude-code\bin\claude.exe")
CODEX_EXE = os.environ.get("CODEX_EXE", r"D:\Program Files (x86)\nvm\v22.22.2\node_modules\@openai\codex\node_modules\@openai\codex-win32-x64\vendor\x86_64-pc-windows-msvc\codex\codex.exe")

AGENT_EXES = {"cc": CC_EXE, "codex": CODEX_EXE}


def spawn_terminal_window(agent: str, project: str, ws_id: str, prompt: str,
                          session_id: str = "", project_path: str = ""):
    """通过 PowerShell 调用 spawn-agent-window.ps1 创建终端窗口。"""
    script = Path(__file__).parent / "spawn-agent-window.ps1"
    watcher_script = Path(__file__).parent / "watcher.py"

    if not script.exists():
        print(f"❌ 找不到注入脚本: {script}")
        return False

    exe = AGENT_EXES.get(agent)
    if not exe or not Path(exe).exists():
        print(f"❌ 找不到 {agent} 可执行文件: {exe}")
        return False

    if not session_id:
        session_id = str(uuid.uuid4())

    cmd = [
        "powershell.exe", "-ExecutionPolicy", "Bypass", "-File",
        str(script),
        "-Exe", exe,
        "-SessionId", session_id,
        "-Workspace", ws_id,
        "-Prompt", prompt,
    ]

    if project_path:
        cmd += ["-ProjectPath", project_path]

    print(f"🚀 spawn {agent}: session={session_id} workspace={ws_id}")

    try:
        result = subprocess.run(
            cmd,
            timeout=30,
            capture_output=True,
            text=True,
            env={**os.environ, "PYTHONHOME": ""},
        )
        print(result.stdout)
        if result.stderr:
            print(f"STDERR: {result.stderr[:500]}")

        if result.returncode == 0:
            # 派发成功，标记超时计时
            mark_cmd = [
                sys.executable, str(watcher_script),
                "--project", project,
                "--mark-dispatch", ws_id,
                "--timeout", "1800",
            ]
            subprocess.run(mark_cmd, capture_output=True, env={**os.environ, "PYTHONHOME": ""})

        return result.returncode == 0
    except FileNotFoundError:
        print(f"❌ 找不到 powershell.exe")
        return False
    except subprocess.TimeoutExpired:
        print(f"⏰ spawn 超时（30s）")
        return False


def main():
    args = [a for a in sys.argv[1:] if not a.startswith("--")]
    flags = {}
    i = 1
    while i < len(sys.argv):
        if sys.argv[i] == "--workspace" and i + 1 < len(sys.argv):
            flags["workspace"] = sys.argv[i + 1]; i += 2
        elif sys.argv[i] == "--project" and i + 1 < len(sys.argv):
            flags["project"] = sys.argv[i + 1]; i += 2
        elif sys.argv[i] == "--prompt" and i + 1 < len(sys.argv):
            flags["prompt"] = sys.argv[i + 1]; i += 2
        elif sys.argv[i] == "--session-id" and i + 1 < len(sys.argv):
            flags["session_id"] = sys.argv[i + 1]; i += 2
        elif sys.argv[i] == "--project-path" and i + 1 < len(sys.argv):
            flags["project_path"] = sys.argv[i + 1]; i += 2
        else:
            i += 1

    if not args:
        print(__doc__)
        sys.exit(1)

    action = args[0]
    project = flags.get("project", Path.cwd().name)
    ws_id = flags.get("workspace", "")
    prompt = flags.get("prompt", "")
    session_id = flags.get("session_id", "")
    project_path = flags.get("project_path", "")

    if not ws_id or not prompt:
        print("❌ 需要 --workspace 和 --prompt")
        sys.exit(1)

    ws_id = ws_id.lower()

    if action == "spawn-cc":
        spawn_terminal_window("cc", project, ws_id, prompt, session_id, project_path)
    elif action == "spawn-codex":
        spawn_terminal_window("codex", project, ws_id, prompt, session_id, project_path)
    else:
        print(__doc__)
        sys.exit(1)


if __name__ == "__main__":
    main()
