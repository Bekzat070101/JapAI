/* ============================================================
   JapAI — 前端交互逻辑
   状态管理 / API 交互 / 屏幕切换 / 进度保存
   ============================================================ */

// --- 全局状态 ---
const AppState = {
    config: { api_key: "", level: "N3", model: "deepseek-chat" },
    questions: [],          // 全部题目
    currentIndex: 0,        // 当前题目索引
    records: [],            // 答题记录
    notes: "",              // 原始笔记
    vocabulary: "",         // 今日单词（原始文本）
    vocabUsed: [],          // AI 出题中用到的今日单词
    totalAnswered: 0,       // 已答题数（含加练/换题）
    baseTotal: 0,           // 原始题目总数（进度条分母）
    historyDate: null,      // 查看历史详情时的日期
};

// --- 工具函数 ---
const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => document.querySelectorAll(sel);

function show(el) { el.style.display = ""; }
function hide(el) { el.style.display = "none"; }

// --- API 封装 ---
async function api(url, options = {}) {
    try {
        const res = await fetch(url, {
            headers: { "Content-Type": "application/json" },
            ...options,
        });
        const data = await res.json();
        if (!res.ok) {
            // 优先显示服务器返回的错误信息
            throw new Error(data.error || `请求失败 (HTTP ${res.status})`);
        }
        return data;
    } catch (err) {
        // 如果服务器返回了明确的错误，直接抛出
        if (err.message && !err.message.includes("Failed to fetch")) {
            throw err;
        }
        // 否则是网络不通（服务器没启动或已崩溃）
        throw new Error(
            "无法连接到本地服务 (http://127.0.0.1:5000)\n\n" +
            "请检查：\n" +
            "1. 命令行窗口是否还在运行（没被关闭）\n" +
            "2. 命令行窗口中是否有红色的报错信息\n" +
            "3. 如果服务已崩溃，请重新双击 启动.bat"
        );
    }
}

// --- 屏幕管理 ---
function showScreen(name) {
    $$(".screen").forEach(s => hide(s));
    const screen = $(`#screen-${name}`);
    if (screen) show(screen);
}

function showLoading(text = "加载中...") {
    $("#loading-text").textContent = text;
    show($("#screen-loading"));
}

function hideLoading() {
    hide($("#screen-loading"));
}

