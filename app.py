"""
JapAI — 日语语法闯关练习工具
Flask 后端入口

启动方式：python app.py
默认地址：http://127.0.0.1:5000
"""

import json
import os
from datetime import datetime, timedelta

from flask import Flask, jsonify, request, send_from_directory
from openai import OpenAI

from prompts.generate_questions import (
    build_generate_questions_prompt,
    build_essay_question_prompt,
)
from prompts.grade_answer import (
    build_grade_answer_prompt,
    build_regenerate_question_prompt,
    build_harder_question_prompt,
    build_essay_grade_prompt,
)
from prompts.generate_summary import build_generate_summary_prompt
# --- 初始化 ---
import sys

# PyInstaller 打包后资源路径处理
def resource_path(relative_path):
    """获取资源文件的绝对路径（兼容 PyInstaller 打包）。"""
    if hasattr(sys, "_MEIPASS"):
        return os.path.join(sys._MEIPASS, relative_path)
    return os.path.join(os.path.dirname(os.path.abspath(__file__)), relative_path)

app = Flask(__name__, static_folder=resource_path("static"), static_url_path="")
# 限制请求体大小为 1MB（防止 DoS / 巨额 API 费用）
app.config["MAX_CONTENT_LENGTH"] = 1 * 1024 * 1024

# 输入验证常量
MAX_NOTES_LENGTH = 50000      # 笔记最多 5 万字
MAX_VOCAB_LENGTH = 20000      # 单词最多 2 万字
MAX_ANSWER_LENGTH = 10000     # 答案最多 1 万字
MAX_RECORDS_COUNT = 100       # 答题记录最多 100 条


# --- 工具函数 ---
def validate_input(value, max_len, field_name):
    """验证输入长度，超限返回错误信息。"""
    if value and len(value) > max_len:
        return f"{field_name}过长（最大 {max_len} 字）"
    return None

def sanitize_date(date_str):
    """验证日期格式为 YYYY-MM-DD，防止路径穿越。"""
    import re
    if not re.match(r"^\d{4}-\d{2}-\d{2}$", date_str):
        return None
    return date_str

def load_json(filepath, default=None):
    """安全加载 JSON 文件，文件不存在时返回默认值。"""
    if default is None:
        default = {}
    if not os.path.exists(filepath):
        return default
    try:
        with open(filepath, "r", encoding="utf-8") as f:
            return json.load(f)
    except (json.JSONDecodeError, IOError):
        return default


def save_json(filepath, data):
    """保存 JSON 文件，自动创建目录。"""
    dirname = os.path.dirname(filepath)
    if dirname and not os.path.exists(dirname):
        os.makedirs(dirname)
    with open(filepath, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)


def get_deepseek_client():
    """获取 DeepSeek API 客户端。
    优先使用环境变量 DEEPSEEK_API_KEY（生产环境），
    其次读取 config.json（本地开发）。"""
    # 优先读环境变量（服务器部署用）
    api_key = os.environ.get("DEEPSEEK_API_KEY", "")
    model = os.environ.get("DEEPSEEK_MODEL", "")

    # 环境变量未设置时，回退到 config.json（本地开发用）
    if not api_key:
        config = load_json("config.json")
        api_key = config.get("api_key", "")
        if not model:
            model = config.get("model", "deepseek-chat")

    if not api_key:
        return None, "API Key 未设置"

    if not model:
        model = "deepseek-chat"

    client = OpenAI(api_key=api_key, base_url="https://api.deepseek.com")
    return client, model


def call_deepseek(prompt: str, require_json: bool = True) -> str:
    """
    调用 DeepSeek API，返回响应文本。
    失败时返回 None 并打印错误。
    """
    client, model = get_deepseek_client()
    if client is None:
        print("[错误] API Key 未设置，请先在界面中输入 DeepSeek API Key")
        return None

    print(f"[API] 正在调用 DeepSeek（模型: {model}）...")

    kwargs = {
        "model": model,
        "messages": [{"role": "user", "content": prompt}],
        "temperature": 0.7,
        "max_tokens": 4096,
    }
    if require_json:
        kwargs["response_format"] = {"type": "json_object"}

    try:
        response = client.chat.completions.create(**kwargs)
        print(f"[API] DeepSeek 返回成功")
        return response.choices[0].message.content
    except Exception as e:
        error_msg = str(e)
        print(f"[API 错误] {error_msg}")
        return None


# --- 静态文件 ---
@app.route("/")
def index():
    return send_from_directory("static", "index.html")


