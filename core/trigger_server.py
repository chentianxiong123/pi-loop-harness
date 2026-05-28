#!/usr/bin/env python3
"""
trigger_server.py — 事件分发器（简化版）
旧版用 HTTP Server + API Server 链路。
新版改为：只负责路由决策，由 watcher 检测事件后调用。

用法:
  python trigger_server.py route --event cc-commit --workspace WS001 --project HomeSense --message "..." --hash "abc123"
  python trigger_server.py route --event codex-commit --workspace WS001 --project HomeSense --message "..." --hash "abc123"
  python trigger_server.py show-status --workspace WS001 --project HomeSense

路由决策:
  cc-commit     → "派 Codex 审查工作间 WS001"
  codex-commit + PASS → "执行归档"
  codex-commit + FAIL → "派 CC 修复"
  codex-commit + 轮次>=5 → "仲裁"
"""

import argparse, json, os, sys, time
from pathlib import Path

ARCHIVE_ROOT = Path.home() / ".project-archive"


def get_workspace_status(project: str, workspace: str) -> dict:
    """读取工作间 STATUS.md 的状态信息。"""
    workspace = workspace.lower()
    ws_dir = ARCHIVE_ROOT / "projects" / project / "workspaces" / workspace
    status_file = ws_dir / "STATUS.md"
    if not status_file.exists():
        return {"status": "unknown", "round": 0}

    content = status_file.read_text(encoding="utf-8")
    result = {"status": "unknown", "round": 0}

    for line in content.splitlines():
        stripped = line.strip()
        if stripped in ("created", "in-progress", "completed", "escalated"):
            result["status"] = stripped

    # 统计迭代轮次
    in_table = False
    table_rows = 0
    for line in content.splitlines():
        if line.startswith("| 轮次"):
            in_table = True
            continue
        if in_table and line.startswith("|---"):
            continue
        if in_table and line.startswith("|"):
            table_rows += 1
        elif in_table and not line.startswith("|"):
            in_table = False

    result["round"] = table_rows
    return result


def route_event(event_type: str, project: str, workspace: str,
                message: str, commit_hash: str) -> dict:
    """根据事件类型返回路由决策。"""
    ws_status = get_workspace_status(project, workspace)
    decision = {
        "action": None,
        "agent": None,
        "prompt": None,
        "reason": "",
    }

    if event_type == "cc-commit":
        decision["action"] = "spawn-codex"
        decision["agent"] = "codex"
        decision["prompt"] = (
            f"审查工作间 {workspace} 的代码变更。\n"
            f"Read {ARCHIVE_ROOT / 'projects' / project / 'workspaces' / workspace / 'STATUS.md'} "
            f"了解约束条件。\n\n"
            f"Commit: {commit_hash}\n"
            f"Message: {message}\n"
            f"当前轮次: {ws_status['round']}\n\n"
            f"请审查代码安全性、完整性、是否符合约束。"
        )
        decision["reason"] = f"CC 提交，派发 Codex 审查"

    elif event_type == "codex-commit":
        if ws_status["round"] >= 5:
            decision["action"] = "escalate"
            decision["agent"] = "hermes"
            decision["prompt"] = (
                f"工作间 {workspace} 对证已达 {ws_status['round']} 轮，仍未统一。\n"
                f"Commit: {commit_hash}\n"
                f"Message: {message}\n\n"
                f"请仲裁。"
            )
            decision["reason"] = f"轮次超限（{ws_status['round']} >= 5），仲裁"

        elif "REVIEW-PASS" in message:
            decision["action"] = "archive"
            decision["agent"] = "hermes"
            decision["prompt"] = (
                f"工作间 {workspace} 已通过审查（REVIEW-PASS）。\n"
                f"Commit: {commit_hash}\n"
                f"Message: {message}\n"
                f"共 {ws_status['round']} 轮对证。\n\n"
                f"请执行终审和归档。"
            )
            decision["reason"] = f"REVIEW-PASS，执行归档"

        else:
            decision["action"] = "spawn-cc"
            decision["agent"] = "cc"
            decision["prompt"] = (
                f"Codex 审查未通过，需要修复。\n"
                f"Commit: {commit_hash}\n"
                f"Message: {message}\n"
                f"当前轮次: {ws_status['round']}\n\n"
                f"请读取工作间 STATUS.md 了解需求，修复审查意见中提到的问题。"
            )
            decision["reason"] = f"REVIEW-FAIL，派 CC 修复"

    return decision


def main():
    parser = argparse.ArgumentParser(description="事件路由决策器")
    parser.add_argument("action", choices=["route", "show-status"], help="操作类型")
    parser.add_argument("--event", help="事件类型: cc-commit | codex-commit")
    parser.add_argument("--workspace", help="工作间 ID")
    parser.add_argument("--project", help="项目名")
    parser.add_argument("--message", help="commit message")
    parser.add_argument("--hash", help="git hash")
    args = parser.parse_args()

    if args.action == "route":
        if not all([args.event, args.workspace, args.project]):
            print("❌ route 需要 --event, --workspace, --project")
            sys.exit(1)

        decision = route_event(
            args.event, args.project, args.workspace,
            args.message or "", args.hash or ""
        )

        print(f"路由决策: {json.dumps(decision, ensure_ascii=False, indent=2)}")
        
        # 写入决策文件（供 Hermes 读取）
        events_dir = ARCHIVE_ROOT / "projects" / args.project / "events"
        events_dir.mkdir(parents=True, exist_ok=True)
        dec_file = events_dir / f".decision-{int(time.time())}.json"
        dec_file.write_text(json.dumps(decision, ensure_ascii=False, indent=2), encoding="utf-8")
        print(f"决策写入: {dec_file}")

    elif args.action == "show-status":
        if not all([args.workspace, args.project]):
            print("❌ show-status 需要 --workspace, --project")
            sys.exit(1)
        ws_status = get_workspace_status(args.project, args.workspace)
        print(f"工作间状态: {json.dumps(ws_status, ensure_ascii=False, indent=2)}")


if __name__ == "__main__":
    main()