// --- 简单 Markdown → HTML ---
function renderMarkdown(md) {
    if (!md) return "";
    let html = md
        // 标题
        .replace(/^### (.+)$/gm, "<h3>$1</h3>")
        .replace(/^## (.+)$/gm, "<h2>$1</h2>")
        .replace(/^# (.+)$/gm, "<h1>$1</h1>")
        // 粗体
        .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
        // 代码块
        .replace(/```([\s\S]*?)```/g, "<pre><code>$1</code></pre>")
        // 行内代码
        .replace(/`([^`]+)`/g, "<code>$1</code>")
        // 水平线
        .replace(/^---$/gm, "<hr>")
        // 无序列表
        .replace(/^- (.+)$/gm, "<li>$1</li>")
        // 有序列表
        .replace(/^\d+\. (.+)$/gm, "<li>$1</li>")
        // 引用
        .replace(/^> (.+)$/gm, "<blockquote>$1</blockquote>")
        // 段落（连续非空行）
        .replace(/\n\n/g, "</p><p>")
        // 换行
        .replace(/\n/g, "<br>");

    html = "<p>" + html + "</p>";
    // 包裹连续的 li
    html = html.replace(/(<li>.*?<\/li>)+/g, "<ul>$&</ul>");
    // 清理空标签
    html = html.replace(/<p><\/p>/g, "");
    html = html.replace(/<p>(<h[123]>)<\/p>/g, "$1");
    html = html.replace(/(<\/h[123]>)<\/p>/g, "$1");
    html = html.replace(/<p>(<ul>)<\/p>/g, "$1");
    html = html.replace(/(<\/ul>)<\/p>/g, "$1");

    return html;
}

// --- 字符计数 ---
function updateCharCount() {
    const text = $("#notes-input").value;
    $("#char-count").textContent = `${text.length} 字`;
}

function updateVocabCharCount() {
    const text = $("#vocab-input").value;
    $("#vocab-char-count").textContent = `已输入 ${text.split('\n').filter(l => l.trim()).length} 个单词`;
}

// --- 配置管理 ---
async function loadConfig() {
    try {
        const data = await api("/api/config");
        AppState.config = data;
        return data;
    } catch {
        return null;
    }
}

async function saveConfig(config) {
    await api("/api/config", {
        method: "POST",
        body: JSON.stringify(config),
    });
    AppState.config = { ...AppState.config, ...config };
}

// ============================================================
// 屏幕 -1：使用指南
// ============================================================
async function initGuideScreen() {
    // 如果已经设置过 API Key，跳过指南直接进入
    const data = await loadConfig();
    if (data && data.has_api_key) {
        initMainScreen();
        return;
    }

    showScreen("guide");

    $("#btn-guide-start").onclick = () => {
        initSetupScreen();
    };
}

// ============================================================
// 屏幕 1：API Key 设置
// ============================================================
async function initSetupScreen() {
    const data = await loadConfig();
    if (data && data.has_api_key) {
        // 已有 API Key，跳过设置页
        initMainScreen();
        return;
    }

    showScreen("setup");
    $("#api-key-input").value = "";
    $("#setup-error").style.display = "none";

    $("#btn-save-key").onclick = async () => {
        const key = $("#api-key-input").value.trim();
        if (!key) {
            showError("setup-error", "请输入 API Key");
            return;
        }
        if (!key.startsWith("sk-")) {
            showError("setup-error", "API Key 格式不正确，应以 sk- 开头");
            return;
        }
        try {
            await saveConfig({ api_key: key });
            initMainScreen();
        } catch (err) {
            showError("setup-error", err.message);
        }
    };

    $("#btn-skip-setup").onclick = () => {
        initMainScreen();
    };

    // 回车提交
    $("#api-key-input").onkeydown = (e) => {
        if (e.key === "Enter") $("#btn-save-key").click();
    };
}

function showError(id, msg) {
    const el = $(`#${id}`);
    el.textContent = msg;
    show(el);
}

// ============================================================
// 屏幕 2：主页（级别选择 + 笔记输入）
// ============================================================
async function initMainScreen() {
    hideLoading();

    // 检查是否有未完成进度
    try {
        const progress = await api("/api/progress");
        if (progress.has_progress && progress.data) {
            showResumeModal(progress.data);
            return;
        }
    } catch {
        // 忽略错误，继续正常流程
    }

    showMainScreen();
}

function showMainScreen() {
    showScreen("main");

    // 设置默认级别
    const level = AppState.config.level || "N3";
    $$(".level-btn").forEach(btn => {
        btn.classList.toggle("active", btn.dataset.level === level);
    });

    // 恢复笔记内容
    if (AppState.notes) {
        $("#notes-input").value = AppState.notes;
        updateCharCount();
    }

    // 恢复单词内容
    if (AppState.vocabulary) {
        $("#vocab-input").value = AppState.vocabulary;
        updateVocabCharCount();
    }

    // 级别选择
    $$(".level-btn").forEach(btn => {
        btn.onclick = () => {
            $$(".level-btn").forEach(b => b.classList.remove("active"));
            btn.classList.add("active");
            AppState.config.level = btn.dataset.level;
        };
    });

    // 字数统计
    $("#notes-input").oninput = updateCharCount;
    $("#vocab-input").oninput = updateVocabCharCount;

    // 开始训练
    $("#btn-start").onclick = startTraining;

    // 历史记录
    $("#btn-goto-history").onclick = initHistoryScreen;

    // 设置
    $("#btn-goto-settings").onclick = () => {
        showScreen("setup");
        // 读取当前 API Key
        loadConfig().then(data => {
            if (data) {
                $("#api-key-input").value = data.api_key || "";
            }
        });
        $("#btn-save-key").onclick = async () => {
            const key = $("#api-key-input").value.trim();
            await saveConfig({ api_key: key });
            showMainScreen();
        };
        $("#btn-skip-setup").onclick = showMainScreen;
    };
}

async function startTraining() {
    const notes = $("#notes-input").value.trim();
    if (!notes) {
        showError("main-error", "请先粘贴语法笔记");
        return;
    }

    const level = AppState.config.level;
    const vocabEnabled = $("#vocab-enabled").checked;
    const vocabText = vocabEnabled ? $("#vocab-input").value.trim() : "";

    showLoading("正在分析笔记，生成题目...");
    hide($("#main-error"));

    try {
        const result = await api("/api/generate_questions", {
            method: "POST",
            body: JSON.stringify({ notes, level, vocabulary: vocabText }),
        });

        if (!result.success || !result.data) {
            throw new Error("出题失败，请重试");
        }

        AppState.notes = notes;
        AppState.vocabulary = vocabText;
        AppState.questions = result.data.questions || [];
        AppState.vocabUsed = result.data.vocab_used || [];
        AppState.currentIndex = 0;
        AppState.records = [];
        AppState.totalAnswered = 0;
        AppState.baseTotal = AppState.questions.length;

        if (AppState.questions.length === 0) {
            throw new Error("未能从笔记中提取到语法点，请检查笔记内容");
        }

        // 保存初始进度
        await saveProgress();

        hideLoading();
        initQuizScreen();
    } catch (err) {
        hideLoading();
        showError("main-error", err.message);
    }
}

// ============================================================
// 屏幕 3：答题界面
// ============================================================
function initQuizScreen() {
    showScreen("quiz");
    $("#feedback-area").style.display = "none";
    renderCurrentQuestion();
}

function getCurrentQuestion() {
    // 如果 currentIndex 超出原始题目范围，说明当前是加练/换题的新题
    if (AppState.currentIndex < AppState.questions.length) {
        return AppState.questions[AppState.currentIndex];
    }
    // 从 records 中获取最后一道题的 question（加练/换题场景）
    if (AppState.records.length > 0) {
        return AppState.records[AppState.records.length - 1].question;
    }
    return null;
}

function renderCurrentQuestion() {
    const q = getCurrentQuestion();
    if (!q) return;

    // 进度
    const displayIndex = Math.min(AppState.currentIndex + 1, AppState.baseTotal);
    $("#progress-text").textContent = `第 ${displayIndex} / ${AppState.baseTotal} 题`;
    const pct = Math.min((AppState.currentIndex / AppState.baseTotal) * 100, 100);
    $("#progress-fill").style.width = `${pct}%`;

    // 累计得分
    const totalScore = AppState.records.reduce((sum, r) => {
        return sum + (r.feedback?.score || 0);
    }, 0);
    const avgScore = AppState.records.length > 0
        ? (totalScore / AppState.records.length).toFixed(1)
        : "--";
    $("#progress-score").textContent = AppState.records.length > 0
        ? `均分 ${avgScore} | 已答 ${AppState.records.length}`
        : "";

    // 超纲标签
    if (q.is_extra) {
        show($("#badge-extra"));
        $("#badge-extra").textContent = `📌 拓展（${q.extra_level || "超纲"}）`;
    } else {
        hide($("#badge-extra"));
    }

    // 难度标签
    if (q.difficulty >= 2) {
        show($("#badge-difficulty"));
        const flames = "🔥".repeat(Math.min(q.difficulty, 3));
        $("#badge-difficulty").textContent = `${flames} Lv${q.difficulty}`;
    } else {
        hide($("#badge-difficulty"));
    }

    // 语法点
    $("#grammar-tag").textContent = q.grammar_point || "";

    // 场景
    $("#quiz-scene").textContent = q.scene ? `📖 ${q.scene}` : "";

    // 隐藏作文专属的表达方式
    hide($("#quiz-format"));

    // 中文
    $("#quiz-chinese").textContent = q.chinese || "";

    // 词汇提示
    if (q.hints && q.hints.length > 0) {
        show($("#quiz-hints"));
        $("#hints-content").innerHTML = q.hints
            .map(h => `<span class="hint-item">${h}</span>`)
            .join("");
        $("#hints-content").style.display = "none";
        $("#hints-toggle").textContent = "💡 词汇提示 ▾";
    } else {
        hide($("#quiz-hints"));
    }

    // 清空输入
    $("#answer-input").value = "";
    $("#answer-input").focus();

    // 隐藏反馈
    $("#feedback-area").style.display = "none";

    // 提示收起
    $("#hints-toggle").onclick = () => {
        const content = $("#hints-content");
        const toggle = $("#hints-toggle");
        if (content.style.display === "none") {
            show(content);
            toggle.textContent = "💡 词汇提示 ▴";
        } else {
            hide(content);
            toggle.textContent = "💡 词汇提示 ▾";
        }
    };
}

// 提交答案
async function submitAnswer() {
    const userAnswer = $("#answer-input").value.trim();
    if (!userAnswer) return;

    const q = getCurrentQuestion();
    if (!q) return;

    // 禁用提交按钮
    const btnSubmit = $("#btn-submit");
    btnSubmit.disabled = true;
    btnSubmit.textContent = "批改中...";

    try {
        const result = await api("/api/grade_answer", {
            method: "POST",
            body: JSON.stringify({
                question: q,
                user_answer: userAnswer,
                level: AppState.config.level,
                action: "grade",
            }),
        });

        if (!result.success || !result.feedback) {
            throw new Error("批改失败，请重试");
        }

        // 保存答题记录
        AppState.records.push({
            question: q,
            user_answer: userAnswer,
            feedback: result.feedback,
            timestamp: new Date().toISOString(),
        });

        AppState.totalAnswered++;

        // 显示反馈
        renderFeedback(result.feedback);

        // 保存进度
        await saveProgress();

    } catch (err) {
        alert(`批改失败：${err.message}`);
    } finally {
        btnSubmit.disabled = false;
        btnSubmit.textContent = "提交";
    }
}

function renderFeedback(fb) {
    const area = $("#feedback-area");
    show(area);

    // 得分颜色
    const score = fb.score || 0;
    let scoreClass = "score-low";
    if (score >= 8) scoreClass = "score-high";
    else if (score >= 5) scoreClass = "score-mid";

    let html = `
        <div class="feedback-score">
            <div class="score-number ${scoreClass}">${score.toFixed(1)}</div>
            <div class="score-label">/ 10 分</div>
        </div>
    `;

    // 正确部分
    if (fb.correct_parts && fb.correct_parts.length > 0) {
        html += `<div class="feedback-section">
            <div class="feedback-section-title feedback-correct">✅ 正确的地方</div>`;
        fb.correct_parts.forEach(p => {
            html += `<div class="feedback-item good">${p}</div>`;
        });
        html += `</div>`;
    }

    // 错误部分（区分 ⚠️ 和 ❌）
    if (fb.error_parts && fb.error_parts.length > 0) {
        html += `<div class="feedback-section">
            <div class="feedback-section-title feedback-error">❌ 需要注意的地方</div>`;
        fb.error_parts.forEach(e => {
            const level = e.level || "❌";
            const isWarning = level.includes("⚠");
            const cls = isWarning ? "bad warning" : "bad";
            html += `<div class="feedback-item ${cls}">
                <strong>${level} 错误：</strong>${e.error || ""}<br>
                <strong>正确：</strong>${e.correction || ""}<br>
                <strong>解释：</strong>${e.explanation || ""}
            </div>`;
        });
        html += `</div>`;
    }

    // 修改建议
    if (fb.suggestions) {
        html += `<div class="feedback-section">
            <div class="feedback-section-title feedback-suggestion">💡 更自然的说法</div>
            <div class="feedback-item tip">${fb.suggestions}</div>
        </div>`;
    }

    // 超纲说明
    if (fb.extra_notes) {
        html += `<div class="feedback-section">
            <div class="feedback-section-title" style="color: var(--color-warning);">📌 超纲内容拓展</div>
            <div class="feedback-item extra">${fb.extra_notes}</div>
        </div>`;
    }

    // 鼓励收尾
    if (fb.encouragement) {
        html += `<div class="feedback-section" style="text-align: center; margin-top: var(--space-md);">
            <div class="encouragement-text">${fb.encouragement}</div>
        </div>`;
    }

    $("#feedback-card").innerHTML = html;

    // 操作按钮
    const isGood = score >= 8;
    let actionHtml = "";
    if (isGood) {
        actionHtml = `
            <button class="btn btn-primary" id="btn-harder">加大难度 🔥</button>
            <button class="btn btn-secondary" id="btn-retry-same">修改重答 ✏️</button>
            <button class="btn btn-text" id="btn-next">下一题 →</button>
        `;
    } else {
        actionHtml = `
            <button class="btn btn-primary" id="btn-retry" style="background: var(--color-warning); color: white;">换道同类题再练 🔄</button>
            <button class="btn btn-secondary" id="btn-retry-same">修改重答 ✏️</button>
            <button class="btn btn-text" id="btn-skip">跳过 →</button>
        `;
    }
    $("#feedback-actions").innerHTML = actionHtml;

    // 绑定事件
    if (isGood) {
        $("#btn-harder").onclick = () => handleAction("harder");
        $("#btn-retry-same").onclick = () => retrySameQuestion();
        $("#btn-next").onclick = () => moveToNext();
    } else {
        $("#btn-retry").onclick = () => handleAction("retry");
        $("#btn-retry-same").onclick = () => retrySameQuestion();
        $("#btn-skip").onclick = () => moveToNext();
    }

    // 滚动到反馈
    area.scrollIntoView({ behavior: "smooth", block: "start" });
}

async function handleAction(action) {
    const btnPrimary = $("#feedback-actions").querySelector(".btn-primary");
    btnPrimary.disabled = true;
    btnPrimary.textContent = action === "harder" ? "生成中..." : "换题中...";

    const q = getCurrentQuestion();

    try {
        const result = await api("/api/grade_answer", {
            method: "POST",
            body: JSON.stringify({
                question: q,
                user_answer: "",  // 不需要再批改
                level: AppState.config.level,
                action: action,
            }),
        });

        if (!result.success) {
            throw new Error("操作失败");
        }

        if (result.new_question) {
            // 把新题插入当前位置之后，并前进到新题
            AppState.questions.splice(AppState.currentIndex + 1, 0, result.new_question);
            AppState.currentIndex++;
            AppState.baseTotal++;  // 加练/进阶题也计入总题数，不浪费知识点

            // 显示新题
            $("#feedback-area").style.display = "none";
            renderCurrentQuestion();
        }
    } catch (err) {
        alert(`操作失败：${err.message}`);
    } finally {
        btnPrimary.disabled = false;
        btnPrimary.textContent = action === "harder" ? "加大难度 🔥" : "换道同类题再练 🔄";
    }
}

function retrySameQuestion() {
    // 隐藏反馈，清空输入，让用户修改后重答同一道题
    $("#feedback-area").style.display = "none";
    $("#answer-input").value = "";
    $("#answer-input").focus();
}

function moveToNext() {
    AppState.currentIndex++;

    const baseCompleted = AppState.currentIndex >= AppState.baseTotal;
    const allCompleted = AppState.currentIndex >= AppState.questions.length;

    if (baseCompleted || allCompleted) {
        // 所有题目完成 → 进入终极挑战作文
        startEssay();
    } else {
        // 下一题
        $("#feedback-area").style.display = "none";
        renderCurrentQuestion();
    }
}

// --- 进度保存 ---
async function saveProgress() {
    try {
        await api("/api/progress", {
            method: "POST",
            body: JSON.stringify({
                notes: AppState.notes,
                vocabulary: AppState.vocabulary,
                vocab_used: AppState.vocabUsed,
                level: AppState.config.level,
                questions: AppState.questions,
                current_index: AppState.currentIndex,
                records: AppState.records,
                total_answered: AppState.totalAnswered,
                base_total: AppState.baseTotal,
            }),
        });
    } catch {
        // 静默失败，不影响主流程
    }
}

// --- 恢复进度弹窗 ---
function showResumeModal(progress) {
    showScreen("main"); // 先显示主页作为背景
    show($("#modal-resume"));

    const qCount = progress.questions?.length || 0;
    const answered = progress.records?.length || 0;
    const level = progress.level || "N4";
    $("#resume-info").textContent = `上次在 ${level} 级别练习中完成了 ${answered}/${qCount} 题，是否继续？`;

    $("#btn-resume-yes").onclick = async () => {
        hide($("#modal-resume"));
        AppState.notes = progress.notes || "";
        AppState.vocabulary = progress.vocabulary || "";
        AppState.vocabUsed = progress.vocab_used || [];
        AppState.questions = progress.questions || [];
        AppState.currentIndex = progress.current_index || 0;
        AppState.records = progress.records || [];
        AppState.totalAnswered = progress.total_answered || 0;
        AppState.baseTotal = progress.base_total || AppState.questions.length;
        AppState.config.level = progress.level || AppState.config.level;
        initQuizScreen();
    };

    $("#btn-resume-no").onclick = async () => {
        hide($("#modal-resume"));
        // 清除进度
        try { await api("/api/progress", { method: "DELETE" }); } catch {}
        AppState.records = [];
        AppState.questions = [];
        AppState.currentIndex = 0;
        showMainScreen();
    };
}

// ============================================================
// 屏幕 4：总结
// ============================================================
// ============================================================
// 终极挑战：综合短文翻译
// ============================================================
async function startEssay() {
    showLoading("正在生成终极挑战作文题...");

    // 收集所有涉及的语法点
    const grammarPoints = [];
    const seen = new Set();
    for (const r of AppState.records) {
        const gp = r.question?.grammar_point;
        if (gp && !seen.has(gp)) {
            seen.add(gp);
            grammarPoints.push(gp);
        }
    }
    // 也从未答到的题目中收集
    for (const q of AppState.questions) {
        const gp = q.grammar_point;
        if (gp && !seen.has(gp)) {
            seen.add(gp);
            grammarPoints.push(gp);
        }
    }

    try {
        const result = await api("/api/generate_essay", {
            method: "POST",
            body: JSON.stringify({
                grammar_points: grammarPoints,
                level: AppState.config.level,
                notes: AppState.notes,
            }),
        });

        if (!result.success || !result.data) {
            throw new Error("作文题生成失败");
        }

        AppState.essayQuestion = result.data;
        hideLoading();
        renderEssayQuestion(result.data);
    } catch (err) {
        hideLoading();
        // 如果作文题生成失败，直接跳到总结
        alert(`作文题生成失败，跳过：${err.message}`);
        generateSummary();
    }
}

function renderEssayQuestion(essay) {
    showScreen("quiz");

    // 切换为作文模式
    $("#progress-text").textContent = "🏆 终极挑战：综合短文写作";
    $("#progress-fill").style.width = "100%";
    $("#progress-score").textContent = `覆盖 ${essay.grammar_points_covered?.length || 0} 个语法点`;

    hide($("#badge-extra"));
    hide($("#badge-difficulty"));
    $("#grammar-tag").textContent = "📝 综合作文";

    // 场景
    $("#quiz-scene").textContent = essay.scene ? `📖 ${essay.scene}` : "";

    // 表达方式（作文独有）
    if (essay.format) {
        show($("#quiz-format"));
        $("#quiz-format").textContent = essay.format;
    } else {
        hide($("#quiz-format"));
    }

    // 要写的内容（纯内容，不含框架）
    $("#quiz-chinese").textContent = essay.chinese || "";

    // 词汇提示
    if (essay.hints && essay.hints.length > 0) {
        show($("#quiz-hints"));
        $("#hints-content").innerHTML = essay.hints
            .map(h => `<span class="hint-item">${h}</span>`)
            .join("");
        $("#hints-content").style.display = "none";
        $("#hints-toggle").textContent = "💡 词汇提示 ▾";
    } else {
        hide($("#quiz-hints"));
    }

    // 切换输入区域：隐藏单行，显示多行
    hide($("#answer-area-normal"));
    show($("#answer-area-essay"));
    $("#essay-input").value = "";
    $("#essay-input").focus();

    // 隐藏反馈
    $("#feedback-area").style.display = "none";

    // 提交按钮事件
    $("#btn-essay-submit").onclick = submitEssay;
}

async function submitEssay() {
    const userAnswer = $("#essay-input").value.trim();
    if (!userAnswer) return;

    const btn = $("#btn-essay-submit");
    btn.disabled = true;
    btn.textContent = "批改中...";

    try {
        const result = await api("/api/grade_essay", {
            method: "POST",
            body: JSON.stringify({
                essay_question: AppState.essayQuestion,
                user_answer: userAnswer,
                level: AppState.config.level,
            }),
        });

        if (!result.success || !result.feedback) {
            throw new Error("批改失败");
        }

        // 保存记录
        AppState.records.push({
            question: {
                grammar_point: "综合作文",
                scene: AppState.essayQuestion.scene,
                chinese: AppState.essayQuestion.chinese,
                reference_answer: AppState.essayQuestion.reference_answer,
                is_extra: false,
                extra_level: null,
                difficulty: 4,
            },
            user_answer: userAnswer,
            feedback: result.feedback,
            timestamp: new Date().toISOString(),
            is_essay: true,
        });

        renderEssayFeedback(result.feedback);
    } catch (err) {
        alert(`批改失败：${err.message}`);
    } finally {
        btn.disabled = false;
        btn.textContent = "提交作文";
    }
}

function renderEssayFeedback(fb) {
    const area = $("#feedback-area");
    show(area);

    const score = fb.score || 0;
    let scoreClass = score >= 8 ? "score-high" : (score >= 5 ? "score-mid" : "score-low");

    let html = `
        <div class="feedback-score">
            <div class="score-number ${scoreClass}">${score.toFixed(1)}</div>
            <div class="score-label">/ 10 分（准确性 5 + 流畅度 3 + 丰富度 2）</div>        </div>
    `;

    // 用到的语法点（仅展示，不作为评分依据）
    if (fb.grammar_check && fb.grammar_check.length > 0) {
        html += `<div class="feedback-section">
            <div class="feedback-section-title">📋 你运用到的语法点</div>`;
        fb.grammar_check.forEach(gc => {
            const icon = gc.correct ? "✅" : "⚠️";
            html += `<div class="feedback-item ${gc.correct ? 'good' : 'bad'}">
                ${icon} <strong>${gc.grammar}</strong>：${gc.note}
            </div>`;
        });
        html += `</div>`;
    }

    // 正确部分
    if (fb.correct_parts && fb.correct_parts.length > 0) {
        html += `<div class="feedback-section">
            <div class="feedback-section-title feedback-correct">✅ 做得好的地方</div>`;
        fb.correct_parts.forEach(p => {
            html += `<div class="feedback-item good">${p}</div>`;
        });
        html += `</div>`;
    }

    // 建议
    if (fb.suggestions) {
        html += `<div class="feedback-section">
            <div class="feedback-section-title feedback-suggestion">💡 整体评价</div>
            <div class="feedback-item tip">${fb.suggestions}</div>
        </div>`;
    }

    // 鼓励
    if (fb.encouragement) {
        html += `<div class="feedback-section" style="text-align: center;">
            <div class="encouragement-text">${fb.encouragement}</div>
        </div>`;
    }

    $("#feedback-card").innerHTML = html;

    // 按钮：进入总结
    $("#feedback-actions").innerHTML = `
        <button class="btn btn-primary btn-full" id="btn-goto-summary">📊 查看总结报告 →</button>
    `;
    $("#btn-goto-summary").onclick = generateSummary;

    area.scrollIntoView({ behavior: "smooth", block: "start" });
}

// ============================================================
// 屏幕 4：总结
// ============================================================
async function generateSummary() {
    showLoading("正在生成专属复习笔记...");

    // 清除进度（已完成）
    try { await api("/api/progress", { method: "DELETE" }); } catch {}

    try {
        const result = await api("/api/generate_summary", {
            method: "POST",
            body: JSON.stringify({
                notes: AppState.notes,
                level: AppState.config.level,
                records: AppState.records,
                vocab_used: AppState.vocabUsed,
            }),
        });

        if (!result.success) {
            throw new Error("总结生成失败");
        }

        hideLoading();
        showSummaryScreen(result);

        // 弹出确认：是否保存到知识库
        showSaveLearnedModal();

    } catch (err) {
        hideLoading();
        alert(`生成总结失败：${err.message}`);
    }
}

function showSaveLearnedModal() {
    show($("#modal-save-learned"));

    $("#btn-save-yes").onclick = async () => {
        hide($("#modal-save-learned"));
        showLoading("正在保存...");
        await updateLearnedContent();
        hideLoading();
    };

    $("#btn-save-no").onclick = () => {
        hide($("#modal-save-learned"));
    };
}

async function updateLearnedContent() {
    // 从答题记录中提取语法点和得分
    const items = [];
    const seen = new Set();
    AppState.records.forEach(r => {
        const gp = r.question?.grammar_point;
        if (gp && !seen.has(gp)) {
            seen.add(gp);
            items.push({
                grammar_point: gp,
                level: r.question?.extra_level || AppState.config.level,
                score: r.feedback?.score || 0,
            });
        }
    });

    if (items.length > 0) {
        try {
            await api("/api/learned_content", {
                method: "POST",
                body: JSON.stringify({ items }),
            });
        } catch {
            // 静默失败
        }
    }

    // 同时保存今日单词到词库
    await saveVocabularyToBank();
}

// --- 保存单词到词库 ---
async function saveVocabularyToBank() {
    if (!AppState.vocabulary || !AppState.vocabulary.trim()) return;

    // 解析用户输入的单词文本
    const words = parseVocabularyText(AppState.vocabulary);
    if (words.length === 0) return;

    try {
        await api("/api/vocabulary", {
            method: "POST",
            body: JSON.stringify({ words }),
        });
    } catch {
        // 静默失败
    }
}

// --- 解析单词文本 ---
function parseVocabularyText(text) {
    const lines = text.split('\n').filter(l => l.trim());
    const words = [];

    for (const line of lines) {
        // 支持格式：日语 / 读音 / 中文意思 / 词性
        const parts = line.split('/').map(p => p.trim());
        if (parts.length >= 1 && parts[0]) {
            words.push({
                word: parts[0],
                reading: parts[1] || "",
                meaning: parts[2] || "",
                pos: parts[3] || "",
            });
        }
    }

    return words;
}

function showSummaryScreen(result) {
    showScreen("summary");

    // 统计
    const scores = AppState.records.map(r => r.feedback?.score || 0);
    const avg = scores.length > 0
        ? (scores.reduce((a, b) => a + b, 0) / scores.length).toFixed(1)
        : "0";
    const high = scores.filter(s => s >= 8).length;
    const low = scores.filter(s => s < 5).length;

    let vocabUsedHtml = "";
    if (AppState.vocabUsed && AppState.vocabUsed.length > 0) {
        vocabUsedHtml = `
            <div class="stat-item" style="flex: 2;">
                <div class="stat-label" style="font-size:12px;">📝 用到的新单词</div>
                <div style="font-size:14px; color: var(--text-primary); margin-top: 4px; line-height: 1.6;">
                    ${AppState.vocabUsed.map(w => `<span style="background: var(--color-primary-light); padding: 2px 8px; border-radius: 999px; margin: 2px; display: inline-block;">${w}</span>`).join(' ')}
                </div>
            </div>
        `;
    }

    $("#stats-card").innerHTML = `
        <div class="stat-item">
            <div class="stat-value">${AppState.records.length}</div>
            <div class="stat-label">总答题数</div>
        </div>
        <div class="stat-item">
            <div class="stat-value">${avg}</div>
            <div class="stat-label">平均分</div>
        </div>
        <div class="stat-item">
            <div class="stat-value">${high}</div>
            <div class="stat-label">高分题</div>
        </div>
        <div class="stat-item">
            <div class="stat-value">${low}</div>
            <div class="stat-label">需加强</div>
        </div>
        ${vocabUsedHtml}
    `;

    // Markdown 预览
    $("#markdown-preview").innerHTML = renderMarkdown(result.markdown || "");

    // 下载按钮
    const date = result.date || new Date().toISOString().slice(0, 10);
    $("#btn-download").onclick = () => {
        window.open(`/api/download/${date}`, "_blank");
    };

    // 再来一轮
    $("#btn-new-round").onclick = () => {
        AppState.records = [];
        AppState.questions = [];
        AppState.currentIndex = 0;
        AppState.totalAnswered = 0;
        AppState.baseTotal = 0;
        AppState.vocabUsed = [];
        showMainScreen();
    };
}

// ============================================================
// 屏幕 5 & 6：历史记录
// ============================================================
async function initHistoryScreen() {
    showLoading("加载历史记录...");

    try {
        const result = await api("/api/history");
        hideLoading();
        showScreen("history");

        const list = $("#history-list");
        const empty = $("#history-empty");

        if (!result.files || result.files.length === 0) {
            list.innerHTML = "";
            show(empty);
        } else {
            hide(empty);
            list.innerHTML = result.files.map(f => `
                <div class="history-item" data-date="${f.date}">
                    <div class="history-item-info">
                        <span class="history-item-date">📅 ${f.date}</span>
                        <span class="history-item-meta">${f.level} | ${f.record_count} 题</span>
                    </div>
                    <span class="history-item-arrow">→</span>
                </div>
            `).join("");

            // 点击查看详情
            $$(".history-item").forEach(item => {
                item.onclick = () => {
                    const date = item.dataset.date;
                    showHistoryDetail(date);
                };
            });
        }
    } catch (err) {
        hideLoading();
        alert(`加载历史失败：${err.message}`);
    }

    $("#btn-history-back").onclick = showMainScreen;
}

async function showHistoryDetail(date) {
    showLoading("加载记录...");

    try {
        const result = await api(`/api/history/${date}`);
        hideLoading();

        if (!result.success) {
            throw new Error("加载失败");
        }

        AppState.historyDate = date;
        showScreen("history-detail");

        const data = result.data;
        $("#detail-title").textContent = `${date} 练习记录`;

        // 如果保存了 markdown 内容，尝试加载
        if (data.summary_md) {
            try {
                // 加载 markdown 文件内容
                const mdResult = await fetch(`/api/download/${date}`);
                if (mdResult.ok) {
                    const mdText = await mdResult.text();
                    $("#detail-preview").innerHTML = renderMarkdown(mdText);
                } else {
                    showRecordFallback(data);
                }
            } catch {
                showRecordFallback(data);
            }
        } else {
            showRecordFallback(data);
        }

        $("#btn-detail-download").onclick = () => {
            window.open(`/api/download/${date}`, "_blank");
        };
    } catch (err) {
        hideLoading();
        alert(`加载详情失败：${err.message}`);
    }

    $("#btn-detail-back").onclick = initHistoryScreen;
}

function showRecordFallback(data) {
    const records = data.records || [];
    let html = `<h2>答题记录 (${records.length} 题)</h2>`;
    records.forEach((r, i) => {
        const q = r.question || {};
        const fb = r.feedback || {};
        html += `
            <h3>第 ${i + 1} 题</h3>
            <p><strong>语法点：</strong>${q.grammar_point || ""}</p>
            <p><strong>中文：</strong>${q.chinese || ""}</p>
            <p><strong>你的答案：</strong>${r.user_answer || ""}</p>
            <p><strong>参考答案：</strong>${q.reference_answer || ""}</p>
            <p><strong>得分：</strong>${fb.score || "N/A"} / 10</p>
            <hr>
        `;
    });
    $("#detail-preview").innerHTML = html;
}

// ============================================================
// 初始化
// ============================================================
function init() {
    // 提交按钮
    $("#btn-submit").onclick = submitAnswer;

    // 回车提交
    $("#answer-input").onkeydown = (e) => {
        if (e.key === "Enter" && !$("#btn-submit").disabled) {
            submitAnswer();
        }
    };

    // 启动：先显示使用指南
    initGuideScreen();
}

// 页面加载完成后启动
document.addEventListener("DOMContentLoaded", init);
