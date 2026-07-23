"""
标日知识库数据校验工具
用法：python validate_kb.py
检查 knowledge_base/ 下所有 JSON 文件的格式是否正确。
"""

import json
import os
import sys

# Windows 控制台 UTF-8 支持
if sys.platform == "win32":
    sys.stdout.reconfigure(encoding="utf-8")

VALID_POS = {"名詞", "動詞", "形容詞", "形容動詞", "副詞", "接続詞", "助詞",
             "助動詞", "連体詞", "感動詞", "接頭辞", "接尾辞", "連語"}

errors = []


def check_lesson(lesson, volume_name):
    """校验单课数据格式。"""
    prefix = f"{volume_name} 第{lesson.get('lesson', '?')}课"

    for key in ["lesson", "title", "vocabulary", "grammar"]:
        if key not in lesson:
            errors.append(f"{prefix}: 缺少字段 '{key}'")

    if not isinstance(lesson.get("vocabulary"), list):
        errors.append(f"{prefix}: vocabulary 必须是数组")
    if not isinstance(lesson.get("grammar"), list):
        errors.append(f"{prefix}: grammar 必须是数组")

    for i, v in enumerate(lesson.get("vocabulary", [])):
        for key in ["word", "reading", "meaning", "pos"]:
            if key not in v:
                errors.append(f"{prefix}: 第{i+1}个单词缺少字段 '{key}'")
        pos = v.get("pos", "")
        if pos and pos not in VALID_POS:
            errors.append(f"{prefix}: 第{i+1}个单词词性 '{pos}' 不在标准词性列表中")

    for i, g in enumerate(lesson.get("grammar", [])):
        for key in ["point", "explanation"]:
            if key not in g:
                errors.append(f"{prefix}: 第{i+1}个语法点缺少字段 '{key}'")


def main():
    kb_dir = "knowledge_base"
    if not os.path.isdir(kb_dir):
        print(f"[错误] 找不到 {kb_dir}/ 目录")
        sys.exit(1)

    index_path = os.path.join(kb_dir, "index.json")
    if not os.path.exists(index_path):
        print(f"[错误] 找不到 {index_path}")
        sys.exit(1)

    with open(index_path, "r", encoding="utf-8") as f:
        index = json.load(f)

    total_lessons = 0
    total_words = 0
    total_grammar = 0

    for textbook in index.get("textbooks", []):
        for vol in textbook.get("volumes", []):
            file_path = os.path.join(kb_dir, vol.get("file", ""))
            if not os.path.exists(file_path):
                errors.append(f"文件不存在: {file_path}")
                continue

            try:
                with open(file_path, "r", encoding="utf-8") as f:
                    data = json.load(f)
            except json.JSONDecodeError as e:
                errors.append(f"{file_path}: JSON 格式错误 - {e}")
                continue

            lessons = data.get("lessons", [])
            if not lessons:
                print(f"  [!] {file_path}: 还没有课程数据（待填写）")
                continue

            for lesson in lessons:
                check_lesson(lesson, vol.get("name", "未知"))

            total_lessons += len(lessons)
            total_words += sum(len(l.get("vocabulary", [])) for l in lessons)
            total_grammar += sum(len(l.get("grammar", [])) for l in lessons)

    if errors:
        print(f"\n发现 {len(errors)} 个问题:\n")
        for e in errors:
            print(f"  [X] {e}")
        print()
        sys.exit(1)
    else:
        print(f"\n[OK] 全部通过!")
        print(f"   教材: {len(index.get('textbooks', []))} 套")
        print(f"   课程: {total_lessons} 课")
        print(f"   单词: {total_words} 个")
        print(f"   语法: {total_grammar} 个")
        print()


if __name__ == "__main__":
    main()
