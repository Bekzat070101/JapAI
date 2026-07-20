# JapAI — 日语语法闯关练习

一款 Windows 本地日语学习工具。粘贴语法笔记 → AI 生成场景翻译题 → 逐题闯关批改 → 自动生成复习笔记。

**搭配《标准日本语》等教材使用，随学随练。**

---

## 截图

> 启动后即可看到使用指南，首次需设置 DeepSeek API Key。

---

## 快速开始

### 1. 环境要求

- **Python 3.10+**
- Windows / macOS / Linux 均可

### 2. 安装依赖

```bash
pip install -r requirements.txt
```

### 3. 获取 API Key

前往 [DeepSeek 开放平台](https://platform.deepseek.com/api_keys) 注册并获取 API Key。

### 4. 启动

```bash
python app.py
```

浏览器打开 `http://127.0.0.1:5000`，按提示设置 API Key 即可使用。

> Windows 用户也可以双击 `启动.bat` 一键启动。

---

## 功能

| 功能 | 说明 |
|------|------|
| 📖 语法出题 | 粘贴笔记，AI 自动提取语法点生成场景翻译题 |
| 📝 单词融入 | 输入当天新单词，AI 出题时优先使用 |
| 🎯 逐题批改 | 每道题即时批改，✅/⚠️/❌ 逐项标注 |
| 🔥 难度递进 | 答得好自动升级，初级→中级→高级 |
| 🧠 知识库 | 语法和单词自动存入本地，AI 越用越懂你 |
| 🏆 终极作文 | 综合所有语法点的叙事转述作文 |
| 📊 复习笔记 | 自动生成 Markdown 复习笔记，可下载 |

---

## 项目结构

```
JapAI/
├── app.py                  # Flask 后端
├── requirements.txt        # Python 依赖
├── 启动.bat                # Windows 一键启动
├── clean_data.bat          # 清除用户数据（分享前运行）
│
├── prompts/                # AI Prompt 模板
│   ├── generate_questions.py
│   ├── grade_answer.py
│   └── generate_summary.py
│
├── static/                 # 前端
│   ├── index.html
│   ├── style.css
│   └── app.js
│
├── config.json             # 用户配置（API Key 存本地）
├── learned_content.json    # 语法知识库
├── vocabulary.json         # 单词库
│
└── docs/                   # 设计文档
    ├── requirements.md
    ├── architecture.md
    └── design-spec.md
```

---

## 隐私说明

- **API Key 仅保存在本地** `config.json`，不会上传至任何服务器
- 所有学习数据（语法库、单词库、历史记录）均存储在本地 JSON 文件
- 分享项目给他人前，请先运行 `clean_data.bat` 清除个人数据

---

## 分享前清除数据

双击 `clean_data.bat` 或运行：

```bash
python clean_data.py
```

将清除：API Key、答题进度、知识库、历史记录、复习笔记。

---

## License

MIT