# --- 配置管理 ---
@app.route("/api/config", methods=["GET", "POST"])
def handle_config():
    if request.method == "GET":
        config = load_json("config.json")
        # 读取 API Key
        api_key = config.get("api_key", "")
        masked = ""
        if len(api_key) > 8:
            masked = api_key[:4] + "****" + api_key[-4:]
        model = os.environ.get("DEEPSEEK_MODEL", "") or config.get("model", "deepseek-chat")
        return jsonify({
            "api_key": api_key,
            "api_key_masked": masked,
            "has_api_key": bool(api_key),
            "level": config.get("level", "N4"),
            "model": model,
        })
    else:  # POST
        data = request.get_json(silent=True) or {}
        config = load_json("config.json")
        if "api_key" in data:
            config["api_key"] = data["api_key"]
        if "level" in data:
            config["level"] = data["level"]
        if "model" in data:
            config["model"] = data["model"]
        save_json("config.json", config)
        return jsonify({"success": True})


# --- 出题 ---
@app.route("/api/generate_questions", methods=["POST"])
def generate_questions():
    data = request.get_json(silent=True) or {}
    notes = data.get("notes", "").strip()
    level = data.get("level", "N4")
    vocab_text = data.get("vocabulary", "").strip()
    textbook_vocab = data.get("textbook_vocab", [])  # 教材单词

    if not notes:
        return jsonify({"error": "笔记内容不能为空"}), 400

    # 输入长度验证
    err = validate_input(notes, MAX_NOTES_LENGTH, "笔记内容")
    if err: return jsonify({"error": err}), 400
    err = validate_input(vocab_text, MAX_VOCAB_LENGTH, "单词内容")
    if err: return jsonify({"error": err}), 400

    # 读取已学内容
    learned = load_json("learned_content.json")
    learned_items = learned.get("items", [])

    # 读取已学单词库
    vocab_bank = load_json("vocabulary.json")
    vocab_words = vocab_bank.get("words", [])

    prompt = build_generate_questions_prompt(
        notes, level, learned_items, vocab_text, vocab_words,
        textbook_vocab=textbook_vocab,
    )
    response_text = call_deepseek(prompt, require_json=True)

    if response_text is None:
        return jsonify({"error": "AI 服务调用失败，请检查 API Key 和网络连接"}), 500

    try:
        result = json.loads(response_text)
    except json.JSONDecodeError:
        # 有时 AI 返回的 JSON 被包裹在 ```json ... ``` 中
        import re
        match = re.search(r"```(?:json)?\s*([\s\S]*?)```", response_text)
        if match:
            try:
                result = json.loads(match.group(1))
            except json.JSONDecodeError:
                return jsonify({"error": "AI 返回格式异常，请重试", "raw": response_text[:500]}), 500
        else:
            return jsonify({"error": "AI 返回格式异常，请重试", "raw": response_text[:500]}), 500

    # 更新 level 到配置
    config = load_json("config.json")
    config["level"] = level
    save_json("config.json", config)

    return jsonify({"success": True, "data": result})


# --- 终极挑战作文题 ---
@app.route("/api/generate_essay", methods=["POST"])
def generate_essay():
    data = request.get_json(silent=True) or {}
    grammar_points = data.get("grammar_points", [])
    level = data.get("level", "N4")
    notes = data.get("notes", "")

    if not grammar_points:
        return jsonify({"error": "没有语法点"}), 400

    # 读取单词库
    vocab_bank = load_json("vocabulary.json")
    vocab_words = vocab_bank.get("words", [])

    prompt = build_essay_question_prompt(grammar_points, level, notes, vocab_words)
    response_text = call_deepseek(prompt, require_json=True)

    if response_text is None:
        return jsonify({"error": "AI 服务调用失败"}), 500

    try:
        result = json.loads(response_text)
    except json.JSONDecodeError:
        import re
        match = re.search(r"```(?:json)?\s*([\s\S]*?)```", response_text)
        if match:
            try:
                result = json.loads(match.group(1))
            except json.JSONDecodeError:
                return jsonify({"error": "AI 返回格式异常"}), 500
        else:
            return jsonify({"error": "AI 返回格式异常"}), 500

    return jsonify({"success": True, "data": result})


