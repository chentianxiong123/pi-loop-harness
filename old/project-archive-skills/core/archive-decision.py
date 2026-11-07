#!/usr/bin/env python3
"""
Decisions JSON 管理工具。
存储: ~/.project-archive/projects/<项目名>/decisions.json

用法:
  archive-decision.py append <id> --not "..." --but "..." --type TYPE [--supersedes N] [--supplements N] [--source "path"]
  archive-decision.py show [id]
  archive-decision.py status [--project NAME]
  archive-decision.py list
"""

import json, os, sys
from pathlib import Path
from datetime import date

ARCHIVE_ROOT = Path.home() / ".project-archive"

def detect_project() -> str:
    config_file = ARCHIVE_ROOT / "projects.json"
    if config_file.exists():
        projects = json.loads(config_file.read_text())
        cwd_name = Path.cwd().name
        if cwd_name in projects:
            return cwd_name
    return Path.cwd().name

def get_decisions_path(project_name: str) -> Path:
    return ARCHIVE_ROOT / "projects" / project_name / "decisions.json"

def load_decisions(project_name: str) -> dict:
    path = get_decisions_path(project_name)
    if not path.exists():
        path.parent.mkdir(parents=True, exist_ok=True)
        empty = {"decisions": []}
        path.write_text(json.dumps(empty, indent=2, ensure_ascii=False), encoding="utf-8")
        return empty
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except json.JSONDecodeError as e:
        print(f"❌ decisions.json 解析失败（格式错误），请手动修复: {e}")
        sys.exit(1)

def save_decisions(project_name: str, data: dict):
    path = get_decisions_path(project_name)
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(data, indent=2, ensure_ascii=False), encoding="utf-8")

def find_decision(data: dict, decision_id: str) -> dict | None:
    for d in data["decisions"]:
        if d["id"] == decision_id:
            return d
    return None

def resolve_active(data: dict, decision_id: str) -> list[dict]:
    dec = find_decision(data, decision_id)
    if not dec:
        return []
    entries = dec["entries"]
    superseded_seqs = set()
    for e in entries:
        if e.get("type") == "supersede" and "supersedes" in e:
            superseded_seqs.add(e["supersedes"])
    active = [e for e in entries if e["seq"] not in superseded_seqs]
    return sorted(active, key=lambda x: x["seq"])

VALID_TYPES = {"initial", "supersede", "supplement"}

def cmd_append(args):
    project = _get_project(args)
    dec_id = args[2]
    data = load_decisions(project)
    dec = find_decision(data, dec_id)

    kwargs = {}
    i = 3
    while i < len(args):
        if args[i] == "--not" and i+1 < len(args):
            kwargs["not"] = args[i+1]; i += 2
        elif args[i] == "--but" and i+1 < len(args):
            kwargs["but"] = args[i+1]; i += 2
        elif args[i] == "--type" and i+1 < len(args):
            kwargs["type"] = args[i+1]; i += 2
        elif args[i] == "--supersedes" and i+1 < len(args):
            kwargs["supersedes"] = int(args[i+1]); i += 2
        elif args[i] == "--supplements" and i+1 < len(args):
            kwargs["supplements"] = int(args[i+1]); i += 2
        elif args[i] == "--source" and i+1 < len(args):
            kwargs["source"] = args[i+1]; i += 2
        else:
            i += 1

    etype = kwargs.get("type", "initial")
    if etype not in VALID_TYPES:
        print(f"❌ 无效类型 '{etype}', 合法值: {', '.join(sorted(VALID_TYPES))}")
        sys.exit(1)

    entry = {
        "seq": (dec["entries"][-1]["seq"] + 1) if dec else 1,
        "date": str(date.today()),
        "type": etype,
        "not": kwargs.get("not", ""),
        "but": kwargs.get("but", ""),
        "source": kwargs.get("source", "")
    }
    if "supersedes" in kwargs:
        entry["supersedes"] = kwargs["supersedes"]
    if "supplements" in kwargs:
        entry["supplements"] = kwargs["supplements"]

    if not dec:
        data["decisions"].append({
            "id": dec_id,
            "title": dec_id.replace("-", " ").title(),
            "tags": [],
            "entries": [entry]
        })
        print(f"✅ 新建决策 [{dec_id}] + 追加第 {entry['seq']} 条")
    else:
        dec["entries"].append(entry)
        print(f"✅ [{dec_id}] 追加第 {entry['seq']} 条 ({entry['type']})")

    save_decisions(project, data)

