#!/usr/bin/env python3
"""
watcher.py — 事件监听进程，检测到新事件后注入到 Hermes 终端
替代旧版 trigger_server + API Server 链路

用法:
  python watcher.py --project HomeSense --once      # 检查一次，有新事件就注入
  python watcher.py --project HomeSense --watch      # 持续监控，有新事件就注入（每2秒检查）

注入到 Hermes 终端的文本格式:
  [事件] WS001 | CC | pending | [CC-WS001] 实现 JWT 登录签发
  [事件] WS001 | Codex | FAIL | [Codex-WS001] 缺少 token 过期校验
  [事件] WS001 | Codex | PASS | [Codex-WS001] 审查通过
"""

import argparse, os, subprocess, sys, time
from pathlib import Path

ARCHIVE_ROOT = Path.home() / ".project-archive"
INJECT_SCRIPT = Path(__file__).parent / "inject-target.ps1"
DEFAULT_TIMEOUT = 1800  # 30 分钟无事件视为超时


def get_events_dir(project: str) -> Path:
    d = ARCHIVE_ROOT / "projects" / project / "events"
    d.mkdir(parents=True, exist_ok=True)
    return d


def read_last_event(project: str) -> dict | None:
    """读取 commit.log 最新一行，解析为事件字典。"""
    commit_log = get_events_dir(project) / "commit.log"
    if not commit_log.exists():
        return None
    content = commit_log.read_text(encoding="utf-8").strip()
    if not content:
        return None
    last_line = content.splitlines()[-1]
    parts = last_line.split("|")
    if len(parts) >= 5:
        msg = "|".join(parts[4:])
        return {
            "timestamp": parts[0],
            "hash": parts[1],
            "author": parts[2],
            "workspace": parts[3],
            "message": msg,
            "raw": last_line,
        }
    return None


def get_last_processed_hash(project: str) -> str:
    """记录上次处理到的 hash，避免重复注入。"""
    marker = get_events_dir(project) / ".last-processed"
    if marker.exists():
        return marker.read_text(encoding="utf-8").strip()
    return ""


def mark_processed(project: str, hash_val: str):
    """标记已处理到某个 hash。"""
    marker = get_events_dir(project) / ".last-processed"
    marker.write_text(hash_val, encoding="utf-8")


def get_dispatch_state(project: str) -> dict:
    """读取 dispatch 状态文件，返回 {workspace: timestamp}。"""
    state_file = get_events_dir(project) / ".dispatch-state"
    if not state_file.exists():
        return {}
    result = {}
    for line in state_file.read_text(encoding="utf-8").strip().splitlines():
        parts = line.split("|", 1)
        if len(parts) == 2:
            result[parts[0]] = int(parts[1])
    return result


def set_dispatch_state(project: str, workspace: str, ts: int):
    """记录某个 workspace 的 dispatch 时间。"""
    state = get_dispatch_state(project)
    state[workspace] = ts
    state_file = get_events_dir(project) / ".dispatch-state"
    lines = [f"{ws}|{t}" for ws, t in state.items()]
    state_file.write_text("\n".join(lines) + "\n", encoding="utf-8")


def clear_dispatch_state(project: str, workspace: str):
    """清除某个 workspace 的 dispatch 状态（收到事件后调用）。"""
    state = get_dispatch_state(project)
    state.pop(workspace, None)
    state_file = get_events_dir(project) / ".dispatch-state"
    lines = [f"{ws}|{t}" for ws, t in state.items()]
    if lines:
        state_file.write_text("\n".join(lines) + "\n", encoding="utf-8")
    elif state_file.exists():
        state_file.unlink()


def check_timeouts(project: str, timeout: int):
    """检查是否有 workspace 超时未响应，有则注入超时警告。"""
    state = get_dispatch_state(project)
    now = int(time.time())
    for ws, ts in list(state.items()):
        elapsed = now - ts
        if elapsed > timeout:
            minutes = elapsed // 60
            msg = f"[超时] {ws} 已 {minutes} 秒无事件，可能卡死。请检查 CC/Codex 进程状态。"
            print(f"  ⏰ {ws}: 超时 {minutes} 分钟")
            inject_to_hermes(msg)
            # 清除状态避免重复告警
            clear_dispatch_state(project, ws)


def build_inject_message(event: dict) -> str:
    """把事件转为注入到 Hermes 的消息文本。"""
    ws = event["workspace"]
    author = event["author"]
    msg = event["message"]
    h = event["hash"]

    # 解析 review 状态
    if "REVIEW-PASS" in msg:
        review = "PASS"
    elif "REVIEW-FAIL" in msg:
        review = "FAIL"
    else:
        review = "pending"

    return f"[事件] {ws} | {author} | {review} | {msg}"


