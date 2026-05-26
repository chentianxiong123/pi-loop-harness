# Project Archive v2 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement v2 of project-archive: flat archive structure, decisions.json management, STATUS.md redesign, init/validator tools

**Architecture:** All tools live in `core/`, all data in `~/.project-archive/projects/<name>/`. No external dependencies beyond Python stdlib. Decisions stored as JSON single-file tree, archives as flat markdown files.

**Tech Stack:** Python 3 (stdlib only: json, os, sys, pathlib, shutil, time, datetime, re)

---

### Task 1: archive-decision.py — Decisions JSON Manager

**Files:**
- Create: `core/archive-decision.py`
- Modify: none

**Overview:** CLI tool to manage decisions.json. Supports append, show, status operations. JSON format with tree relationships (initial/supersede/supplement).

- [ ] **Step 1: Write the tool**

```python
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

import json, os, sys, time
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
    # Create empty structure if not exists
    if not path.exists():
        path.parent.mkdir(parents=True, exist_ok=True)
        empty = {"decisions": []}
        path.write_text(json.dumps(empty, indent=2, ensure_ascii=False), encoding="utf-8")
        return empty
    return json.loads(path.read_text(encoding="utf-8"))

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
    """Return the currently active entries (not superseded) for a decision."""
    dec = find_decision(data, decision_id)
    if not dec:
        return []
    entries = dec["entries"]
    # Find all entries that are not themselves superseded
    superseded_seqs = set()
    for e in entries:
        if e.get("type") == "supersede" and "supersedes" in e:
            superseded_seqs.add(e["supersedes"])
    
    active = [e for e in entries if e["seq"] not in superseded_seqs]
    return sorted(active, key=lambda x: x["seq"])

def cmd_append(args):
    project = _get_project(args)
    dec_id = args[2]  # after "append"
    
    data = load_decisions(project)
    dec = find_decision(data, dec_id)
    
    # Parse flags
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
    
    entry = {
        "seq": (dec["entries"][-1]["seq"] + 1) if dec else 1,
        "date": str(date.today()),
        "type": kwargs.get("type", "initial"),
        "not": kwargs.get("not", ""),
        "but": kwargs.get("but", ""),
        "source": kwargs.get("source", "")
    }
    if "supersedes" in kwargs:
        entry["supersedes"] = kwargs["supersedes"]
    if "supplements" in kwargs:
        entry["supplements"] = kwargs["supplements"]
    
    if not dec:
        # Create new decision
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
    
    # Parse optional id filter
    dec_id = args[2] if len(args) > 2 and not args[2].startswith("--") else None
    
    decisions = data["decisions"]
    if dec_id:
        decisions = [d for d in decisions if d["id"] == dec_id]
    
    for dec in decisions:
        print(f"\n📋 {dec['title']} ({dec['id']})")
        if dec.get("tags"):
            print(f"   标签: {', '.join(dec['tags'])}")
        print(f"   {len(dec['entries'])} 次变更\n")
        
        for e in dec["entries"]:
            active = True
            for e2 in dec["entries"]:
                if e2.get("type") == "supersede" and e2.get("supersedes") == e["seq"]:
                    active = False
                    break
            
            status = "★ 当前生效" if active else "← 已推翻"
            rel = ""
            if e.get("supersedes"):
                rel = f" (推翻 #{e['supersedes']})"
            elif e.get("supplements"):
                status = "★ 当前生效"
                rel = f" (补充 #{e['supplements']})"
            
            print(f"  {'◆' if active else '◇'} #{e['seq']} {e['date']} [{e['type']}]{rel}")
            if e.get("not"):
                print(f"     不是 {e['not']}")
            if e.get("but"):
                print(f"     而是 {e['but']}")
            if e.get("source"):
                print(f"     来源: {e['source']}")
            print()

def cmd_status(args):
    """输出供 STATUS.md 使用的摘要行"""
    project = _get_project(args)
    data = load_decisions(project)
    
    lines = []
    for dec in data["decisions"]:
        active = resolve_active(data, dec["id"])
        status_parts = []
        for e in active:
            short = e["but"][:30] + "..." if len(e["but"]) > 30 else e["but"]
            status_parts.append(short)
        
        # Check if any entry was superseded (has a history of change)
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
    """列出所有决策 ID"""
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
    return detect_project()

def main():
    if len(sys.argv) < 2:
        print(__doc__)
        print("\n命令:")
        print("  append <id> --not '...' --but '...' --type TYPE [--supersedes N] [--source 'path']")
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
```