def cmd_show(args):
    project = _get_project(args)
    data = load_decisions(project)
    dec_id = args[2] if len(args) > 2 and not args[2].startswith("--") else None
    decisions = data["decisions"]
    if dec_id:
        decisions = [d for d in decisions if d["id"] == dec_id]
        if not decisions:
            print(f"未找到决策: {dec_id}")
            return

    for dec in decisions:
        active_seqs = {e["seq"] for e in resolve_active(data, dec["id"])}

        print(f"\n📋 {dec['title']} ({dec['id']})")
        if dec.get("tags"):
            print(f"   标签: {', '.join(dec['tags'])}")
        print(f"   {len(dec['entries'])} 次变更\n")

        for e in dec["entries"]:
            active = e["seq"] in active_seqs
            status = "★ 当前生效" if active else "← 已推翻"
            rel = ""
            if e.get("supersedes"):
                rel = f" (推翻 #{e['supersedes']})"
            elif e.get("supplements"):
                status = "★ 当前生效"
                rel = f" (补充 #{e['supplements']})"

            print(f"  {'◆' if active else '◇'} #{e['seq']} {e['date']} [{e['type']}]{rel} {status}")
            if e.get("not"):
                print(f"     不是 {e['not']}")
            if e.get("but"):
                print(f"     而是 {e['but']}")
            if e.get("source"):
                print(f"     来源: {e['source']}")
            print()

def cmd_status(args):
    project = _get_project(args)
    data = load_decisions(project)
    lines = []
    for dec in data["decisions"]:
        active = resolve_active(data, dec["id"])
        status_parts = []
        for e in active:
            short = e["but"][:30] + "..." if len(e["but"]) > 30 else e["but"]
            status_parts.append(short)
        has_history = any(e.get("type") == "supersede" for e in dec["entries"])
        prefix = "❌→✅" if has_history else "✅"
        if status_parts:
            lines.append(f"- {dec['title']}: {prefix} {' + '.join(status_parts)} {'(当前)' if has_history else ''}")
        else:
            lines.append(f"- {dec['title']}: ❌（全部已推翻）")
    if lines:
        print("\n".join(lines))
    else:
        print("（无决策记录）")

def cmd_list(args):
    project = _get_project(args)
    data = load_decisions(project)
    if not data["decisions"]:
        print("（无决策记录）")
        return
    for dec in data["decisions"]:
        print(f"  {dec['id']}  —  {dec['title']}  ({len(dec['entries'])} 条)")

def _get_project(args):
    for i, a in enumerate(args):
        if a.startswith("--project="):
            return a.split("=", 1)[1]
        if a == "--project" and i + 1 < len(args):
            return args[i + 1]
    return detect_project()

def main():
    if len(sys.argv) < 2:
        print(__doc__)
        print("\n命令:")
        print("  append <id> --not '...' --but '...' --type TYPE [--supersedes N] [--supplements N] [--source 'path']")
        print("  show [id]")
        print("  status [--project NAME]")
        print("  list")
        sys.exit(1)

    cmd = sys.argv[1]
    if cmd == "append" and len(sys.argv) >= 3:
        cmd_append(sys.argv)
    elif cmd == "show":
        cmd_show(sys.argv)
    elif cmd == "status":
        cmd_status(sys.argv)
    elif cmd == "list":
        cmd_list(sys.argv)
    else:
        print(f"未知命令: {cmd}")
        sys.exit(1)

if __name__ == "__main__":
    main()