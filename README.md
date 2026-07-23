# JapAI — 日语语法闯关练习

一款免费开源的 Windows 本地日语学习工具。粘贴语法笔记 → AI 生成场景翻译题 → 逐题闯关批改 → 自动生成复习笔记。

**搭配《标准日本语》等教材使用，随学随练，越用越聪明。**

---

## 功能

| 功能 | 说明 |
|------|------|
| 📖 语法出题 | 粘贴笔记，AI 自动提取语法点生成场景翻译题 |
| 📚 教材支持 | 内置标日知识库，选课自动限定单词范围防止超纲 |
| 📝 单词融入 | 输入新单词，AI 出题时优先使用 |
| 🎯 逐题批改 | 每道题即时批改，✅/⚠️/❌ 逐项标注 |
| 🔥 难度递进 | 答得好自动升级，初级→中级→高级 |
| 📝 错题本 | 错题自动收录，随时回顾重练 |
| 🧠 艾宾浩斯记忆 | SM-2 算法自动安排复习，到期内容自然融入日常练习 |
| 🏆 终极作文 | 综合所有语法点的叙事转述作文 |
| 📊 复习笔记 | 自动生成 Markdown 复习笔记，可下载 |

---

## 快速开始

### 1. 环境要求

- Python 3.10+
- Windows / macOS / Linux

### 2. 获取 API Key

前往 [DeepSeek 开放平台](https://platform.deepseek.com/api_keys) 注册并获取 API Key。

### 3. 安装并启动

```bash
pip install -r requirements.txt
python app.py
```

浏览器打开 `http://127.0.0.1:5000`，按提示设置 API Key 即可使用。

> Windows 用户可以双击 `启动.bat` 一键启动。

---

## 项目结构

```
JapAI/
├── app.py                  # Flask 后端
├── requirements.txt        # Python 依赖
├── 启动.bat                # Windows 一键启动
├── clean_data.py           # 清除用户数据
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
├── knowledge_base/         # 标日教材知识库
│   ├── index.json
│   └── standard_jp/
│
├── config.json             # 用户配置（API Key 存本地）
├── learned_content.json    # 语法知识库（含艾宾浩斯复习计划）
├── vocabulary.json         # 单词库
├── wrong_book.json         # 错题本
│
└── docs/                   # 设计文档
```

---

## 隐私说明

- **完全离线运行**，不需要联网到任何服务器（除了调用 DeepSeek API）
- **API Key 仅保存在本地**，不会上传
- **所有学习数据均存储在本地 JSON 文件**，开发者不收集任何数据
- 分享项目给他人前，请先运行 `clean_data.py` 清除个人数据

---

## 贡献标日知识库

`knowledge_base/standard_jp/beginner_1.json` 是已填好的第 1 课模板。
参照格式填充后续课程，然后运行 `python validate_kb.py` 校验。

---

## License

MIT
