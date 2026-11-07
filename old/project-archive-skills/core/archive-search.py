#!/usr/bin/env python3
"""
全局归档搜索工具
存储位置: ~/.project-archive/projects/<项目名>/archive/

用法:
  archive-search.py [关键词] [--project NAME]
  archive-search.py --global [关键词]        # 搜索所有项目
  archive-search.py --category feat [--project NAME]
  archive-search.py --index [decisions|tech|timeline|all] [--global]
  archive-search.py --summary [--project NAME]
"""

import json
import sys
from datetime import datetime
from pathlib import Path

ARCHIVE_ROOT = Path.home() / ".project-archive"


def get_all_projects() -> list:
    """获取所有已注册项目"""
    config_file = ARCHIVE_ROOT / "projects.json"
    if not config_file.exists():
        return []
    return json.loads(config_file.read_text())


def search_archive(project_name: str = None, keyword: str = None,
                   category: str = None, from_date: str = None,
                   to_date: str = None, global_search: bool = False):
    """搜索归档文件"""
    results = []
    
    if global_search or project_name is None:
        projects = get_all_projects()
        if not projects:
            print("没有注册任何项目，请先运行 sync-archive.py --register")
            return
    else:
        projects = [project_name]
    
    for proj in projects:
        archive_dir = ARCHIVE_ROOT / "projects" / proj / "archive"
        if not archive_dir.exists():
            continue
        
        for md_file in archive_dir.rglob("*.md"):
            if category and f"--{category}--" not in md_file.name:
                continue
            
            if from_date or to_date:
                date_str = md_file.name[:10]
                if from_date and date_str < from_date:
                    continue
                if to_date and date_str > to_date:
                    continue
            
            if keyword:
                content = md_file.read_text(encoding="utf-8")
                if keyword.lower() in content.lower():
                    results.append((proj, md_file))
            else:
                results.append((proj, md_file))
    
    results.sort(key=lambda x: x[1].name, reverse=True)
    
    if not results:
        print("未找到匹配的归档")
        return
    
    for proj, file in results:
        print(f"[{proj}] {file.name}")


def search_with_content(project_name: str = None, keyword: str = None,
                        category: str = None, global_search: bool = False):
    """搜索并返回完整内容摘要"""
    if global_search or project_name is None:
        projects = get_all_projects()
        if not projects:
            print("没有注册任何项目")
            return
    else:
        projects = [project_name]
    
    results = []
    for proj in projects:
        archive_dir = ARCHIVE_ROOT / "projects" / proj / "archive"
        if not archive_dir.exists():
            continue
        
        for md_file in archive_dir.rglob("*.md"):
            if category and f"--{category}--" not in md_file.name:
                continue
            
            if keyword:
                content = md_file.read_text(encoding="utf-8")
                if keyword.lower() in content.lower():
                    results.append((proj, md_file, content))
            else:
                content = md_file.read_text(encoding="utf-8")
                results.append((proj, md_file, content))
    
    results.sort(key=lambda x: x[1].name, reverse=True)
    
    print(f"\n找到 {len(results)} 个相关归档:\n")
    
    for i, (proj, file, content) in enumerate(results, 1):
        print(f"{i}. [{proj}] {file.name}")
        
        # 提取成果
        if "## 成果" in content:
            section = content.split("## 成果")[1].split("##")[0]
            for line in section.strip().split("\n"):
                if line.strip().startswith("- "):
                    print(f"   成果: {line.strip()[2:].strip()}")
                    break
        
        # 提取技术栈
        if "## 用了什么" in content:
            section = content.split("## 用了什么")[1].split("##")[0]
            techs = []
            for line in section.strip().split("\n"):
                if line.strip().startswith("- "):
                    techs.append(line.strip()[2:].strip())
            if techs:
                print(f"   技术栈: {', '.join(techs[:3])}")
        
        # 提取决策
        if "## 为什么这样" in content:
            section = content.split("## 为什么这样")[1].split("##")[0]
            for line in section.strip().split("\n"):
                if line.strip().startswith("- "):
                    print(f"   决策: {line.strip()[2:].strip()}")
                    break
        
        print()


