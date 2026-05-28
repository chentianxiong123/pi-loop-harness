#!/usr/bin/env python3
"""
workspace.py — 工作间管理工具
创建、查看、列出项目的工作间。

用法:
  python workspace.py create <workspace-id> --project NAME --task "描述" [--constraints "约束"]
  python workspace.py list --project NAME
  python workspace.py status <workspace-id> --project NAME

注意：--task 和 --constraints 支持两种格式：
  --task "描述"  或  --task="描述"
"""

import json, os, sys, time
from pathlib import Path

ARCHIVE_ROOT = Path.home() / ".project-archive"

def get_workspaces_dir(project: str) -> Path:
    d = ARCHIVE_ROOT / "projects" / project / "workspaces"
    d.mkdir(parents=True, exist_ok=True)
    return d

def get_workspace_dir(project: str, ws_id: str) -> Path:
    return get_workspaces_dir(project) / ws_id

def create_workspace(project: str, ws_id: str, task: str, constraints: str = ""):
    ws_id = ws_id.lower()
    ws_dir = get_workspace_dir(project, ws_id)
    if ws_dir.exists():
        print(f"❌ 工作间 {ws_id} 已存在")
        return False
    ws_dir.mkdir(parents=True, exist_ok=True)
    branch = f"ws/{ws_id}"
    (ws_dir / "branch").write_text(branch, encoding="utf-8")
    content = f"""# {ws_id} — {task}
> 分支: {branch}
> 创建: {time.strftime("%Y-%m-%d %H:%M")}

## 任务
{task}

## 约束
{constraints or "无"}

## 迭代记录
| 轮次 | CC 做了什么 | Codex 审了什么 | 结论 |
|------|-------------|----------------|------|

## 审查意见（最新）
-

## 状态
created
"""
    (ws_dir / "STATUS.md").write_text(content, encoding="utf-8")
    print(f"✅ 创建工作间: {ws_id}")
    print(f"   分支: {branch}")
    print(f"   路径: {ws_dir}")
    return True

def list_workspaces(project: str):
    ws_dir = get_workspaces_dir(project)
    workspaces = []
    for d in sorted(ws_dir.iterdir()):
        if d.is_dir() and (d / "STATUS.md").exists():
            status = "unknown"
            for line in (d / "STATUS.md").read_text(encoding="utf-8").splitlines():
                if line.startswith("## 状态"):
                    continue
                if line.strip().startswith("created") or line.strip().startswith("in-progress") or \
                   line.strip().startswith("completed") or line.strip().startswith("escalated"):
                    status = line.strip()
                    break
            branch = (d / "branch").read_text(encoding="utf-8").strip() if (d / "branch").exists() else "?"
            workspaces.append({"id": d.name, "branch": branch, "status": status})
    return workspaces

def get_workspace_status(project: str, ws_id: str):
    ws_dir = get_workspace_dir(project, ws_id)
    if not ws_dir.exists():
        print(f"❌ 工作间 {ws_id} 不存在")
        return None
    return (ws_dir / "STATUS.md").read_text(encoding="utf-8")

def main():
    # 解析参数：支持 --key=value 和 --key value 两种格式
    raw = sys.argv[1:]
    args = []  # 位置参数（非 -- 开头）
    flags = {}  # 命名参数
    i = 0
    while i < len(raw):
        a = raw[i]
        if a.startswith("--"):
            if "=" in a:
                k, v = a.split("=", 1)
                flags[k.lstrip("--")] = v
            else:
                k = a.lstrip("--")
                # 看下一个参数是否是值（非 -- 开头）
                if i + 1 < len(raw) and not raw[i + 1].startswith("--"):
                    flags[k] = raw[i + 1]
                    i += 1
                else:
                    flags[k] = ""
        else:
            args.append(a)
        i += 1

    project = flags.get("project")
    if not project:
        project = Path.cwd().name

    if not args:
        print(__doc__)
        sys.exit(1)

    action = args[0]

    if action == "create" and len(args) >= 2:
        ws_id = args[1]
        task = flags.get("task", "") or (args[2] if len(args) > 2 else "")
        constraints = flags.get("constraints", "")
        create_workspace(project, ws_id, task, constraints)

    elif action == "list":
        workspaces = list_workspaces(project)
        if not workspaces:
            print(f"（项目 {project} 无工作间）")
        for ws in workspaces:
            print(f"  {ws['id']} | {ws['branch']} | {ws['status']}")

    elif action == "status" and len(args) >= 2:
        content = get_workspace_status(project, args[1])
        if content:
            print(content)

    else:
        print(__doc__)
        sys.exit(1)

if __name__ == "__main__":
    main()