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
        return [], []

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

        try:
            from datetime import datetime
            datetime.strptime(date_str, "%Y-%m-%d")
        except ValueError:
            errors.append(f"  日期无效: {f.name}")

        if category not in VALID_CATEGORIES:
            warnings.append(f"  未知分类 '{category}': {f.name} (合法: {', '.join(sorted(VALID_CATEGORIES))})")

        content = f.read_text(encoding="utf-8").strip()
        if not content:
            warnings.append(f"  空文件: {f.name}")

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