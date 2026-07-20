# JapAI — 技术架构文档

> 版本：v1.0 | 更新日期：2026-07-20

---

## 一、技术选型

| 层面 | 技术 | 理由 |
|------|------|------|
| 后端框架 | Python 3 + Flask | 轻量、一行启动、适合单机工具 |
| AI 服务 | DeepSeek API（OpenAI 兼容） | 用户指定，性价比高 |
| 前端 | 原生 HTML + CSS + JS | 无框架依赖，减少复杂度 |
| 数据存储 | JSON 文件 | 数据量小，无需数据库 |
| 启动方式 | .bat 批处理脚本 | 用户双击即可启动 |

---

## 二、项目结构

```
JapAI/
├── 启动.bat                     # Windows 双击启动脚本
├── app.py                       # Flask 后端入口（路由 + API）
├── CLAUDE.md                    # AI 开发助手指引
├── requirements.txt             # Python 依赖
├── config.json                  # 用户配置（API Key、级别、模型）
├── progress.json                # 答题进度（中途恢复）
├── learned_content.json         # 已学内容追踪库
│
├── prompts/                     # AI Prompt 模板
│   ├── __init__.py
│   ├── generate_questions.py    # 出题 prompt 构建
│   ├── grade_answer.py          # 批改 prompt 构建
│   └── generate_summary.py      # 总结 prompt 构建
│
├── static/                      # 前端静态文件
│   ├── index.html               # 主页面（6 个屏幕容器）
│   ├── style.css                # Apple 风格样式
│   └── app.js                   # 前端状态管理与交互
│
├── history/                     # 历史答题记录
│   └── YYYY-MM-DD.json
│
├── output/                      # 生成的复习笔记
│   └── review_YYYY-MM-DD.md
│
├── docs/                        # 项目文档
│   ├── requirements.md          # 需求文档
│   ├── architecture.md          # 技术架构（本文件）
│   ├── design-spec.md           # UI 设计规范
│   └── execution-plan.md        # 执行步骤计划
│
└── devlog/                      # 开发日志
    └── YYYY-MM-DD.md
```

---

## 三、后端 API 设计

### 3.1 路由表

| 方法 | 路径 | 功能 | 请求体 | 响应 |
|------|------|------|--------|------|
| GET | `/` | 返回前端页面 | — | HTML |
| GET | `/api/config` | 读取配置 | — | `{api_key, level, model}` |
| POST | `/api/config` | 保存配置 | `{api_key, level, model}` | `{success}` |
| POST | `/api/generate_questions` | 生成题目 | `{notes, level}` | `{questions: [...]}` |
| POST | `/api/grade_answer` | 批改答案 | `{question, user_answer, level, difficulty}` | `{correct_parts, error_parts, suggestions, score, new_question?}` |
| POST | `/api/generate_summary` | 生成复习笔记 | `{notes, level, records}` | `{markdown}` |
| GET | `/api/progress` | 读取进度 | — | `{progress} or {null}` |
| POST | `/api/progress` | 保存进度 | `{current_index, records}` | `{success}` |
| DELETE | `/api/progress` | 清除进度 | — | `{success}` |
| GET | `/api/learned_content` | 读取已学内容 | — | `{items: [...]}` |
| POST | `/api/learned_content` | 更新已学内容 | `{items: [...]}` | `{success}` |
| GET | `/api/history` | 历史记录列表 | — | `{files: [...]}` |
| GET | `/api/history/<date>` | 历史记录详情 | — | `{records}` |
| GET | `/api/download/<date>` | 下载复习笔记 | — | `.md` 文件 |

### 3.2 DeepSeek API 调用方式

```python
from openai import OpenAI

client = OpenAI(
    api_key=config["api_key"],
    base_url="https://api.deepseek.com"
)

response = client.chat.completions.create(
    model=config.get("model", "deepseek-chat"),
    messages=[...],
    temperature=0.7,
    response_format={"type": "json_object"}  # 要求 JSON 输出
)
```

---

## 四、数据结构

### 4.1 config.json
```json
{
  "api_key": "sk-...",
  "level": "N4",
  "model": "deepseek-chat"
}
```

### 4.2 progress.json
```json
{
  "notes": "用户的原始笔记...",
  "level": "N4",
  "current_index": 3,
  "questions": [...],
  "records": [
    {
      "question": {...},
      "user_answer": "毎日晩ご飯を食べてから散歩します。",
      "feedback": {...},
      "timestamp": "2026-07-20T15:30:00"
    }
  ]
}
```

### 4.3 题目对象（Question）
```json
{
  "id": 1,
  "grammar_point": "～てから",
  "scene": "你想告诉朋友，你每天吃完晚饭后散步",
  "chinese": "我每天吃完晚饭后散步。",
  "hints": ["晚饭 ばんごはん", "散步 さんぽ"],
  "reference_answer": "毎日晩ご飯を食べてから散歩します。",
  "difficulty": 1,
  "is_extra": false,
  "extra_level": null
}
```

### 4.4 批改反馈对象（Feedback）
```json
{
  "correct_parts": ["毎日", "散歩します"],
  "error_parts": [
    {
      "error": "语法错误的具体位置",
      "correction": "正确写法",
      "explanation": "为什么错了，语法点解释"
    }
  ],
  "suggestions": "更自然的日语说法...",
  "score": 7.5,
  "extra_notes": "N2+拓展说明（如有超纲内容）"
}
```

### 4.5 learned_content.json
```json
{
  "items": [
    {
      "grammar_point": "～てから",
      "level": "N4",
      "first_learned": "2026-07-20",
      "last_reviewed": "2026-07-20",
      "review_count": 1,
      "mastery": 0.75
    }
  ]
}
```

---

## 五、关键设计决策

### 5.1 超纲判断逻辑
- AI 根据用户所选级别判断语法点是否超纲
- 超纲题标注 `is_extra: true, extra_level: "N2+"`
- 批改时超纲题答错不扣分，答对加分
- 已学内容库中的语法点永远不算超纲

### 5.2 加大难度三级策略
- **Lv1**：基础翻译，单句，有词汇提示
- **Lv2**：加长句子 / 嵌入从句 / 混合已学语法点
- **Lv3**：不给词汇提示、用指定语法改写整段

### 5.3 已学内容追踪
- 每次完成答题后更新 `learned_content.json`
- 出题时 AI 读取已学内容，融入题目作为复习
- 语法点维度追踪：掌握度（mastery）= 历史平均得分 / 10
