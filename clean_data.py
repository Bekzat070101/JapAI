# -*- coding: utf-8 -*-
"""
JapAI - User Data Cleaner
Clears all local user data before sharing the project.
"""

import json
import os
import shutil
import sys

# Force UTF-8 on Windows
if sys.platform == "win32":
    try:
        sys.stdout.reconfigure(encoding="utf-8")
    except Exception:
        pass


def confirm(msg):
    ans = input(f"{msg} (y/n): ").strip().lower()
    return ans == "y"


def safe_remove(path):
    if os.path.exists(path):
        os.remove(path)
        return True
    return False


def safe_rmdir(path):
    if os.path.exists(path):
        shutil.rmtree(path)
        return True
    return False


def main():
    print("=" * 50)
    print("  JapAI - User Data Cleaner")
    print("=" * 50)
    print()
    print("Will clear the following:")
    print("  - config.json          => Clear API Key only")
    print("  - progress.json        => Delete")
    print("  - learned_content.json => Reset to empty")
    print("  - vocabulary.json      => Reset to empty")
    print("  - history/             => Delete all records")
    print("  - output/              => Delete all notes")
    print()
    print("Source code files will NOT be affected.")
    print()

    if not confirm("Clear all user data?"):
        print("Cancelled.")
        return

    cleaned = 0

    # config.json - clear API Key only
    config_path = "config.json"
    if os.path.exists(config_path):
        try:
            with open(config_path, "r", encoding="utf-8") as f:
                config = json.load(f)
            config["api_key"] = ""
            with open(config_path, "w", encoding="utf-8") as f:
                json.dump(config, f, ensure_ascii=False, indent=2)
            print("  [OK] config.json - API Key cleared")
            cleaned += 1
        except Exception as e:
            print(f"  [FAIL] config.json: {e}")
    else:
        print("  [SKIP] config.json not found")

    # progress.json
    if safe_remove("progress.json"):
        print("  [OK] progress.json deleted")
        cleaned += 1
    else:
        print("  [SKIP] progress.json not found")

    # learned_content.json
    lc_path = "learned_content.json"
    if os.path.exists(lc_path):
        try:
            with open(lc_path, "w", encoding="utf-8") as f:
                json.dump({"items": []}, f, ensure_ascii=False, indent=2)
            print("  [OK] learned_content.json reset")
            cleaned += 1
        except Exception as e:
            print(f"  [FAIL] learned_content.json: {e}")
    else:
        print("  [SKIP] learned_content.json not found")

    # vocabulary.json
    vocab_path = "vocabulary.json"
    if os.path.exists(vocab_path):
        try:
            with open(vocab_path, "w", encoding="utf-8") as f:
                json.dump({"words": []}, f, ensure_ascii=False, indent=2)
            print("  [OK] vocabulary.json reset")
            cleaned += 1
        except Exception as e:
            print(f"  [FAIL] vocabulary.json: {e}")
    else:
        print("  [SKIP] vocabulary.json not found")

    # history/
    if safe_rmdir("history"):
        print("  [OK] history/ deleted")
        cleaned += 1
    else:
        print("  [SKIP] history/ not found")

    # output/
    if safe_rmdir("output"):
        print("  [OK] output/ deleted")
        cleaned += 1
    else:
        print("  [SKIP] output/ not found")

    print()
    print(f"Done! {cleaned} items cleared. Safe to share the project.")


if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        print("\nCancelled.")
        sys.exit(0)