- [ ] **Step 2: Test basic append + show**

Run:
```bash
cd C:\Users\a1\Desktop\project-archive
python core/archive-decision.py append think-chain-storage --not "存 DB" --but "不存，保持查询快" --type initial --source "archive/test.md"
python core/archive-decision.py show think-chain-storage
```
Expected: Shows decision with 1 entry, marked as active.

- [ ] **Step 3: Test supersede chain**

Run:
```bash
cd C:\Users\a1\Desktop\project-archive
python core/archive-decision.py append think-chain-storage --not "不存 DB" --but "独立 think 表" --type supersede --supersedes 1 --source "archive/test2.md"
python core/archive-decision.py show think-chain-storage
```
Expected: entry #1 marked "← 已推翻", entry #2 marked "★ 当前生效".

- [ ] **Step 4: Test supplement and status**

Run:
```bash
cd C:\Users\a1\Desktop\project-archive
python core/archive-decision.py append think-chain-storage --not "永久保留" --but "30 天 TTL" --type supplement --supplements 2 --source "archive/test3.md"
python core/archive-decision.py status
```
Expected: Shows decision with 3 entries, 2 active, status line includes both active decisions.

- [ ] **Step 5: Test list command**

Run:
```bash
cd C:\Users\a1\Desktop\project-archive
python core/archive-decision.py list
```
Expected: Lists all decisions.

- [ ] **Step 6: Clean test data**

Run:
```bash
powershell -Command "Remove-Item '$env:USERPROFILE\.project-archive\projects\project-archive\decisions.json' -Force 2>$null; Write-Host 'cleaned'"
```

- [ ] **Step 7: Commit**

```bash
cd C:\Users\a1\Desktop\project-archive
git add core/archive-decision.py
git commit -m "feat: add archive-decision.py for decisions.json management"
```

---

### Task 2: Refactor update-status.py for New STATUS.md Layout

**Files:**
- Modify: `core/update-status.py`

**Overview:** Update STATUS.md to new v2 layout: current-context block, active decisions section, completed-items with 10-item cap, archive-list.

- [ ] **Step 1: Rewrite update-status.py**

The full file content. Key changes:
- New template with `<<< >>>` context block
- `set-context` command for writing "当前上下文"
- 10-item cap on "已完成" section
- `add-archive` no longer creates nested YYYY-MM/ path
- Auto-generate "关键决策（活跃）" section from decisions.json

```python
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
    """Keep only the last N items in ## 已完成 section."""
    if "## 已完成（近期）" not in status:
        return status
    
    before, after = status.split("## 已完成（近期）", 1)
    # Find next section boundary
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
    
    # Filter checklist items, keep last N
    items = [l for l in section_lines if l.strip().startswith("-")]
    non_items = [l for l in section_lines if not l.strip().startswith("-")]
    
    if len(items) > max_items:
        items = items[-max_items:]
        # Add a note
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
    """Pull active decisions from decisions.json into STATUS.md."""
    decisions_path = ARCHIVE_ROOT / "projects" / project_name / "decisions.json"
    if not decisions_path.exists():
        return status
    
    try:
        data = json.loads(decisions_path.read_text(encoding="utf-8"))
    except json.JSONDecodeError:
        return status
    
    if not data.get("decisions"):
        return status
    
    # Generate decision lines
    lines = []
    for dec in data["decisions"]:
        # Find active entries (not superseded)
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
    
    # Replace the section between "## 关键决策（活跃）" and next heading
    if "## 关键决策（活跃）" not in status:
        return status
    
    before, rest = status.split("## 关键决策（活跃）", 1)
    # Find next heading
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
        print("  add-archive, add-decision, init")
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
            # manual decision line (not from decisions.json)
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
```

- [ ] **Step 2: Test init + context**

Run:
```bash
cd C:\Users\a1\Desktop\project-archive
python core/update-status.py init --project=test-project
python core/update-status.py set-context "正在测试新 STATUS 布局" --project=test-project
python core/update-status.py status --project=test-project
```
Expected: Shows new v2 template with context block.

- [ ] **Step 3: Test mark-done cap**

Run:
```bash
cd C:\Users\a1\Desktop\project-archive
for i in $(seq 1 12); do python core/update-status.py mark-done "测试任务 $i" --project=test-project; done
python core/update-status.py status --project=test-project
```
Expected: Shows only last 10 completed items, with note linking to archive-search.

