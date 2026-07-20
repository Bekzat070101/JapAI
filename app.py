"""
JapAI — 日语语法闯关练习工具
Flask 后端入口

启动方式：python app.py
默认地址：http://127.0.0.1:5000
"""

import json
import os
from datetime import datetime

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
app = Flask(__name__, static_folder="static", static_url_path="")


# --- 工具函数 ---
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
    """获取 DeepSeek API 客户端。"""
    config = load_json("config.json")
    api_key = config.get("api_key", "")
    if not api_key:
        return None, "API Key 未设置"
    model = config.get("model", "deepseek-chat")
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
        # 返回时隐藏完整 API Key（只显示前4后4位）
        api_key = config.get("api_key", "")
        masked = ""
        if len(api_key) > 8:
            masked = api_key[:4] + "****" + api_key[-4:]
        return jsonify({
            "api_key": api_key,
            "api_key_masked": masked,
            "has_api_key": bool(api_key),
            "level": config.get("level", "N4"),
            "model": config.get("model", "deepseek-chat"),
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

    if not notes:
        return jsonify({"error": "笔记内容不能为空"}), 400

    # 读取已学内容
    learned = load_json("learned_content.json")
    learned_items = learned.get("items", [])

    # 读取已学单词库
    vocab_bank = load_json("vocabulary.json")
    vocab_words = vocab_bank.get("words", [])

    prompt = build_generate_questions_prompt(notes, level, learned_items, vocab_text, vocab_words)
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
            else:
                new_item["first_learned"] = today
                new_item["last_reviewed"] = today
                new_item["review_count"] = 1
                new_item["mastery"] = round(new_score / 10, 2)
                existing_map[gp] = new_item

        learned["items"] = list(existing_map.values())
        save_json("learned_content.json", learned)

        return jsonify({"success": True, "count": len(learned["items"])})


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
    filepath = os.path.join("history", f"{date}.json")
    data = load_json(filepath, None)
    if data is None:
        return jsonify({"error": "记录不存在"}), 404
    return jsonify({"success": True, "data": data})


@app.route("/api/download/<date>", methods=["GET"])
def download_markdown(date):
    """下载复习笔记 Markdown 文件。"""
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


# --- 启动 ---
if __name__ == "__main__":
    print("=" * 50)
    print("  JapAI — 日语语法闯关练习工具")
    print("  启动地址: http://127.0.0.1:5000")
    print("  按 Ctrl+C 停止服务")
    print("=" * 50)
    app.run(host="127.0.0.1", port=5000, debug=False)
