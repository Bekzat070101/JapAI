# JapAI — 分步执行计划

> 版本：v1.0 | 更新日期：2026-07-20

---

## 执行原则

1. **严格按顺序** — 每步完成并验证后再进入下一步
2. **不过度开发** — 先跑通核心流程，再打磨细节
3. **每步记录** — 在 `devlog/` 中记录完成情况和问题
4. **随时可停** — 每一步完成后都是一个可运行的状态

---

## 第 1 步：创建项目骨架 ✅

### 需创建的文件
- [x] 所有目录结构（`docs/`, `devlog/`, `prompts/`, `static/`, `history/`, `output/`）
- [x] `requirements.txt` — flask, openai
- [x] `config.json` — 默认配置模板
- [x] `learned_content.json` — 空已学内容库
- [ ] `CLAUDE.md` — AI 开发指引
- [ ] `docs/requirements.md` — 需求文档
- [ ] `docs/architecture.md` — 架构文档
- [ ] `docs/design-spec.md` — 设计规范
- [ ] `docs/execution-plan.md` — 本文件
- [ ] `devlog/2026-07-20.md` — 初始开发日志

### 验收标准
- 所有目录存在
- 所有 .json 文件可被 Python 正常解析
- CLAUDE.md 包含正确的文件路径引用

---

## 第 2 步：编写 Prompt 模板

### 需创建的文件
- [ ] `prompts/__init__.py`
- [ ] `prompts/generate_questions.py`
- [ ] `prompts/grade_answer.py`
- [ ] `prompts/generate_summary.py`

### 验收标准
- 每个函数接受参数，返回格式化的 prompt 字符串
- generate_questions prompt 包含：级别限制、已学内容、出题规则、JSON 输出格式要求
- grade_answer prompt 包含：级别、超纲判断、得分标准、反馈格式
- generate_summary prompt 包含：模板结构（掌握/薄弱/错题/拓展/建议）

---

## 第 3 步：编写 Flask 后端

### 需创建的文件
- [ ] `app.py`

### API 路由清单
- [ ] `GET /` — 返回 index.html
- [ ] `GET /api/config` — 读取配置
- [ ] `POST /api/config` — 保存配置
- [ ] `POST /api/generate_questions` — 生成题目
- [ ] `POST /api/grade_answer` — 批改答案
- [ ] `POST /api/generate_summary` — 生成复习笔记
- [ ] `GET /api/progress` — 读取答题进度
- [ ] `POST /api/progress` — 保存答题进度
- [ ] `DELETE /api/progress` — 清除进度
- [ ] `GET /api/learned_content` — 读取已学内容
- [ ] `POST /api/learned_content` — 更新已学内容
- [ ] `GET /api/history` — 历史记录列表
- [ ] `GET /api/history/<date>` — 历史记录详情
- [ ] `GET /api/download/<date>` — 下载复习笔记

### 验收标准
- 每个路由返回正确的 JSON 或文件
- 错误处理：API Key 未设置、API 调用失败、文件不存在
- 本地启动 `python app.py` 不报错

---

## 第 4 步：编写前端 HTML 结构

### 需创建的文件
- [ ] `static/index.html`

### 需包含的屏幕容器
- [ ] `#screen-setup` — API Key 设置
- [ ] `#screen-main` — 级别选择 + 笔记输入
- [ ] `#screen-quiz` — 答题界面
- [ ] `#screen-summary` — 总结预览
- [ ] `#screen-history` — 历史记录列表
- [ ] `#screen-history-detail` — 历史详情

### 验收标准
- HTML 在浏览器中可正常渲染
- 所有屏幕容器结构完整
- 语义化标签，无 JS 错误

---

## 第 5 步：编写前端 CSS 样式

### 需创建的文件
- [ ] `static/style.css`