# --- 作文批改 ---
@app.route("/api/grade_essay", methods=["POST"])
def grade_essay():
    data = request.get_json(silent=True) or {}
    essay_question = data.get("essay_question", {})
    user_answer = data.get("user_answer", "").strip()
    level = data.get("level", "N4")

    if not user_answer:
        return jsonify({"error": "答案不能为空"}), 400
    err = validate_input(user_answer, MAX_ANSWER_LENGTH * 3, "答案")
    if err: return jsonify({"error": err}), 400

    prompt = build_essay_grade_prompt(essay_question, user_answer, level)
    response_text = call_deepseek(prompt, require_json=True)

    if response_text is None:
        return jsonify({"error": "AI 服务调用失败"}), 500

    try:
        result = json.loads(response_text)
    except json.JSONDecodeError:
        import re
        match = re.search(r"```(?:json)?\s*([\s\S]*?)```", response_text)
        if match:
            try:
                result = json.loads(match.group(1))
            except json.JSONDecodeError:
                return jsonify({"error": "AI 返回格式异常"}), 500
        else:
            return jsonify({"error": "AI 返回格式异常"}), 500

    return jsonify({"success": True, "feedback": result})


# --- 批改 ---
@app.route("/api/grade_answer", methods=["POST"])
def grade_answer():
    data = request.get_json(silent=True) or {}
    question = data.get("question", {})
    user_answer = data.get("user_answer", "").strip()
    level = data.get("level", "N4")
    action = data.get("action", "grade")  # "grade" | "harder" | "retry"

    # --- 处理"换题重练"请求（不需要批改，直接生成新题）---
    if action == "retry":
        grammar_point = question.get("grammar_point", "")
        # 读取已学内容，限制新题只能组合已学语法
        learned = load_json("learned_content.json")
        learned_items = learned.get("items", [])
        prompt = build_regenerate_question_prompt(grammar_point, level, question, learned_items)
        response_text = call_deepseek(prompt, require_json=True)
        if response_text is None:
            return jsonify({"error": "AI 服务调用失败"}), 500
        try:
            new_question = json.loads(response_text)
        except json.JSONDecodeError:
            import re
            match = re.search(r"```(?:json)?\s*([\s\S]*?)```", response_text)
            if match:
                new_question = json.loads(match.group(1))
            else:
                return jsonify({"error": "生成新题失败，请重试"}), 500
        return jsonify({"success": True, "action": "retry", "new_question": new_question})

    # --- 处理"加大难度"请求（不需要批改，直接生成更难题目）---
    if action == "harder":
        grammar_point = question.get("grammar_point", "")
        current_diff = question.get("difficulty", 1)
        # 读取已学内容，限制进阶题只能组合已学语法
        learned = load_json("learned_content.json")
        learned_items = learned.get("items", [])
        prompt = build_harder_question_prompt(grammar_point, level, question, current_diff, learned_items)
        response_text = call_deepseek(prompt, require_json=True)
        if response_text is None:
            return jsonify({"error": "AI 服务调用失败"}), 500
        try:
            new_question = json.loads(response_text)
        except json.JSONDecodeError:
            import re
            match = re.search(r"```(?:json)?\s*([\s\S]*?)```", response_text)
            if match:
                new_question = json.loads(match.group(1))
            else:
                return jsonify({"error": "生成新题失败，请重试"}), 500
        return jsonify({"success": True, "action": "harder", "new_question": new_question})

    # --- 正常批改：必须有答案 ---
    if not user_answer:
        return jsonify({"error": "答案不能为空"}), 400
    err = validate_input(user_answer, MAX_ANSWER_LENGTH, "答案")
    if err: return jsonify({"error": err}), 400

    # 正常批改
    prompt = build_grade_answer_prompt(question, user_answer, level)
    response_text = call_deepseek(prompt, require_json=True)

    if response_text is None:
        return jsonify({"error": "AI 服务调用失败"}), 500

    try:
        result = json.loads(response_text)
    except json.JSONDecodeError:
        import re
        match = re.search(r"```(?:json)?\s*([\s\S]*?)```", response_text)
        if match:
            try:
                result = json.loads(match.group(1))
            except json.JSONDecodeError:
                return jsonify({"error": "AI 返回格式异常", "raw": response_text[:500]}), 500
        else:
            return jsonify({"error": "AI 返回格式异常", "raw": response_text[:500]}), 500

    return jsonify({
        "success": True,
        "action": "grade",
        "feedback": result,
    })


