# JapAI — AI 开发助手指引

> 最后更新：2026-07-20

---

## 项目简介

JapAI 是一款 Windows 本地日语语法闯关练习工具。用户粘贴幕布笔记 → AI 生成翻译题 → 逐题作答批改 → 自动生成复习笔记。Python + Flask 后端，原生 HTML/CSS/JS 前端，DeepSeek API 驱动。

---

## 标准文档速查

| 文档 | 路径 | 用途说明 |
|------|------|----------|
| 需求文档 | [docs/requirements.md](docs/requirements.md) | 完整功能需求、用户流程、非功能约束 |
| 架构文档 | [docs/architecture.md](docs/architecture.md) | 技术选型、API 设计、数据结构、关键决策 |
| 设计规范 | [docs/design-spec.md](docs/design-spec.md) | UI 颜色/字体/间距/圆角/阴影/动效/组件规格 |
| 执行计划 | [docs/execution-plan.md](docs/execution-plan.md) | 8 步执行清单、验收标准、测试场景 |

---

## 开发工作流

```
开始新任务
  → 1. 阅读 docs/execution-plan.md 确认当前步骤
  → 2. 阅读相关标准文档（需求/架构/设计规范）
  → 3. 实现当前步骤的内容
  → 4. 验证验收标准
  → 5. 在 devlog/YYYY-MM-DD.md 中记录完成情况
  → 6. 更新 docs/execution-plan.md 勾选完成项
```

---

## 关键约束

1. **不过度开发** — 每个文件保持精简，先跑通再打磨
2. **逐步推进** — 严格按照 8 步顺序，每步验证后再下一步
3. **本地优先** — 所有数据存本地 JSON，不引入数据库
4. **用户友好** — 报错信息用中文，加载状态要可见，操作可撤销
5. **Apple 风格** — 所有 UI 实现必须对照 [docs/design-spec.md](docs/design-spec.md)

---

## 常见注意事项

- DeepSeek API 使用 OpenAI 兼容格式，base_url 为 `https://api.deepseek.com`
- `response_format={"type": "json_object"}` 可要求 AI 返回结构化 JSON
- Windows 下使用 `chcp 65001` 确保 bat 脚本 UTF-8 编码
- Flask 默认端口 5000，启动后浏览器打开 `http://127.0.0.1:5000`
- `config.json` 中的 `model` 字段可由用户自定义（当前默认 `deepseek-chat`）

---

## 数据文件说明

| 文件 | 读写 | 说明 |
|------|------|------|
| `config.json` | 读写 | 用户配置，含 API Key（敏感） |
| `progress.json` | 读写 | 当前答题进度，关闭后用于恢复 |
| `learned_content.json` | 读写 | 已学语法点追踪库 |
| `history/YYYY-MM-DD.json` | 写入 | 历史答题记录存档 |
| `output/review_YYYY-MM-DD.md` | 写入 | 生成的复习笔记 |
