"""
总结生成 Prompt 构建模块

根据完整答题记录生成专属 Markdown 复习笔记。
"""


def build_generate_summary_prompt(notes: str, level: str, records: list, vocab_used: list = None) -> str:
    """构建总结 prompt。"""

    # 单词使用情况
    vocab_section = ""
    if vocab_used and len(vocab_used) > 0:
        vocab_list = "、".join(vocab_used)
        vocab_section = f"""
## 📝 本次用到的单词
{vocab_list}

以上单词已存入本地词库，后续出题会继续用到它们进行螺旋复习。
"""

    # 整理答题记录
    records_text_parts = []
    for i, record in enumerate(records, 1):
        q = record.get("question", {})
        ua = record.get("user_answer", "")
        fb = record.get("feedback", {})

        errors_text = ""
        for ep in fb.get("error_parts", []):
            errors_text += f"    - {ep.get('level', '❌')} {ep.get('error', '')} → {ep.get('correction', '')}（{ep.get('explanation', '')}）\n"

        parts = f"""### 第{i}题
- 语法点：{q.get("grammar_point", "")}{" 📌超纲(" + q.get("extra_level", "") + ")" if q.get("is_extra") else ""}
- 场景：{q.get("scene", "")}
- 中文：{q.get("chinese", "")}
- 学生答案：{ua}
- 参考答案：{q.get("reference_answer", "")}
- 得分：{fb.get("score", "N/A")} / 10
- 正确点：{"; ".join(fb.get("correct_parts", []))}
- 错误点：
{errors_text}"""
        records_text_parts.append(parts)

    records_text = "\n\n".join(records_text_parts)

    # 统计
    total = len(records)
    scores = [r.get("feedback", {}).get("score", 0) for r in records]
    avg_score = sum(scores) / total if total > 0 else 0
    high_count = sum(1 for s in scores if s >= 8)
    low_count = sum(1 for s in scores if s < 5)

    # 分析错误类型
    all_errors = []
    for r in records:
        for ep in r.get("feedback", {}).get("error_parts", []):
            all_errors.append(ep.get("explanation", ""))

    # 提取薄弱语法点（得分 < 8 的）
    weak_points = []
    for r in records:
        score = r.get("feedback", {}).get("score", 0)
        if score < 8:
            gp = r.get("question", {}).get("grammar_point", "")
            if gp and gp not in [w["grammar_point"] for w in weak_points]:
                weak_points.append({
                    "grammar_point": gp,
                    "score": score,
                    "user_answer": r.get("user_answer", ""),
                    "reference": r.get("question", {}).get("reference_answer", ""),
                })

    # 提取超纲内容
    extra_items = []
    for r in records:
        q = r.get("question", {})
        if q.get("is_extra"):
            extra_items.append({
                "grammar_point": q.get("grammar_point", ""),
                "extra_level": q.get("extra_level", "N2+"),
                "reference": q.get("reference_answer", ""),
            })

    prompt = f"""你是一位专业日语教师，正在为{level}级别的学生生成学习总结报告。
风格要求：鼓励为主，同时精准指出薄弱点，给出可操作的建议。

## 学生原始语法笔记
```
{notes}
```
{vocab_section}

## 答题统计
- 总题数：{total} 题
- 平均得分：{avg_score:.1f} / 10
- 高分题（≥8分）：{high_count} 题
- 需加强题（<5分）：{low_count} 题

## 详细答题记录
{records_text}

## 总结要求
生成一份完整的 Markdown 复习笔记，包含以下 6 个章节：

### 1. 📊 学习概览
- 1~2 句话总体评价（积极正面）
- 关键数据：总题数、平均分、正确率
- 如平均分 ≥ 8：特别表扬；如低于 5：温和鼓励

### 2. ✅ 掌握良好的知识点
- 列出得分 ≥ 8 分的语法点
- 简要说明每个语法点学生掌握得怎么样
- 用鼓励的语气

### 3. ⚠️ 薄弱环节与易错点
- 列出得分 < 8 分的语法点
- 分析常见错误模式（如：助词混淆、时态错误、授受关系混乱等）
- 给出针对性的学习建议
- 对于{level}级别的常见错误，特别说明

### 4. 📝 错题集锦
- 逐一列出每次答错的题目
- 包含：原题中文 → 学生的错误答案 → 正确答案 → 错误原因
- 标注错误类型（助词/授受/时态/词汇/语感等）

### 5. 📌 超纲内容拓展
- 列出本次遇到的超纲语法/词汇（如有）
- 简要解释用法，注明适用级别
- 标注"以下为拓展内容，了解即可，不必强求掌握"

### 6. 🎯 后续复习建议
- 针对薄弱点的具体复习方向
- 建议接下来重点练习的语法类型
- 鼓励性结语，如"坚持就是胜利！每天进步一点点 🎉"

## 输出格式
直接用 Markdown 格式返回，不要包裹在 JSON 中。
注意层次分明（用 ## 和 ### 区分章节），排版清晰易读。"""

    return prompt