# --- 生成总结 ---
@app.route("/api/generate_summary", methods=["POST"])
def generate_summary():
    data = request.get_json(silent=True) or {}
    notes = data.get("notes", "")
    level = data.get("level", "N4")
    records = data.get("records", [])
    vocab_used = data.get("vocab_used", [])

    if not records:
        return jsonify({"error": "没有答题记录"}), 400
    if len(records) > MAX_RECORDS_COUNT:
        return jsonify({"error": "答题记录数异常"}), 400

    prompt = build_generate_summary_prompt(notes, level, records, vocab_used)
    response_text = call_deepseek(prompt, require_json=False)

    if response_text is None:
        return jsonify({"error": "AI 服务调用失败"}), 500

    # 保存 Markdown 文件
    today = datetime.now().strftime("%Y-%m-%d")
    md_filename = f"review_{today}.md"
    md_path = os.path.join("output", md_filename)
    save_json(md_path.replace(".md", ".json"), {})  # 不适用，直接写 md
    dirname = os.path.dirname(md_path)
    if dirname and not os.path.exists(dirname):
        os.makedirs(dirname)
    with open(md_path, "w", encoding="utf-8") as f:
        f.write(response_text)

    # 保存历史记录
    history_path = os.path.join("history", f"{today}.json")
    existing_history = load_json(history_path, {"records": []})
    existing_history["records"].extend(records)
    existing_history["summary_md"] = md_filename
    existing_history["level"] = level
    existing_history["updated_at"] = datetime.now().isoformat()
    save_json(history_path, existing_history)

    return jsonify({
        "success": True,
        "markdown": response_text,
        "filename": md_filename,
        "date": today,
    })


# --- 进度管理 ---
@app.route("/api/progress", methods=["GET", "POST", "DELETE"])
def handle_progress():
    if request.method == "GET":
        progress = load_json("progress.json", None)
        if progress and progress.get("current_index") is not None:
            return jsonify({"has_progress": True, "data": progress})
        return jsonify({"has_progress": False, "data": None})

    elif request.method == "POST":
        data = request.get_json(silent=True) or {}
        save_json("progress.json", data)
        return jsonify({"success": True})

    elif request.method == "DELETE":
        if os.path.exists("progress.json"):
            os.remove("progress.json")
        return jsonify({"success": True})


# --- 已学内容管理 ---
@app.route("/api/learned_content", methods=["GET", "POST"])
def handle_learned_content():
    if request.method == "GET":
        learned = load_json("learned_content.json")
        return jsonify(learned)

    elif request.method == "POST":
        data = request.get_json(silent=True) or {}
        new_items = data.get("items", [])
        if not new_items:
            return jsonify({"error": "没有要更新的内容"}), 400

        learned = load_json("learned_content.json")
        existing = learned.get("items", [])

        # 合并更新
        existing_map = {item["grammar_point"]: item for item in existing}
        today = datetime.now().strftime("%Y-%m-%d")

        for new_item in new_items:
            gp = new_item.get("grammar_point", "")
            new_score = new_item.get("score", 0)
            if gp in existing_map:
                old = existing_map[gp]
                old_reviews = old.get("review_count", 0)
                old_mastery = old.get("mastery", 0)
                # 新掌握度 = (旧掌握度 * 旧次数 + 本次得分/10) / (旧次数 + 1)
                new_mastery = (old_mastery * old_reviews + new_score / 10) / (old_reviews + 1)
                old["mastery"] = round(new_mastery, 2)
                old["review_count"] = old_reviews + 1
                old["last_reviewed"] = today
                if new_item.get("level"):
                    old["level"] = new_item["level"]

                # --- 艾宾浩斯 SM-2 调度 ---
                quality = min(5, max(0, int(new_score / 2)))  # 0-10 → 0-5
                old_stage = old.get("review_stage", 0)
                history = old.get("history_scores", [])
                history.append(new_score)
                old["history_scores"] = history[-10:]  # 保留最近10次

                intervals = [1, 2, 4, 7, 15, 30]
                if quality >= 3:
                    # 答对：推进阶段
                    new_stage = min(old_stage + 1, len(intervals) - 1)
                else:
                    # 答错：回退一个阶段
                    new_stage = max(0, old_stage - 1)

                old["review_stage"] = new_stage
                old["review_interval"] = intervals[new_stage]

                # 计算下次复习日期
                from datetime import date, timedelta
                next_date = date.today() + timedelta(days=intervals[new_stage])
                old["next_review"] = next_date.isoformat()
            else:
                new_item["first_learned"] = today
                new_item["last_reviewed"] = today
                new_item["review_count"] = 1
                new_item["mastery"] = round(new_score / 10, 2)
                # 初始化复习字段
                new_item["review_stage"] = 0
                new_item["review_interval"] = 1
                new_item["history_scores"] = [new_score]
                from datetime import date, timedelta
                new_item["next_review"] = (date.today() + timedelta(days=1)).isoformat()
                existing_map[gp] = new_item

        learned["items"] = list(existing_map.values())
        save_json("learned_content.json", learned)

        return jsonify({"success": True, "count": len(learned["items"])})