def generate_index(index_type: str = "all", global_search: bool = False):
    """生成索引"""
    if global_search:
        projects = get_all_projects()
    else:
        projects = [Path.cwd().name]
    
    decisions, tech_stack, timeline = [], [], []
    
    for proj in projects:
        archive_dir = ARCHIVE_ROOT / "projects" / proj / "archive"
        if not archive_dir.exists():
            continue
        
        for md_file in archive_dir.rglob("*.md"):
            content = md_file.read_text(encoding="utf-8")
            name = md_file.name
            date_str = name[:10]
            category = name.split("--")[1] if "--" in name else "?"
            
            if "## 为什么这样" in content:
                section = content.split("## 为什么这样")[1].split("##")[0]
                for line in section.strip().split("\n"):
                    if line.strip().startswith("- "):
                        decisions.append(f"- [{proj}] {name}: {line.strip()}")
            
            if "## 用了什么" in content:
                section = content.split("## 用了什么")[1].split("##")[0]
                for line in section.strip().split("\n"):
                    if line.strip().startswith("- "):
                        tech_stack.append(f"- [{proj}] {name}: {line.strip()}")
            
            timeline.append(f"- {date_str} [{proj}] [{category}] {name}")
    
    if index_type in ("all", "decisions"):
        print("# 决策索引\n")
        for d in decisions:
            print(d)
        print()
    
    if index_type in ("all", "tech"):
        print("# 技术栈索引\n")
        for t in tech_stack:
            print(t)
        print()
    
    if index_type in ("all", "timeline"):
        print("# 时间线\n")
        for t in timeline:
            print(t)
        print()


def weekly_summary(project_name: str = None):
    """生成本周摘要"""
    from datetime import datetime, timedelta
    
    today = datetime.now()
    week_start = today - timedelta(days=today.weekday())
    
    if project_name:
        projects = [project_name]
    else:
        projects = get_all_projects()
    
    all_categories = {}
    
    for proj in projects:
        archive_dir = ARCHIVE_ROOT / "projects" / proj / "archive"
        if not archive_dir.exists():
            continue
        
        count = 0
        for md_file in archive_dir.rglob("*.md"):
            date_str = md_file.name[:10]
            file_date = datetime.strptime(date_str, "%Y-%m-%d")
            if file_date >= week_start:
                count += 1
                category = md_file.name.split("--")[1] if "--" in md_file.name else "?"
                all_categories[category] = all_categories.get(category, 0) + 1
        
        if count > 0:
            print(f"[{proj}] 本周 {count} 个归档")
    
    if all_categories:
        print(f"\n分类统计: {json.dumps(all_categories)}")


def main():
    if len(sys.argv) < 2:
        print(__doc__)
        print("\n示例:")
        print("  archive-search.py 'SSE'                        # 当前项目搜索")
        print("  archive-search.py --global 'chat'              # 全局搜索")
        print("  archive-search.py --category feat              # 按分类")
        print("  archive-search.py --index decisions --global   # 生成全局决策索引")
        print("  archive-search.py --summary                    # 本周摘要")
        sys.exit(1)
    
    # 解析参数
    global_search = False
    category = None
    project_name = None
    keyword = None
    
    i = 1
    while i < len(sys.argv):
        arg = sys.argv[i]
        if arg == "--global":
            global_search = True
        elif arg == "--category" and i + 1 < len(sys.argv):
            category = sys.argv[i + 1]
            i += 1
        elif arg.startswith("--project="):
            project_name = arg.split("=", 1)[1]
        elif arg == "--index":
            index_type = sys.argv[i + 1] if i + 1 < len(sys.argv) and not sys.argv[i + 1].startswith("--") else "all"
            generate_index(index_type, global_search)
            return
        elif arg == "--summary":
            weekly_summary(project_name)
            return
        elif arg == "--content":
            keyword = sys.argv[i + 1] if i + 1 < len(sys.argv) else None
            search_with_content(project_name or (None if global_search else Path.cwd().name),
                              keyword, category, global_search)
            return
        else:
            keyword = arg
        i += 1
    
    search_archive(project_name or (None if global_search else Path.cwd().name),
                   keyword, category, global_search=global_search)


if __name__ == "__main__":
    main()