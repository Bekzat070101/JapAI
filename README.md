# KOTOBA·AI — AI 日语语法闯关练习

一款免费开源的 Windows 本地日语学习工具。粘贴语法笔记 → AI 生成场景翻译题 → 逐题闯关批改 → 自动生成复习笔记。

**搭配《标准日本语》等教材使用，随学随练，越用越聪明。**

---

## 下载

从 [GitHub Releases](https://github.com/Bekzat070101/KotobaAI/releases) 下载 `KOTOBA-AI.exe`，双击运行即可。首次使用需准备 [DeepSeek API Key](https://platform.deepseek.com/api_keys)。

---

## 功能

| 功能 | 说明 |
|------|------|
| 📖 场景出题 | 粘贴笔记，AI 提取语法点生成带生活场景的翻译题 |
| 🎯 逐题批改 | ✅/❌/💡 逐项标注，分析对在哪、为什么错、更自然的说法 |
| 🔥 难度递进 | 答得好自动升级 Lv1→Lv2→Lv3，同语法点更深更难 |
| 📝 错题本 | 按语法点分组整理，支持展开详情和重新练习 |
| 🧠 艾宾浩斯复习 | SM-2 间隔记忆算法，自动追踪掌握度，到期提醒复习 |
| 📅 打卡月历 | 扫描历史记录，统计连续打卡天数 |
| 📋 复习笔记 | 完成一轮自动生成 Markdown 复习报告，可下载 |
| 🌓 深色模式 | 支持浅色/深色/跟随系统 |
| 📚 教材支持 | 内置标日知识库，选课自动限定单词范围 |

---

## 本地优先

- API Key、学习数据全部存储在本地 JSON 文件
- 除调用 DeepSeek API 外无需联网
- 不上传、不收集、不埋点
- GPL-3.0 开源，任何使用/修改/分发都必须保留开源，不得闭源商用

---

## 开发

```bash
pip install -r requirements.txt
python app.py
```

### 打包

```bash
build.bat
```

### 项目结构

```
KOTOBA·AI/
├── app.py                  # Flask + pywebview 主程序
├── requirements.txt
├── build.bat               # PyInstaller 打包脚本
├── logo.ico                # exe 图标
│
├── prompts/                # AI Prompt 模板
├── static/                 # 前端 HTML/CSS/JS + logo 资源
├── knowledge_base/         # 标日教材语法库
│
├── config.json             # 用户配置（本地）
├── learned_content.json    # 已学语法追踪（SM-2）
├── wrong_book.json         # 错题本
```

---

## License

[GPL-3.0](LICENSE) © [Bekzat070101](https://github.com/Bekzat070101)