# --- 复习到期检测 ---
@app.route("/api/review_due", methods=["GET"])
def get_review_due():
    """返回今日到期的复习语法点。"""
    learned = load_json("learned_content.json")
    items = learned.get("items", [])
    today = datetime.now().strftime("%Y-%m-%d")

    due = [item for item in items if item.get("next_review", "2099-12-31") <= today]
    # 按掌握度从低到高排序，薄弱点优先复习
    due.sort(key=lambda x: x.get("mastery", 1.0))

    return jsonify({"due": due, "total": len(items)})


# --- 单词库管理 ---
@app.route("/api/vocabulary", methods=["GET", "POST"])
def handle_vocabulary():
    if request.method == "GET":
        vocab = load_json("vocabulary.json")
        return jsonify(vocab)

    elif request.method == "POST":
        data = request.get_json(silent=True) or {}
        new_words = data.get("words", [])
        if not new_words:
            return jsonify({"error": "没有要更新的单词"}), 400

        vocab = load_json("vocabulary.json")
        existing = vocab.get("words", [])

        # 按 "日语写法" 去重合并
        existing_map = {w["word"]: w for w in existing}
        today = datetime.now().strftime("%Y-%m-%d")

        for new_word in new_words:
            w = new_word.get("word", "").strip()
            if not w:
                continue
            if w in existing_map:
                old = existing_map[w]
                old_reviews = old.get("review_count", 0)
                old["review_count"] = old_reviews + 1
                old["last_reviewed"] = today
                if new_word.get("reading"):
                    old["reading"] = new_word["reading"]
                if new_word.get("meaning"):
                    old["meaning"] = new_word["meaning"]
                if new_word.get("pos"):
                    old["pos"] = new_word["pos"]
            else:
                new_word["first_learned"] = today
                new_word["last_reviewed"] = today
                new_word["review_count"] = 1
                existing_map[w] = new_word

        vocab["words"] = list(existing_map.values())
        save_json("vocabulary.json", vocab)

        return jsonify({"success": True, "count": len(vocab["words"])})


# --- 教材知识库 ---
@app.route("/api/knowledge_base", methods=["GET"])
def list_textbooks():
    """返回教材列表和课程索引。"""
    index = load_json("knowledge_base/index.json")
    return jsonify(index)


@app.route("/api/knowledge_base/<volume_id>", methods=["GET"])
def get_textbook_volume(volume_id):
    """加载指定教材分册的全部课程数据。"""
    index = load_json("knowledge_base/index.json")
    file_path = None
    for textbook in index.get("textbooks", []):
        for vol in textbook.get("volumes", []):
            if vol["id"] == volume_id:
                file_path = vol["file"]
                break

    if not file_path:
        return jsonify({"error": "教材不存在"}), 404

    full_path = os.path.join("knowledge_base", file_path)
    data = load_json(full_path, None)
    if data is None:
        return jsonify({"error": "教材文件不存在或格式错误"}), 404
    return jsonify(data)


# --- 错题本 ---
@app.route("/api/wrong_book", methods=["GET"])
def list_wrong_book():
    """获取错题本全部条目。"""
    wb = load_json("wrong_book.json")
    items = wb.get("items", [])
    # 按添加时间倒序，未掌握的排前面
    items.sort(key=lambda x: (x.get("mastered", False), x.get("added_at", "")), reverse=False)
    return jsonify({"items": items})


@app.route("/api/wrong_book", methods=["POST"])
def update_wrong_book():
    """新增或更新错题条目。"""
    data = request.get_json(silent=True) or {}
    new_items = data.get("items", [])
    if not new_items:
        return jsonify({"error": "没有要更新的内容"}), 400

    wb = load_json("wrong_book.json")
    existing = wb.get("items", [])
    existing_map = {item.get("id"): item for item in existing}

    for new_item in new_items:
        item_id = new_item.get("id")
        if item_id in existing_map:
            # 更新已有条目
            old = existing_map[item_id]
            old["reviewed_count"] = new_item.get("reviewed_count", old.get("reviewed_count", 0))
            old["last_reviewed"] = new_item.get("last_reviewed", old.get("last_reviewed"))
            old["score"] = new_item.get("score", old.get("score", 0))
            old["mastered"] = new_item.get("mastered", old.get("mastered", False))
        else:
            existing_map[item_id] = new_item

    wb["items"] = list(existing_map.values())
    save_json("wrong_book.json", wb)
    return jsonify({"success": True, "count": len(wb["items"])})