### 需覆盖的样式
- [ ] CSS 变量定义（颜色、字体、间距、圆角）
- [ ] 全局重置与排版
- [ ] 屏幕容器显示/隐藏
- [ ] 级别选择按钮
- [ ] 文本输入框（大 + 单行）
- [ ] 主按钮 / 次按钮
- [ ] 题目卡片（毛玻璃）
- [ ] 反馈卡片（正确/错误/建议）
- [ ] 进度条
- [ ] 得分显示
- [ ] 加载动画
- [ ] 响应式（小屏幕适配）

### 验收标准
- 所有 6 个屏幕静态展示符合设计规范
- 毛玻璃效果正常
- 动效流畅
- 在 Chrome/Edge 上测试通过

---

## 第 6 步：编写前端 JS 逻辑

### 需创建的文件
- [ ] `static/app.js`

### 需实现的功能
- [ ] `AppState` — 全局状态管理
- [ ] `ScreenManager` — 屏幕切换
- [ ] API 调用封装（fetch + 错误处理）
- [ ] 配置管理（读取/保存 API Key、级别）
- [ ] 出题流程（显示加载 → 缓存题目 → 进入答题）
- [ ] 答题交互（显示题目 → 回车提交 → 显示反馈）
- [ ] 反馈分支（≥8 分按钮 / <8 分按钮）
- [ ] 加大难度 / 再练一次
- [ ] 进度保存与恢复
- [ ] 总结生成与 Markdown 渲染
- [ ] 下载 .md 文件
- [ ] 历史记录查看
- [ ] 已学内容更新

### 验收标准
- 完整用户流程可走通
- 中途关闭后重开可恢复
- API 报错时有友好提示
- 得分分支按钮行为正确

---

## 第 7 步：编写启动脚本

### 需创建的文件
- [ ] `启动.bat`

### 功能
- 检测 Python 是否安装
- 自动 `pip install -r requirements.txt`
- 启动 Flask
- 自动打开浏览器到 `http://127.0.0.1:5000`

### 验收标准
- 双击 `启动.bat` 即可完整启动
- Python 未安装时有明确提示
- 编码使用 UTF-8（`chcp 65001`）

---

## 第 8 步：端到端测试

### 测试场景
- [ ] 首次启动 → 输入 API Key → 保存
- [ ] 选择级别 → 粘贴笔记 → 生成题目
- [ ] 答题 → 提交 → 查看反馈
- [ ] 高分 → 加大难度 → 出新题
- [ ] 低分 → 再练一次 → 同语法点换题
- [ ] 完成全部题目 → 生成总结 → 预览 → 下载
- [ ] 中途关闭 → 重开 → 恢复进度提示
- [ ] 查看历史记录 → 下载历史笔记
- [ ] 检查 `learned_content.json` 更新
- [ ] 第二次出题时已学内容被参考

### 边界测试
- [ ] API Key 为空时的提示
- [ ] API Key 无效时的错误处理
- [ ] 笔记为空时的提示
- [ ] 网络不通时的降级处理
- [ ] 输出文件夹自动创建

---

## 第 9 步：公开网站化（进行中）

> 更新时间：2026-07-21

### 阶段 A：基建（已完成 ✅）

- [x] API Key 环境变量化（`DEEPSEEK_API_KEY`）
- [x] 数据库模型（SQLite 本地 → PostgreSQL 生产）
- [x] ~~Authing.cn 认证中间件~~ → **Flask-Login 自建邮箱认证** ✅
- [x] 免费额度系统（每日 10 次限流装饰器）
- [x] 前端平台模式适配（用户栏 + 额度显示 + 登出按钮）

### 阶段 B：待开发

- [ ] 支付模块（xorpay）
- [ ] 阿里云 ECS + 域名购买 → 部署上线
- [ ] 所有 API 加 `@login_required` 数据隔离
- [ ] JSON → DB 数据迁移脚本
- [ ] 邮箱验证码（支付前加）
- [ ] 密码重置

### 阶段 C：后续迭代

- [ ] 管理后台
- [ ] 前端框架重构（Vue/React）
- [ ] 多模型支持
