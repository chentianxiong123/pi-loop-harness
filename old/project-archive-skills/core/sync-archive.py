#!/usr/bin/env python3
"""
全局归档同步工具
用法:
  sync-archive.py --push           # 本地 → 全局
  sync-archive.py --pull           # 全局 → 本地（备份用）
  sync-archive.py --status         # 查看同步状态
"""

import os
import sys
import shutil
from pathlib import Path

ARCHIVE_ROOT = Path.home() / ".project-archive"
PROJECTS_FILE = ARCHIVE_ROOT / "projects.json"


def sync_push(project_dir: str):
    """本地归档 → 全局存储"""
    project_dir = Path(project_dir).resolve()
    local_archive = project_dir / "docs" / "archive"
    global_archive = ARCHIVE_ROOT / project_dir.name / "archive"
    
    if not local_archive.exists():
        print(f"本地归档不存在: {local_archive}")
        return False
    
    # 创建全局目录
    global_archive.mkdir(parents=True, exist_ok=True)
    
    # 同步文件
    for md_file in local_archive.rglob("*.md"):
        rel_path = md_file.relative_to(local_archive)
        target = global_archive / rel_path
        target.parent.mkdir(parents=True, exist_ok=True)
        
        if not target.exists() or md_file.stat().st_mtime > target.stat().st_mtime:
            shutil.copy2(md_file, target)
    
    print(f"✅ 已同步 {project_dir.name} → {global_archive}")
    return True


def sync_pull(project_name: str):
    """全局 → 本地（恢复备份）"""
    global_archive = ARCHIVE_ROOT / project_name / "archive"
    local_archive = Path.cwd() / "docs" / "archive"
    
    if not global_archive.exists():
        print(f"全局归档不存在: {global_archive}")
        return False
    
    local_archive.mkdir(parents=True, exist_ok=True)
    
    for md_file in global_archive.rglob("*.md"):
        rel_path = md_file.relative_to(global_archive)
        target = local_archive / rel_path
        target.parent.mkdir(parents=True, exist_ok=True)
        
        if not target.exists() or md_file.stat().st_mtime > target.stat().st_mtime:
            shutil.copy2(md_file, target)
    
    print(f"✅ 已恢复 {project_name} ← {global_archive}")
    return True


def register_project(project_dir: str):
    """注册项目"""
    project_dir = Path(project_dir).resolve()
    if not project_dir.exists():
        print(f"项目不存在: {project_dir}")
        return False
    
    # 创建全局目录
    global_dir = ARCHIVE_ROOT / project_dir.name
    global_dir.mkdir(parents=True, exist_ok=True)
    
    # 更新注册列表
    import json
    projects = []
    if PROJECTS_FILE.exists():
        projects = json.loads(PROJECTS_FILE.read_text())
    
    if project_dir.name not in projects:
        projects.append(project_dir.name)
        PROJECTS_FILE.write_text(json.dumps(projects, indent=2))
    
    print(f"✅ 已注册项目: {project_dir.name}")
    return True


def list_projects():
    """列出所有项目"""
    if not PROJECTS_FILE.exists():
        print("没有注册任何项目")
        return
    
    import json
    projects = json.loads(PROJECTS_FILE.read_text())
    print(f"已注册 {len(projects)} 个项目:")
    for p in projects:
        global_archive = ARCHIVE_ROOT / p / "archive"
        count = len(list(global_archive.rglob("*.md"))) if global_archive.exists() else 0
        print(f"  {p} ({count} 个归档)")


def main():
    if len(sys.argv) < 2:
        print(__doc__)
        print("用法:")
        print("  sync-archive.py --push [project_dir]   # 本地 → 全局")
        print("  sync-archive.py --pull [project_name]  # 全局 → 本地")
        print("  sync-archive.py --register [project_dir]  # 注册项目")
        print("  sync-archive.py --list                 # 列出所有项目")
        sys.exit(1)
    
    action = sys.argv[1]
    
    if action == "--push":
        project_dir = sys.argv[2] if len(sys.argv) > 2 else "."
        sync_push(project_dir)
    elif action == "--pull":
        if len(sys.argv) < 3:
            print("需要指定项目名")
            sys.exit(1)
        sync_pull(sys.argv[2])
    elif action == "--register":
        if len(sys.argv) < 3:
            print("需要指定项目路径")
            sys.exit(1)
        register_project(sys.argv[2])
    elif action == "--list":
        list_projects()
    elif action == "--status":
        list_projects()
    else:
        print(f"未知操作: {action}")
        sys.exit(1)


if __name__ == "__main__":
    main()