def format_event(event: dict) -> str:
    """格式化事件供打印显示。"""
    ts = time.strftime("%Y-%m-%d %H:%M:%S", time.localtime(int(event["timestamp"])))
    ws = event["workspace"]
    author = event["author"]
    msg = event["message"]

    if "REVIEW-PASS" in msg:
        return f"  {ts} [{ws}] {author}: REVIEW-PASS — 工作间通过"
    elif "REVIEW-FAIL" in msg:
        return f"  {ts} [{ws}] {author}: REVIEW-FAIL — {msg}"
    else:
        return f"  {ts} [{ws}] {author}: {msg}"


def inject_to_hermes(message: str) -> bool:
    """通过 PowerShell 注入脚本把消息打入 Hermes 终端。"""
    if not INJECT_SCRIPT.exists():
        print(f"  ⚠ 注入脚本不存在: {INJECT_SCRIPT}")
        return False

    cmd = [
        "powershell.exe", "-ExecutionPolicy", "Bypass", "-File",
        str(INJECT_SCRIPT),
        "-WindowTitle", "PowerShell 7",
        "-Message", message,
    ]

    try:
        result = subprocess.run(
            cmd,
            timeout=15,
            capture_output=True,
            text=True,
            env={**os.environ, "PYTHONHOME": ""},
        )
        if result.returncode == 0:
            return True
        else:
            print(f"  ⚠ 注入失败: {result.stderr[:200]}")
            return False
    except subprocess.TimeoutExpired:
        print(f"  ⚠ 注入超时")
        return False
    except FileNotFoundError:
        print(f"  ⚠ 找不到 powershell.exe")
        return False


def process_new_event(project: str) -> bool:
    """处理一个未处理的新事件。"""
    event = read_last_event(project)
    if not event:
        return False

    last_hash = get_last_processed_hash(project)
    if event["hash"] == last_hash:
        return False  # 已处理过

    # 打印事件
    print(format_event(event))

    # 构建注入消息
    inject_msg = build_inject_message(event)

    # 注入到 Hermes
    print(f"  → 注入到 Hermes: {inject_msg}")
    success = inject_to_hermes(inject_msg)

    # 标记已处理
    if success:
        mark_processed(project, event["hash"])
        # 收到事件，清除该 workspace 的超时计时
        clear_dispatch_state(project, event["workspace"])
        print(f"  → 已标记处理: {event['hash']}")
        # 清理 .new-event 信号（旧版兼容）
        signal = get_events_dir(project) / ".new-event"
        signal.unlink(missing_ok=True)

    return success


def main():
    parser = argparse.ArgumentParser(description="事件监听进程")
    parser.add_argument("--project", required=True, help="项目名")
    parser.add_argument("--once", action="store_true", help="只检查一次")
    parser.add_argument("--watch", action="store_true", help="持续监控")
    parser.add_argument("--interval", type=int, default=2, help="轮询间隔（秒，--watch 模式）")
    parser.add_argument("--timeout", type=int, default=DEFAULT_TIMEOUT, help="超时秒数（--watch 模式，默认 1800）")
    parser.add_argument("--mark-dispatch", metavar="WS", help="标记某个 workspace 为已派发（开始计时）")
    args = parser.parse_args()

    if not args.once and not args.watch:
        print(__doc__)
        sys.exit(1)

    events_dir = get_events_dir(args.project)
    
    # --mark-dispatch 模式：记录派发时间后退出
    if args.mark_dispatch:
        set_dispatch_state(args.project, args.mark_dispatch, int(time.time()))
        print(f"✓ 已标记 {args.mark_dispatch} 为已派发，超时 {args.timeout}s")
        sys.exit(0)
    
    mode = "once" if args.once else "watch"
    print(f"🔍 watcher — 项目: {args.project} — 模式: {mode}")
    print(f"   事件目录: {events_dir}")

    if args.once:
        result = process_new_event(args.project)
        if not result:
            print("   （无新事件）")
        sys.exit(0)

    # watch 模式
    print(f"   轮询间隔: {args.interval}s")
    print(f"   超时阈值: {args.timeout}s")
    print("   等待事件...\n")

    try:
        while True:
            try:
                process_new_event(args.project)
                check_timeouts(args.project, args.timeout)
            except Exception as e:
                print(f"  ⚠ 处理事件出错: {e}")
            time.sleep(args.interval)
    except KeyboardInterrupt:
        print("\n👋 watcher 已停止")


if __name__ == "__main__":
    main()
