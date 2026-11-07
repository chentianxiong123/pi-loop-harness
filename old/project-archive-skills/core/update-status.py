#!/usr/bin/env python3
"""
STATUS.md 共享状态管理工具（全局存储 v2）
存储位置: ~/.project-archive/projects/<项目名>/STATUS.md

用法:
  update-status.py status [--project NAME]
  update-status.py set-context "当前上下文内容" [--project NAME]
  update-status.py add-todo "内容" [--project NAME]
  update-status.py mark-doing "内容" [--project NAME]
  update-status.py mark-done "内容" [--project NAME]
  update-status.py add-archive "YYYY-MM-DD--feat--xxx.md" [--project NAME]
  update-status.py add-decision "思考链：独立 think 表 ✅" [--project NAME]
  update-status.py init [--project NAME]
"""

import json, os, sys, time
from pathlib import Path

ARCHIVE_ROOT = Path.home() / ".project-archive"

def detect_project() -> str:
    config_file = ARCHIVE_ROOT / "projects.json"
    if config_file.exists():
        projects = json.loads(config_file.read_text())
        cwd_name = Path.cwd().name
        if cwd_name in projects:
            return cwd_name
    return Path.cwd().name

def get_lock_file(project_name: str) -> Path:
    project_dir = ARCHIVE_ROOT / "projects" / project_name
    project_dir.mkdir(parents=True, exist_ok=True)
    return project_dir / ".status.lock"

def get_status_file(project_name: str) -> Path:
    return ARCHIVE_ROOT / "projects" / project_name / "STATUS.md"

def acquire_lock(project_name: str, timeout: int = 15) -> bool:
    lock_path = get_lock_file(project_name)
    for i in range(int(timeout / 0.3)):
        try:
            fd = os.open(lock_path, os.O_CREAT | os.O_EXCL | os.O_WRONLY)
            os.write(fd, str(os.getpid()).encode())
            os.close(fd)
            return True
        except FileExistsError:
            try:
                with open(lock_path) as f:
                    old_pid = int(f.read().strip())
                try:
                    os.kill(old_pid, 0)
                except (OSError, ProcessLookupError):
                    os.remove(lock_path)
                    continue
            except (ValueError, FileNotFoundError):
                pass
            time.sleep(0.3)
    return False

def release_lock(project_name: str):
    try:
        os.remove(get_lock_file(project_name))
    except FileNotFoundError:
        pass

def read_status(project_name: str) -> str:
    path = get_status_file(project_name)
    if not path.exists():
        path.parent.mkdir(parents=True, exist_ok=True)
        template = f"""# {project_name}
> 更新: {time.strftime("%Y-%m-%d %H:%M")}

## 当前上下文
<<<
（待定）
>>>

## 关键决策（活跃）
- （从 decisions.json 自动生成）

## 进行中
*（无）*

## 待办
*（无）*

## 已完成（近期）
*（无）*

## 归档
*（无）*
"""
        path.write_text(template, encoding="utf-8")
    return path.read_text(encoding="utf-8")

def write_status(project_name: str, content: str):
    path = get_status_file(project_name)
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(content, encoding="utf-8")
    verify = path.read_text(encoding="utf-8")
    if verify != content:
        raise IOError("STATUS.md 写入验证失败")

def insert_after_heading(status: str, heading: str, line: str) -> str:
    idx = status.find(heading)
    if idx == -1:
        return status.rstrip() + f"\n{line}\n"
    rest = status[idx + len(heading):]
    next_line = rest.split("\n", 1)[0] if "\n" in rest else ""
    if line in status:
        return status
    insert_pos = idx + len(heading) + len(next_line) + 1
    return status[:insert_pos] + line + "\n" + status[insert_pos:]

def cap_completed_section(status: str, max_items: int = 10) -> str:
    if "## 已完成（近期）" not in status:
        return status

    before, after = status.split("## 已完成（近期）", 1)
    rest_lines = after.split("\n")
    section_lines = []
    remaining_lines = []
    in_section = True
    for line in rest_lines:
        if in_section and line.startswith("## "):
            in_section = False
        if in_section:
            section_lines.append(line)
        else:
            remaining_lines.append(line)

    items = [l for l in section_lines if l.strip().startswith("-")]
    non_items = [l for l in section_lines if not l.strip().startswith("-")]

    if len(items) > max_items:
        items = items[-max_items:]
        note_line = ""
        for l in non_items:
            if "查看全部" in l:
                note_line = l
                break
        if not note_line:
            note_line = "> 查看全部: archive-search.py --category feat --project=<项目名>"
        items.append(note_line)

    new_section = "\n".join(non_items + items)
    return before + "## 已完成（近期）" + new_section + "".join(remaining_lines)