@app.route("/api/wrong_book/<int:item_id>", methods=["DELETE"])
def delete_wrong_item(item_id):
    """删除某个错题条目（标记为已掌握时调用）。"""
    wb = load_json("wrong_book.json")
    items = wb.get("items", [])
    wb["items"] = [i for i in items if i.get("id") != item_id]
    save_json("wrong_book.json", wb)
    return jsonify({"success": True})


# --- 历史记录 ---
@app.route("/api/history", methods=["GET"])
def list_history():
    history_dir = "history"
    if not os.path.exists(history_dir):
        return jsonify({"files": []})

    files = []
    for f in sorted(os.listdir(history_dir), reverse=True):
        if f.endswith(".json"):
            filepath = os.path.join(history_dir, f)
            h = load_json(filepath)
            date_str = f.replace(".json", "")
            files.append({
                "date": date_str,
                "level": h.get("level", ""),
                "record_count": len(h.get("records", [])),
                "summary_md": h.get("summary_md", ""),
            })
    return jsonify({"files": files})


@app.route("/api/history/<date>", methods=["GET"])
def get_history_detail(date):
    date = sanitize_date(date)
    if not date:
        return jsonify({"error": "日期格式无效"}), 400
    filepath = os.path.join("history", f"{date}.json")
    data = load_json(filepath, None)
    if data is None:
        return jsonify({"error": "记录不存在"}), 404
    return jsonify({"success": True, "data": data})


@app.route("/api/download/<date>", methods=["GET"])
def download_markdown(date):
    """下载复习笔记 Markdown 文件。"""
    date = sanitize_date(date)
    if not date:
        return jsonify({"error": "日期格式无效"}), 400
    md_filename = f"review_{date}.md"
    md_path = os.path.join("output", md_filename)
    if not os.path.exists(md_path):
        # 尝试从 history 中找到对应的 md 文件名
        history_path = os.path.join("history", f"{date}.json")
        history = load_json(history_path, None)
        if history and history.get("summary_md"):
            md_filename = history["summary_md"]
            md_path = os.path.join("output", md_filename)

    if not os.path.exists(md_path):
        return jsonify({"error": "文件不存在"}), 404

    return send_from_directory(
        "output",
        md_filename,
        as_attachment=True,
        download_name=md_filename,
    )


@app.route("/api/checkin", methods=["GET"])
def get_checkin():
    """返回打卡数据：活跃日期列表、连续天数、本月天数。"""
    history_dir = "history"
    if not os.path.exists(history_dir):
        return jsonify({"dates": [], "streak": 0, "monthly_count": 0, "monthly_dates": []})

    dates = []
    for f in os.listdir(history_dir):
        if f.endswith(".json"):
            date_str = f.replace(".json", "")
            if len(date_str) == 10:  # YYYY-MM-DD
                dates.append(date_str)

    dates.sort()
    date_set = set(dates)

    # 计算连续打卡天数（从今天往前数）
    streak = 0
    check = datetime.now()
    # 如果今天还没打卡，从昨天开始算
    if datetime.now().strftime("%Y-%m-%d") not in date_set:
        check = datetime.now() - timedelta(days=1)

    while check.strftime("%Y-%m-%d") in date_set:
        streak += 1
        check = check - timedelta(days=1)

    # 本月打卡天数
    current_month = datetime.now().strftime("%Y-%m")
    monthly_dates = [d for d in dates if d.startswith(current_month)]

    return jsonify({
        "dates": dates,
        "streak": streak,
        "monthly_count": len(monthly_dates),
        "monthly_dates": monthly_dates,
    })


# --- 启动 ---
if __name__ == "__main__":
    import webbrowser
    from threading import Timer
    print("=" * 50)
    print("  JapAI — 日语语法闯关练习工具")
    print("  启动地址: http://127.0.0.1:5000")
    print("  按 Ctrl+C 停止服务")
    print("=" * 50)
    # 1.5 秒后自动打开浏览器
    Timer(1.5, lambda: webbrowser.open("http://127.0.0.1:5000")).start()
    app.run(host="127.0.0.1", port=5000, debug=False)
