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
    script = Path(__file__).parent / "update-status.py"
    subprocess.run([sys.executable, str(script), "init", f"--project={project_name}"], check=True)

def create_dirs(project_name: str):
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

    project_path = action_or_path
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