def refresh_decisions_section(project_name: str, status: str) -> str:
    decisions_path = ARCHIVE_ROOT / "projects" / project_name / "decisions.json"
    if not decisions_path.exists():
        return status

    try:
        data = json.loads(decisions_path.read_text(encoding="utf-8"))
    except json.JSONDecodeError:
        return status

    if not data.get("decisions"):
        return status

    lines = []
    for dec in data["decisions"]:
        superseded_seqs = set()
        for e in dec["entries"]:
            if e.get("type") == "supersede" and "supersedes" in e:
                superseded_seqs.add(e["supersedes"])

        active = [e for e in dec["entries"] if e["seq"] not in superseded_seqs]
        for e in active:
            short = e["but"][:40] + "..." if len(e["but"]) > 40 else e["but"]
            lines.append(f"- {dec['title']}: {short} ✅")

    if not lines:
        return status

    decision_block = "\n".join(lines)

    if "## 关键决策（活跃）" not in status:
        return status

    before, rest = status.split("## 关键决策（活跃）", 1)
    next_heading_pos = -1
    for line_no, line in enumerate(rest.split("\n")):
        if line.startswith("## "):
            next_heading_pos = line_no
            break

    if next_heading_pos == -1:
        after = ""
    else:
        after_lines = rest.split("\n")[next_heading_pos:]
        after = "\n".join(after_lines)

    new_section = f"## 关键决策（活跃）\n{decision_block}\n"
    return before + new_section + after

def main():
    args = [a for a in sys.argv[1:] if not a.startswith("--")]
    flags = [a for a in sys.argv[1:] if a.startswith("--")]

    if not args:
        print(__doc__)
        print("\n可用操作:")
        print("  status, set-context, add-todo, mark-doing, mark-done")
        print("  add-archive, add-decision, init, refresh-decisions")
        sys.exit(1)

    action = args[0]

    project_name = None
    for f in flags:
        if f.startswith("--project="):
            project_name = f.split("=", 1)[1]
    if not project_name:
        project_name = detect_project()

    if action == "init":
        read_status(project_name)
        print(f"✅ 已初始化项目: {project_name}")
        print(f"   STATUS.md: {get_status_file(project_name)}")
        return

    needs_content = action not in ("status", "refresh-decisions")
    if needs_content and len(args) < 2:
        print(f"{action} 需要提供内容参数")
        sys.exit(1)

    content = " ".join(args[1:]) if len(args) > 1 else None

    if not acquire_lock(project_name):
        print("❌ 无法获取 STATUS.md 锁（排队超时），请稍后重试")
        sys.exit(1)

    try:
        status = read_status(project_name)

        if action == "status":
            print(status)

        elif action == "set-context":
            status = insert_after_heading(status, "## 当前上下文", f"<<<\n{content}\n>>>")
            write_status(project_name, status)

        elif action in ("add-todo", "add-feature"):
            status = insert_after_heading(status, "## 待办", f"- [ ] {content}")
            write_status(project_name, status)

        elif action == "add-explore":
            status = insert_after_heading(status, "## 待办", f"- [ ] {content} (技术探索)")
            write_status(project_name, status)

        elif action == "mark-doing":
            if f"- [ ] {content}" in status:
                status = status.replace(f"- [ ] {content}", "")
            elif f"- [ ] {content} (技术探索)" in status:
                status = status.replace(f"- [ ] {content} (技术探索)", "")
            status = insert_after_heading(status, "## 进行中", f"- [ ] {content}")
            write_status(project_name, status)

        elif action == "mark-done":
            for prefix in ["- [ ] ", "- [ ] "]:
                if f"{prefix}{content}" in status:
                    if "(技术探索)" in content:
                        status = status.replace(f"{prefix}{content}", "")
                    else:
                        status = status.replace(f"{prefix}{content}", "")
            status = insert_after_heading(status, "## 已完成（近期）", f"- ✅ {content}")
            status = cap_completed_section(status, 10)
            write_status(project_name, status)

        elif action == "add-archive":
            line = f"- archive/{content}"
            status = insert_after_heading(status, "## 归档", line)
            write_status(project_name, status)

        elif action == "add-issue":
            status = insert_after_heading(status, "## 待办", f"- [ ] 🔴 {content}")
            write_status(project_name, status)

        elif action == "add-decision":
            status = insert_after_heading(status, "## 关键决策（活跃）", f"- {content}")
            write_status(project_name, status)

        elif action == "refresh-decisions":
            status = refresh_decisions_section(project_name, status)
            write_status(project_name, status)

        else:
            print(f"未知操作: {action}")
            sys.exit(1)

        print(f"✅ 已执行: {action} {content or ''}")

    finally:
        release_lock(project_name)

if __name__ == "__main__":
    main()