- [ ] **Step 4: Clean test data**

Run:
```bash
powershell -Command "Remove-Item '$env:USERPROFILE\.project-archive\projects\test-project' -Recurse -Force 2>$null; Write-Host 'cleaned'"
```

- [ ] **Step 5: Commit**

```bash
cd C:\Users\a1\Desktop\project-archive
git add core/update-status.py
git commit -m "refactor: update-status.py v2 — new STATUS.md layout with cap"
```

---

### Task 3: Migrate Archive to Flat Structure

**Files:**
- Modify: `core/archive-search.py`

**Overview:** Remove YYYY-MM nesting assumption. All archives are directly under `archive/`. Update search script accordingly.

- [ ] **Step 1: Update archive-search.py**

The changes are minimal — `rglob("*.md")` already works with flat structure. But we need to:
- Remove any references to YYYY-MM/ path patterns
- Update `weekly_summary` and search logic if they assumed nested paths

Read the current file and verify all `rglob("*.md")` calls work fine with flat structure — they do in v1 already. The main change is documentation and ensuring `--summary` date parsing still works (it reads date from filename, not directory name, so it's fine).

- [ ] **Step 2: Verify search works with flat structure**

```bash
cd C:\Users\a1\Desktop\project-archive
# Test with flat archive (no YYYY-MM subdirs)
python core/archive-search.py --global "SSE"
```
Expected: Runs without errors (may find nothing if no archives exist).

- [ ] **Step 3: Update template in references/archive-template.md**

Read `references/archive-template.md` — update filename format to `YYYY-MM-DD--category--topic.md` (add day). Update template content if needed.

- [ ] **Step 4: Commit**

```bash
cd C:\Users\a1\Desktop\project-archive
git add core/archive-search.py references/archive-template.md
git commit -m "refactor: archive flat structure — remove YYYY-MM nesting"
```

---

### Task 4: init-project.py — One-Command Project Init

**Files:**
- Create: `core/init-project.py`

**Overview:** Register project + init STATUS.md + create empty archive/ and decisions/ dirs in one command.

- [ ] **Step 1: Write init-project.py**

```python
#!/usr/bin/env python3
"""
一键初始化项目归档。
用法:
  init-project.py /path/to/project [--name NAME]
  init-project.py --register /path/to/project  # 仅注册
"""

import json, os, sys, subprocess
from pathlib import Path

ARCHIVE_ROOT = Path.home() / ".project-archive"
PROJECTS_FILE = ARCHIVE_ROOT / "projects.json"

def register(project_path: str):
    p = Path(project_path).resolve()
    if not p.exists():
        print(f"❌ 项目路径不存在: {p}")
        sys.exit(1)
    
    name = p.name
    PROJECTS_FILE.parent.mkdir(parents=True, exist_ok=True)
    
    projects = []
    if PROJECTS_FILE.exists():
        projects = json.loads(PROJECTS_FILE.read_text())
    
    if name not in projects:
        projects.append(name)
        PROJECTS_FILE.write_text(json.dumps(projects, indent=2))
    
    return name

def init_status(project_name: str):
    """Call update-status.py init"""
    script = Path(__file__).parent / "update-status.py"
    subprocess.run([sys.executable, str(script), "init", f"--project={project_name}"], check=True)

def create_dirs(project_name: str):
    """Create archive/ and decisions/ dirs"""
    project_dir = ARCHIVE_ROOT / "projects" / project_name
    (project_dir / "archive").mkdir(parents=True, exist_ok=True)
    (project_dir / "decisions").mkdir(parents=True, exist_ok=True)
    print(f"   archive/     {project_dir / 'archive'}")
    print(f"   decisions/   {project_dir / 'decisions'}")

def main():
    if len(sys.argv) < 2:
        print(__doc__)
        sys.exit(1)
    
    action_or_path = sys.argv[1]
    
    if action_or_path == "--register":
        if len(sys.argv) < 3:
            print("需要指定项目路径")
            sys.exit(1)
        project_path = sys.argv[2]
        name = register(project_path)
        print(f"✅ 已注册项目: {name}")
        return
    
    # Default: register + init + create dirs
    project_path = action_or_path
    
    # Check for --name flag
    custom_name = None
    if "--name" in sys.argv:
        idx = sys.argv.index("--name")
        if idx + 1 < len(sys.argv):
            custom_name = sys.argv[idx + 1]
    
    p = Path(project_path).resolve()
    name = register(project_path)
    if custom_name:
        name = custom_name
    
    print(f"🚀 初始化项目: {name}")
    
    init_status(name)
    create_dirs(name)
    
    print(f"\n✅ 初始化完成！")
    print(f"   项目: {name}")
    print(f"   路径: {p}")
    print(f"   归档: {ARCHIVE_ROOT / 'projects' / name / 'archive/'}")
    print(f"   决策: {ARCHIVE_ROOT / 'projects' / name / 'decisions/'}")

if __name__ == "__main__":
    main()
```

- [ ] **Step 2: Test init**

Run:
```bash
cd C:\Users\a1\Desktop\project-archive
python core/init-project.py . --name test-init
```
Expected: Registers current dir, creates STATUS.md, archive/, decisions/.

- [ ] **Step 3: Verify**

Run:
```bash
ls "$env:USERPROFILE\.project-archive\projects\test-init\"
```
Expected: Shows STATUS.md, archive/, decisions/

- [ ] **Step 4: Clean test data**

```bash
powershell -Command "Remove-Item '$env:USERPROFILE\.project-archive\projects\test-init' -Recurse -Force 2>$null; & '$env:USERPROFILE\.project-archive\projects.json' -Force 2>$null; Write-Host 'cleaned'"
```
Also clean projects.json.

- [ ] **Step 5: Commit**

```bash
cd C:\Users\a1\Desktop\project-archive
git add core/init-project.py
git commit -m "feat: add init-project.py — one-command project init"
```

---

### Task 5: archive-validator.py — Archive File Validator

**Files:**
- Create: `core/archive-validator.py`

**Overview:** Validate archive filenames match `YYYY-MM-DD--category--topic.md` format, check categories are valid, report issues.

- [ ] **Step 1: Write archive-validator.py**

```python
#!/usr/bin/env python3
"""
归档文件校验工具。
校验文件名格式、分类、是否存在空文件等。

用法:
  archive-validator.py [--project NAME]
  archive-validator.py --fix        # 尝试修复常见问题（如日期格式）
  archive-validator.py --global     # 校验所有项目
"""

import re, sys
from pathlib import Path

ARCHIVE_ROOT = Path.home() / ".project-archive"
VALID_CATEGORIES = {"feat", "fix", "test", "design", "spike", "refactor", "ops", "docs", "env"}
FILENAME_PATTERN = re.compile(r"^(\d{4}-\d{2}-\d{2})--([a-z]+)--(.+)\.md$")

def get_all_projects() -> list:
    import json
    config = ARCHIVE_ROOT / "projects.json"
    if not config.exists():
        return []
    return json.loads(config.read_text())

def validate_archive(project_name: str):
    archive_dir = ARCHIVE_ROOT / "projects" / project_name / "archive"
    if not archive_dir.exists():
        print(f"[{project_name}] ❌ archive/ 目录不存在")
        return
    
    errors = []
    warnings = []
    valid_count = 0
    
    for f in sorted(archive_dir.iterdir()):
        if not f.name.endswith(".md"):
            continue
        
        m = FILENAME_PATTERN.match(f.name)
        if not m:
            errors.append(f"  文件名格式错误: {f.name}")
            continue
        
        date_str, category, topic = m.groups()
        
        # Validate date
        try:
            from datetime import datetime
            datetime.strptime(date_str, "%Y-%m-%d")
        except ValueError:
            errors.append(f"  日期无效: {f.name}")
        
        # Validate category
        if category not in VALID_CATEGORIES:
            warnings.append(f"  未知分类 '{category}': {f.name} (合法: {', '.join(sorted(VALID_CATEGORIES))})")
        
        # Check if empty
        content = f.read_text(encoding="utf-8").strip()
        if not content:
            warnings.append(f"  空文件: {f.name}")
        
        # Check for required sections
        if content:
            missing = []
            for section in ["## 探索成果"]:
                if section not in content:
                    missing.append(section)
            if missing:
                warnings.append(f"  缺少必要段落 ({', '.join(missing)}): {f.name}")
        
        valid_count += 1
    
    print(f"[{project_name}] {valid_count} 个归档, {len(errors)} 错误, {len(warnings)} 警告")
    for e in errors:
        print(e)
    for w in warnings:
        print(w)
    
    return errors, warnings

def main():
    global_search = "--global" in sys.argv
    do_fix = "--fix" in sys.argv
    
    if global_search:
        projects = get_all_projects()
    else:
        project_name = None
        for a in sys.argv:
            if a.startswith("--project="):
                project_name = a.split("=", 1)[1]
        if not project_name:
            project_name = Path.cwd().name
        projects = [project_name]
    
    total_errors = 0
    for proj in projects:
        e, w = validate_archive(proj)
        total_errors += len(e)
    
    if total_errors > 0:
        sys.exit(1)
    
    print("\n✅ 校验完成")

if __name__ == "__main__":
    main()
```

- [ ] **Step 2: Test with broken filenames**

Run:
```bash
cd C:\Users\a1\Desktop\project-archive
# Create test files
mkdir -p "$env:USERPROFILE\.project-archive\projects\test-validate\archive"
echo "test" > "$env:USERPROFILE\.project-archive\projects\test-validate\archive\wrong-name.md"
echo "content" > "$env:USERPROFILE\.project-archive\projects\test-validate\archive\2026-01-01--invalid-category--test.md"
echo "# header" > "$env:USERPROFILE\.project-archive\projects\test-validate\archive\2026-13-01--feat--bad-date.md"
echo "## 探索成果" > "$env:USERPROFILE\.project-archive\projects\test-validate\archive\2026-05-26--feat--good-file.md"
# Register
python core/sync-archive.py --register .
python core/init-project.py . --name test-validate
python core/archive-validator.py --project=test-validate
```
Expected: Reports errors for wrong-name.md (bad format), bad-date.md (invalid month), warning for invalid-category.md.

- [ ] **Step 3: Clean test data**

```bash
powershell -Command "Remove-Item '$env:USERPROFILE\.project-archive\projects\test-validate' -Recurse -Force 2>$null; Write-Host 'cleaned'"
```

- [ ] **Step 4: Commit**

```bash
cd C:\Users\a1\Desktop\project-archive
git add core/archive-validator.py
git commit -m "feat: add archive-validator.py — filename and content validation"
```

---

### Task 6: Update Skills and Adapters for v2

**Files:**
- Modify: `project-archive.md`, `project-status.md`, `project-recall.md`, `adapters/claude-code.md`, `README.md`

**Overview:** Update all skill files and docs to reflect v2 changes: flat archive, decisions.json, new STATUS.md layout.

- [ ] **Step 1: Update project-archive.md**

Replace v1 content with v2:
```markdown
# Project Archive

> 归档地图系统 — 全局存储，记录所有项目的开发历史

## 存储位置

所有归档和状态文件存储在 `~/.project-archive/`：

```
~/.project-archive/
├── projects.json                    ← 注册的项目列表
├── projects/
│   ├── <项目名>/
│   │   ├── STATUS.md               ← 项目当前状态（含提示词）
│   │   ├── archive/                ← 归档文件（平铺）
│   │   ├── decisions.json          ← 全部决策树
│   │   └── .status.lock            ← 锁文件（多 Agent）
│   └── ...
├── timeline.md                      ← 全项目合并时间线
├── decisions.md                     ← 全项目合并决策
└── tech-stack.md                    ← 全项目合并技术栈
```

## 首次使用

```bash
# 一键初始化
python core/init-project.py /path/to/project

# 或分步：
# python core/sync-archive.py --register /path/to/project
# python core/update-status.py init --project=project-name
```

## 归档文件规范

```
YYYY-MM-DD--category--topic.md

分类: feat, fix, test, design, spike, refactor, ops, docs, env
```

## 触发条件

当用户完成一个功能模块并产生总结输出时，**自动触发归档流程**。

触发信号：
- 用户说："归档"、"存档"、"记录一下"
- 用户输出包含完成总结（改动清单表格 + "完成了"/"做完了"）
- 用户输出包含"效果："段落

## 归档流程

### 1. 检测完成信号
当用户输出包含以下任一特征时：
- 改动清单表格（3+ 文件改动）
- "零新增错误"、"零错误"
- "完成"、"做完了"
- "效果："段落

### 2. 生成归档建议

```
文件名：YYYY-MM-DD--分类--主题.md
```

### 3. 确认后写入文件

文件位置：`~/.project-archive/projects/<项目名>/archive/`

```markdown
# YYYY-MM-DD · 主题

> ✅完成 | 分类 | 涉及范围

## 探索成果
- 从用户输出中提取
- 3-8 条，动词开头

## 技术栈
- 从改动文件中提取关键词
- 3-8 个关键词

## 关键决策
- 做法 + 原因
- 如果引入了新决策，执行 archive-decision.py append

## 变更
文件: +新增 · ~修改 · -删除
```

### 4. 归档后处理

**必须执行：**
```bash
# 1. 更新 STATUS.md
python core/update-status.py add-archive "YYYY-MM-DD--feat--xxx.md"
python core/update-status.py mark-done "功能名称"

# 2. 如有决策变更
python core/archive-decision.py append <decision-id> \
  --not "..." --but "..." --type supersede --supersedes N \
  --source "archive/YYYY-MM-DD--feat--xxx.md"
python core/update-status.py refresh-decisions

# 3. 同步选项
python core/sync-archive.py --push /path/to/project
```

## 检索

```bash
# 当前项目
python core/archive-search.py "chat"

# 全局搜索（所有项目）
python core/archive-search.py --global "SSE"

# 按分类
python core/archive-search.py --category feat

# 生成全局索引
python core/archive-search.py --index --global
```

## 注意事项

1. **不要**在归档里写"下一阶段"、"后续计划" — 属于 STATUS.md
2. **不要**贴详细代码 — git log 更准
3. 归档文件创建后，**必须**调用 update-status.py 更新 STATUS.md
4. 决策变更时，**必须**调用 archive-decision.py 记录再刷新 STATUS.md
```

- [ ] **Step 2: Update project-status.md**

Replace with v2:
```markdown
# Project Status

管理 `~/.project-archive/projects/<项目名>/STATUS.md` 的共享状态。

## 存储位置

```
~/.project-archive/projects/<项目名>/STATUS.md
```

## STATUS.md 结构

```
# <项目名>
> 更新: YYYY-MM-DD HH:MM

## 当前上下文           ← 给下一位 Agent 的"开机说明"
<<<
正在做什么、卡在哪里、下一步
>>>

## 关键决策（活跃）     ← 从 decisions.json 自动刷新

## 进行中               ← 谁在做什么

## 待办                 ← 未开始

## 已完成（近期）        ← 最多 10 条，自动截断

## 归档
```

## 使用方式

所有更新通过 `core/update-status.py` 脚本执行，**不要直接编辑 STATUS.md**。

```bash
# 初始化
python core/update-status.py init

# 查看
python core/update-status.py status

# 设置上下文（异步交接用）
python core/update-status.py set-context "正在做 chat 迁移，卡在游标分页"

# 添加/更新
python core/update-status.py add-todo "前端历史消息懒加载"
python core/update-status.py mark-doing "前端历史消息懒加载"
python core/update-status.py mark-done "前端历史消息懒加载"

# 决策联动
python core/update-status.py refresh-decisions

# 归档联动
python core/update-status.py add-archive "2026-05-26--feat--chat-migration.md"
```

## 锁机制

- 锁文件：`.status.lock`
- 锁类型：文件级别排他锁
- 锁超时：15 秒（僵尸锁自动回收）
- 冲突处理：排队等待

## 多项目支持

```bash
python core/update-status.py status --project=project-a
python core/update-status.py add-todo "..." --project=project-b
```

## 会话结束职责

每次会话结束前，Agent 必须：
1. 更新"当前上下文"块（给下一个 Agent 交接）
2. 如有完成项，调用 `mark-done`
3. 如有归档，调用 `add-archive`
4. 如有决策变更，调用 `archive-decision.py append` + `refresh-decisions`
```

- [ ] **Step 3: Update project-recall.md**

Replace relevant parts to reference flat structure. Main change: the search tool already works fine, just update docs to reference decisions.json searching via `archive-decision.py show`.

- [ ] **Step 4: Update adapters/claude-code.md and README.md**

To reflect v2 tooling.

- [ ] **Step 5: Commit**

```bash
cd C:\Users\a1\Desktop\project-archive
git add project-archive.md project-status.md project-recall.md adapters/claude-code.md README.md
git commit -m "docs: update skills and docs for v2 — flat archive, decisions.json, new STATUS"
```

---

## Spec Coverage Check

| Spec Section | Task | Status |
|---|---|---|
| Archive flat structure | Task 3 | Covered |
| decisions.json data model | Task 1 | Covered |
| STATUS.md current-context block | Task 2 | Covered |
| STATUS.md active decisions auto-refresh | Task 2 (refresh_decisions_section) | Covered |
| STATUS.md completed 10-item cap | Task 2 (cap_completed_section) | Covered |
| Multi-agent lock | Task 2 (already exists) | Covered |
| init-project.py | Task 4 | Covered |
| archive-validator.py | Task 5 | Covered |
| Update skills | Task 6 | Covered |