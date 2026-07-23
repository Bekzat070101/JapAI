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
    setDockActive("main");
    setDockActive("main");

    // 加载教材列表
    loadTextbookOptions();

    // 检查今日复习
    loadReviewStatus();

    // 加载迷你打卡卡片
    loadCheckinMini();

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

    // 错题本
    $("#btn-goto-wrong").onclick = initWrongBookScreen;

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
            body: JSON.stringify({ notes, level, vocabulary: vocabText, textbook_vocab: currentBookVocab }),
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

    // 步骤圆点
    const steps = $("#quiz-steps");
    if (steps && AppState.baseTotal > 0) {
        let dots = "";
        for (let i = 0; i < AppState.baseTotal; i++) {
            let cls = "quiz-step-dot";
            if (i < AppState.currentIndex) cls += " done";
            if (i === AppState.currentIndex) cls += " current";
            dots += `<span class="${cls}"></span>`;
        }
        steps.innerHTML = dots;
    }

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

    // 关闭反馈面板
    const fbPanel = $("#feedback-area"); if (fbPanel) fbPanel.style.display = "none";

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

    // 给新渲染的卡片加发光
    if (typeof initBorderGlowCards === 'function') {
        setTimeout(initBorderGlowCards, 100);
    }
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

        // 自动收录错题
        const fb = result.feedback;
        if (fb.score < 5 || (fb.error_parts && fb.error_parts.some(e => (e.level || "").includes("❌")))) {
            await collectWrongAnswer(q, userAnswer, fb);
        }

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

    // 显示反馈
    area.style.display = "";
    area.style.animation = "none";
    area.offsetHeight; // reflow
    area.style.animation = "feedbackReveal 0.4s cubic-bezier(0.34, 1.56, 0.64, 1)";
    refreshIcons();
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
            AppState.baseTotal++;

            const fb = $("#feedback-area"); if (fb) fb.style.display = "none";
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
    const fb = $("#feedback-area"); if (fb) fb.style.display = "none";
    $("#answer-input").value = "";
    $("#answer-input").focus();
}

function moveToNext() {
    AppState.currentIndex++;

    const fb = $("#feedback-area"); if (fb) fb.style.display = "none";
    const baseCompleted = AppState.currentIndex >= AppState.baseTotal;
    const allCompleted = AppState.currentIndex >= AppState.questions.length;

    if (baseCompleted || allCompleted) {
        startEssay();
    } else {
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
    const steps = $("#quiz-steps");
    if (steps) steps.innerHTML = '<span class="quiz-step-dot current" style="width:14px;height:14px;box-shadow:0 0 0 4px rgba(13,148,136,0.2)"></span>';
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

    // 关闭反馈面板
    const fbPanel = $("#feedback-area"); if (fbPanel) fbPanel.style.display = "none";

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

    area.style.display = "";
    area.style.animation = "none"; area.offsetHeight;
    area.style.animation = "feedbackReveal 0.4s cubic-bezier(0.34, 1.56, 0.64, 1)";
    refreshIcons();
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
            <div class="stat-card wide">
                <div class="stat-label" style="font-size:12px;">📝 用到的新单词</div>
                <div style="font-size:14px; color: var(--text-primary); margin-top: 4px; line-height: 1.6;">
                    ${AppState.vocabUsed.map(w => `<span style="background: var(--color-primary-light); padding: 2px 8px; border-radius: 999px; margin: 2px; display: inline-block;">${w}</span>`).join(' ')}
                </div>
            </div>
        `;
    }

    $("#stats-card").innerHTML = `
        <div class="stat-card">
            <div class="stat-value">${AppState.records.length}</div>
            <div class="stat-label">总答题数</div>
        </div>
        <div class="stat-card">
            <div class="stat-value">${avg}</div>
            <div class="stat-label">平均分</div>
        </div>
        <div class="stat-card">
            <div class="stat-value">${high}</div>
            <div class="stat-label">高分题</div>
        </div>
        <div class="stat-card">
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

    $("#btn-history-back").onclick = showProfileScreen;
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
// Lucide 图标刷新
// ============================================================
function refreshIcons() {
    if (typeof lucide !== "undefined") lucide.createIcons();
}

// ============================================================
// 复习状态
// ============================================================
let reviewStatusEl = null;

async function loadReviewStatus() {
    try {
        const data = await api("/api/review_due");
        const dueCount = (data.due || []).length;
        const totalCount = data.total || 0;
        const bar = $("#review-status-bar");
        const inner = $("#review-card-inner");
        if (!bar || !inner) return;

        if (dueCount > 0) {
            // 列出前 3 个到期语法点
            const topItems = (data.due || []).slice(0, 3);
            const itemTags = topItems.map(i =>
                `<span class="review-tag">${i.grammar_point}<span class="review-tag-stage">第${i.review_stage || 1}轮</span></span>`
            ).join("");

            inner.innerHTML = `
                <div class="review-card-top">
                    <div class="review-card-icon"><i data-lucide="brain" style="width:22px;height:22px"></i></div>
                    <div class="review-card-text">
                        <strong>${dueCount} 个语法点待复习</strong>
                        <span>艾宾浩斯记忆系统提醒你巩固（共学习 ${totalCount} 个）</span>
                    </div>
                </div>
                <div class="review-card-tags">${itemTags}${dueCount > 3 ? `<span class="review-tag-more">+${dueCount - 3} 个</span>` : ""}</div>
                <button class="btn btn-primary btn-sm" id="btn-start-review"><i data-lucide="rocket" style="width:14px;height:14px"></i> 开始复习</button>
            `;
            bar.style.display = "";
            refreshIcons();

            $("#btn-start-review").onclick = async () => {
                showLoading("正在生成复习题目...");
                try {
                    // 收集到期语法点，生成复习题
                    const grammarPoints = (data.due || []).map(i => i.grammar_point);
                    const result = await api("/api/generate_questions", {
                        method: "POST",
                        body: JSON.stringify({
                            notes: grammarPoints.map(g => `复习：${g}`).join("\n"),
                            level: AppState.config.level,
                            vocabulary: "",
                            textbook_vocab: [],
                        }),
                    });
                    if (!result.success || !result.data) throw new Error("生成失败");
                    AppState.notes = `复习：${grammarPoints.join("、")}`;
                    AppState.vocabulary = "";
                    AppState.questions = result.data.questions || [];
                    AppState.vocabUsed = result.data.vocab_used || [];
                    AppState.currentIndex = 0; AppState.records = [];
                    AppState.totalAnswered = 0; AppState.baseTotal = AppState.questions.length;
                    hideLoading(); initQuizScreen();
                } catch (err) { hideLoading(); alert(`复习题目生成失败：${err.message}`); }
            };
        } else if (totalCount > 0) {
            inner.innerHTML = `
                <div class="review-card-top">
                    <div class="review-card-icon done"><i data-lucide="check-circle" style="width:22px;height:22px"></i></div>
                    <div class="review-card-text">
                        <strong>全部已掌握</strong>
                        <span>已学习 ${totalCount} 个语法点，暂无到期复习项</span>
                    </div>
                </div>
            `;
            bar.style.display = "";
        } else {
            bar.style.display = "none";
        }
        refreshIcons();
    } catch { /* 静默 */ }
}

// ============================================================
// 教材选择
// ============================================================
let textbookData = {};
let currentBookVocab = [];

async function loadTextbookOptions() {
    try {
        const data = await api("/api/knowledge_base");
        const select = $("#textbook-select");
        if (!select) return;
        select.innerHTML = '<option value="">自由模式（不使用教材）</option><option disabled>──── 教材适配即将推出 ────</option>';
        for (const tb of data.textbooks || [])
            for (const vol of tb.volumes || []) {
                const opt = document.createElement("option");
                opt.value = vol.id; opt.textContent = `${tb.name} ${vol.name}（${vol.level}）🔒 敬请期待后续更新`;
                opt.disabled = true;
                select.appendChild(opt);
            }
        select.onchange = async () => {
            const volId = select.value;
            const lessonSelect = $("#lesson-select");
            if (!volId) { lessonSelect.style.display = "none"; currentBookVocab = []; return; }
            if (!textbookData[volId]) {
                try { textbookData[volId] = await api(`/api/knowledge_base/${volId}`); }
                catch { textbookData[volId] = { lessons: [] }; }
            }
            const lessons = textbookData[volId].lessons || [];
            lessonSelect.innerHTML = '<option value="0">全部课程</option>';
            lessons.forEach(l => { const o = document.createElement("option"); o.value = l.lesson; o.textContent = `第${l.lesson}课 — ${l.title}`; lessonSelect.appendChild(o); });
            lessonSelect.style.display = "";
            updateCurrentBookVocab(volId, 0);
        };
        const lessonSelect = $("#lesson-select");
        lessonSelect.onchange = () => { const volId = $("#textbook-select").value; updateCurrentBookVocab(volId, parseInt(lessonSelect.value)); };
    } catch { /* 静默 */ }
}

function updateCurrentBookVocab(volId, lessonNo) {
    const data = textbookData[volId]; if (!data) return;
    const lessons = data.lessons || []; let vocab = [];
    if (lessonNo === 0) for (const l of lessons) vocab = vocab.concat(l.vocabulary || []);
    else { const lesson = lessons.find(l => l.lesson === lessonNo); if (lesson) vocab = lesson.vocabulary || []; }
    currentBookVocab = vocab;
    const hint = $("#textbook-hint");
    if (hint) hint.textContent = vocab.length > 0 ? `已加载 ${vocab.length} 个教材单词，出题将限制在此范围内` : "选课后自动加载教材单词和语法点，出题不超纲";
}

// ============================================================
// 错题本
// ============================================================
async function collectWrongAnswer(question, userAnswer, feedback) {
    const errorTypes = [];
    if (feedback.error_parts) feedback.error_parts.forEach(e => {
        if ((e.level || "").includes("❌")) errorTypes.push("核心错误");
        else if ((e.level || "").includes("⚠")) errorTypes.push("小问题");
    });
    const item = { id: Date.now(), grammar_point: question.grammar_point || "", question: question, user_answer: userAnswer, feedback: feedback, score: feedback.score || 0, error_types: errorTypes, added_at: new Date().toISOString().slice(0, 10), reviewed_count: 0, last_reviewed: null, mastered: false };
    try { await api("/api/wrong_book", { method: "POST", body: JSON.stringify({ items: [item] }) }); } catch { /* 静默 */ }
}

async function initWrongBookScreen() {
    showLoading("加载错题本...");
    try {
        const result = await api("/api/wrong_book"); hideLoading(); showScreen("wrong-book");
        const items = result.items || [];
        if (items.length === 0) { $("#wrong-list").innerHTML = ""; show($("#wrong-empty")); hide($("#wrong-stats")); }
        else {
            hide($("#wrong-empty"));

            // 按语法点分组
            const groups = new Map();
            for (const item of items) {
                const gp = item.grammar_point || "综合";
                if (!groups.has(gp)) groups.set(gp, []);
                groups.get(gp).push(item);
            }

            const totalGroups = groups.size;
            const totalItems = items.length;
            const activeGroups = [...groups.values()].filter(g => g.some(i => !i.mastered)).length;
            const activeItems = items.filter(i => !i.mastered).length;
            $("#wrong-stats").innerHTML = `共 <strong>${totalGroups}</strong> 个语法点（<strong>${totalItems}</strong> 题），未掌握 <strong>${activeGroups}</strong> 个${activeItems > 0 ? `，已掌握 ${totalItems - activeItems} 题` : ""}`;
            show($("#wrong-stats"));

            let html = "";
            for (const [grammar, groupItems] of groups) {
                const avgScore = (groupItems.reduce((s, i) => s + (i.score || 0), 0) / groupItems.length).toFixed(1);
                const allMastered = groupItems.every(i => i.mastered);
                const errorTypes = [...new Set(groupItems.flatMap(i => i.error_types || []))];

                html += `<div class="wrong-group${allMastered ? " wrong-group-mastered" : ""}">
                    <div class="wrong-group-header">
                        <div class="wrong-group-info">
                            <span class="wrong-group-grammar">${grammar}</span>
                            <span class="wrong-group-meta">${groupItems.length} 题 · 均分 ${avgScore}</span>
                            ${errorTypes.length > 0 ? `<span class="wrong-group-errors">${errorTypes.join(" · ")}</span>` : ""}
                        </div>
                        <i data-lucide="chevron-down" style="width:16px;height:16px;color:var(--text-tertiary);transition:transform 0.25s"></i>
                    </div>
                    <div class="wrong-group-body" style="display:none">`;

                for (const item of groupItems) {
                    const sc = item.score >= 5 ? "mid" : "low";
                    html += `<div class="wrong-item${item.mastered ? " wrong-item-mastered" : ""}" data-id="${item.id}">
                        <div class="wrong-item-header">
                            <span class="wrong-item-date">${item.added_at}</span>
                            <span class="wrong-item-score ${sc}">${item.score}分</span>
                        </div>
                        <div class="wrong-item-preview">${item.error_types.length > 0 ? "错误类型：" + item.error_types.join("、") : (item.feedback?.suggestions || "").slice(0, 50)}</div>
                    </div>`;
                }

                html += `</div></div>`;
            }
            $("#wrong-list").innerHTML = html;
            refreshIcons();

            // 点击组头展开/折叠
            $$(".wrong-group-header").forEach(header => {
                header.onclick = () => {
                    const group = header.closest(".wrong-group");
                    const body = group.querySelector(".wrong-group-body");
                    const icon = header.querySelector("i");
                    const isOpen = body.style.display !== "none";
                    body.style.display = isOpen ? "none" : "";
                    if (icon) icon.style.transform = isOpen ? "" : "rotate(180deg)";
                };
            });

            // 点击具体错题查看详情
            $$(".wrong-item").forEach(el => {
                el.onclick = (e) => {
                    e.stopPropagation();
                    const id = parseInt(el.dataset.id);
                    const item = items.find(i => i.id === id);
                    if (item) showWrongDetail(item);
                };
            });
        }
    } catch (err) { hideLoading(); alert(`加载失败：${err.message}`); }
    $("#btn-wrong-back").onclick = showProfileScreen;
}

function showWrongDetail(item) {
    showScreen("wrong-book"); hide($("#wrong-list")); hide($("#wrong-stats")); hide($("#wrong-empty"));
    const fb = item.feedback || {}; const errors = fb.error_parts || [];
    const errorHtml = errors.length > 0 ? errors.map(e => `<div class="wrong-detail-text error"><strong>${e.level || ""} ${e.error || ""}</strong><br>正确：${e.correction || ""}<br>${e.explanation || ""}</div>`).join("") : "<p>暂无详细错误信息</p>";
    const correctHtml = (fb.correct_parts || []).length > 0 ? fb.correct_parts.map(c => `<div class="wrong-detail-text correct">${c}</div>`).join("") : "";
    const html = `<div class="wrong-detail">
        <div class="wrong-detail-section"><div class="wrong-detail-label">📖 原题</div><div class="wrong-detail-text">${item.question?.chinese || ""}</div></div>
        <div class="wrong-detail-section"><div class="wrong-detail-label">✏️ 你的答案</div><div class="wrong-detail-text error">${item.user_answer || ""}</div></div>
        <div class="wrong-detail-section"><div class="wrong-detail-label">✅ 参考答案</div><div class="wrong-detail-text correct">${item.question?.reference_answer || ""}</div></div>
        ${correctHtml ? `<div class="wrong-detail-section"><div class="wrong-detail-label">✅ 做得对的地方</div>${correctHtml}</div>` : ""}
        <div class="wrong-detail-section"><div class="wrong-detail-label">❌ 需要注意</div>${errorHtml}</div>
        ${fb.suggestions ? `<div class="wrong-detail-section"><div class="wrong-detail-label">💡 建议</div><div class="wrong-detail-text">${fb.suggestions}</div></div>` : ""}
    </div>
    <div class="wrong-actions">
        <button class="btn btn-primary" id="btn-wrong-retry">🔄 重新练习</button>
        <button class="btn btn-secondary" id="btn-wrong-mastered">✅ 标记已掌握</button>
        <button class="btn btn-text" id="btn-wrong-back-list">← 返回列表</button>
    </div>`;
    const container = document.createElement("div"); container.id = "wrong-detail-container"; container.innerHTML = html;
    const wrongScreen = $("#screen-wrong-book"); if (wrongScreen) wrongScreen.appendChild(container);
    $("#btn-wrong-retry").onclick = () => rePracticeWrong(item);
    $("#btn-wrong-mastered").onclick = () => markWrongMastered(item);
    $("#btn-wrong-back-list").onclick = () => { const dc = $("#wrong-detail-container"); if (dc) dc.remove(); show($("#wrong-list")); initWrongBookScreen(); };
}

async function rePracticeWrong(item) {
    const dc = $("#wrong-detail-container"); if (dc) dc.remove();
    showLoading("正在生成练习题目...");
    try {
        const result = await api("/api/grade_answer", { method: "POST", body: JSON.stringify({ question: { grammar_point: item.grammar_point }, user_answer: "", level: AppState.config.level, action: "retry" }) });
        if (!result.success || !result.new_question) throw new Error("生成失败");
        await api("/api/wrong_book", { method: "POST", body: JSON.stringify({ items: [{ id: item.id, reviewed_count: (item.reviewed_count || 0) + 1, last_reviewed: new Date().toISOString().slice(0, 10) }] }) });
        hideLoading(); AppState.questions = [result.new_question]; AppState.currentIndex = 0; AppState.records = []; AppState.totalAnswered = 0; AppState.baseTotal = 1;
        initQuizScreen();
    } catch (err) { hideLoading(); alert(`生成失败：${err.message}`); }
}

async function markWrongMastered(item) {
    await api("/api/wrong_book", { method: "POST", body: JSON.stringify({ items: [{ id: item.id, mastered: true }] }) });
    const dc = $("#wrong-detail-container"); if (dc) dc.remove(); show($("#wrong-list")); initWrongBookScreen();
}

// ============================================================
// 初始化
// ============================================================
let clickSparkInstance = null;

function init() {
    // 提交按钮
    $("#btn-submit").onclick = submitAnswer;

    // 回车提交
    $("#answer-input").onkeydown = (e) => {
        if (e.key === "Enter" && !$("#btn-submit").disabled) {
            submitAnswer();
        }
    };

    // 答题页面返回按钮
    const quizBack = $("#btn-quiz-back");
    if (quizBack) quizBack.onclick = showMainScreen;

    // ====== ReactBits 动效 ======
    // ClickSpark — 全局点击火花
    if (typeof createClickSpark === 'function') {
        clickSparkInstance = createClickSpark({
            sparkColor: getComputedStyle(document.documentElement).getPropertyValue('--color-primary').trim() || '#0D9488',
            sparkCount: 6,
            sparkRadius: 18,
            duration: 350,
        });
    }

    // 所有按钮加弹簧按压
    document.addEventListener('click', e => {
        const btn = e.target.closest('.btn');
        if (btn && typeof springPress === 'function') {
            springPress(btn);
        }
    });

    // 启动
    initGuideScreen();
}

// ============================================================
// Dock 导航栏
// ============================================================
function setDockActive(screen) {
    document.querySelectorAll('.dock-item').forEach(item => {
        item.classList.toggle('active', item.dataset.screen === screen);
    });
}

function initDock() {
    const panel = $("#dock-panel");
    if (!panel) return;

    const items = panel.querySelectorAll('.dock-item');
    const baseSize = 48;
    const maxSize = 68;
    const distance = 120;

    panel.addEventListener('mousemove', e => {
        const panelRect = panel.getBoundingClientRect();
        const mouseX = e.clientX;

        items.forEach(item => {
            const rect = item.getBoundingClientRect();
            const itemCenter = rect.left + rect.width / 2;
            const dist = Math.abs(mouseX - itemCenter);
            const scale = dist < distance
                ? baseSize + (maxSize - baseSize) * Math.pow(1 - dist / distance, 2)
                : baseSize;
            item.style.width = scale + 'px';
            item.style.height = scale + 'px';
        });
    });

    panel.addEventListener('mouseleave', () => {
        items.forEach(item => {
            item.style.width = baseSize + 'px';
            item.style.height = baseSize + 'px';
        });
    });

    // 点击导航
    items.forEach(item => {
        item.addEventListener('click', () => {
            const screen = item.dataset.screen;
            switch (screen) {
                case 'guide':
                    // 直接显示引导页，不检查 API Key
                    showScreen("guide");
                    setDockActive("guide");
                    setDockActive("guide");
                    $("#btn-guide-start").onclick = () => initSetupScreen();
                    break;
                case 'main': showMainScreen(); break;
                case 'settings': showSettingsScreen(); break;
                case 'profile': showProfileScreen(); break;
            }
            // 更新激活状态
            items.forEach(i => i.classList.remove('active'));
            item.classList.add('active');
        });
    });
}

// 设置页面
function showSettingsScreen() {
    showScreen("setup");

    // 先设置 hero 区域（不在 card 内，始终安全）
    $(".setup-icon-wrap").innerHTML = '<i data-lucide="settings" style="width:40px;height:40px"></i>';
    $(".setup-hero h1").textContent = "设置";
    $(".setup-desc").textContent = "";

    // 替换 card 内容（先替换，再操作，避免访问已销毁元素）
    const card = $(".setup-card");
    card.innerHTML = `
        <div class="settings-list">
            <div class="settings-item">
                <div class="settings-item-info">
                    <div class="settings-item-title"><i data-lucide="sun-moon" style="width:18px;height:18px"></i> 显示模式</div>
                </div>
                <div class="theme-toggle">
                    <button class="theme-option" data-theme-val="light">☀️ 浅色</button>
                    <button class="theme-option" data-theme-val="auto">🔄 自动</button>
                    <button class="theme-option" data-theme-val="dark">🌙 深色</button>
                </div>
            </div>
            <div class="settings-item">
                <div class="settings-item-info">
                    <div class="settings-item-title"><i data-lucide="trash-2" style="width:18px;height:18px"></i> 清除数据</div>
                    <div class="settings-item-desc">清除 API Key、答题进度、知识库等所有本地数据</div>
                </div>
                <button class="btn btn-secondary btn-sm" id="btn-clear-data">清除</button>
            </div>
            <div class="settings-item clickable" id="settings-privacy">
                <div class="settings-item-info">
                    <div class="settings-item-title"><i data-lucide="shield" style="width:18px;height:18px"></i> 隐私政策</div>
                    <div class="settings-item-desc">了解我们如何保护你的数据</div>
                </div>
                <i data-lucide="chevron-right" style="width:16px;height:16px;color:var(--text-tertiary)"></i>
            </div>
            <div class="settings-item clickable" id="settings-guide">
                <div class="settings-item-info">
                    <div class="settings-item-title"><i data-lucide="book-open" style="width:18px;height:18px"></i> 使用说明</div>
                    <div class="settings-item-desc">快速上手 JapAI 的使用流程</div>
                </div>
                <i data-lucide="chevron-right" style="width:16px;height:16px;color:var(--text-tertiary)"></i>
            </div>
            <div class="settings-item clickable" id="settings-roadmap">
                <div class="settings-item-info">
                    <div class="settings-item-title"><i data-lucide="map" style="width:18px;height:18px"></i> 开发路线图</div>
                    <div class="settings-item-desc">查看未来版本的开发计划</div>
                </div>
                <i data-lucide="chevron-right" style="width:16px;height:16px;color:var(--text-tertiary)"></i>
            </div>
        </div>
    `;
    refreshIcons();

    // 主题切换按钮
    const currentTheme = getTheme();
    document.querySelectorAll('.theme-option').forEach(btn => {
        if (btn.dataset.themeVal === currentTheme) btn.classList.add('active');
        btn.onclick = () => {
            setTheme(btn.dataset.themeVal);
            document.querySelectorAll('.theme-option').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
        };
    });

    // 清除数据按钮
    const clearBtn = $("#btn-clear-data");
    if (clearBtn) {
        clearBtn.onclick = async () => {
            if (confirm("确定要清除所有本地数据吗？此操作不可撤销。")) {
                try {
                    await api("/api/progress", { method: "DELETE" });
                    for (const f of ["config.json","learned_content.json","vocabulary.json","wrong_book.json"]) {
                        try { await fetch(`/api/config`, { method: "POST", body: JSON.stringify({ api_key: "" }) }); } catch {}
                    }
                    alert("数据已清除。软件将返回初始状态。");
                    location.reload();
                } catch { alert("清除失败"); }
            }
        };
    }

    // 隐私政策
    const privacyBtn = $("#settings-privacy");
    if (privacyBtn) privacyBtn.onclick = showPrivacyScreen;

    // 使用说明
    const guideBtn = $("#settings-guide");
    if (guideBtn) guideBtn.onclick = showGuideModal;

    // 开发路线图
    const roadmapBtn = $("#settings-roadmap");
    if (roadmapBtn) roadmapBtn.onclick = showRoadmapModal;

    // 返回按钮（不在 card 内，始终安全）
    const skipBtn = $("#btn-skip-setup");
    if (skipBtn) {
        skipBtn.style.display = "";
        skipBtn.textContent = "← 返回";
        skipBtn.onclick = showMainScreen;
    }
}

// 个人页面
function showProfileScreen() {
    showScreen("setup");

    // 先设置 hero 区域（不在 card 内，始终安全）
    $(".setup-icon-wrap").innerHTML = '<i data-lucide="user" style="width:40px;height:40px"></i>';
    $(".setup-hero h1").textContent = "个人";
    $(".setup-desc").textContent = "";

    // 替换 card 内容（先替换，再操作，避免访问已销毁元素）
    const card = $(".setup-card");
    card.innerHTML = `
        <!-- 打卡日历 -->
        <div class="checkin-calendar" id="checkin-calendar">
            <div class="checkin-cal-header">
                <div class="checkin-stats-row">
                    <div class="checkin-stat-badge">
                        <i data-lucide="flame" style="width:22px;height:22px;color:var(--color-warning)"></i>
                        <div class="checkin-stat-info">
                            <span class="checkin-stat-num" id="cal-streak-num">--</span>
                            <span class="checkin-stat-label">连续学习</span>
                        </div>
                    </div>
                    <div class="checkin-stat-badge">
                        <i data-lucide="calendar-check" style="width:22px;height:22px;color:var(--color-primary)"></i>
                        <div class="checkin-stat-info">
                            <span class="checkin-stat-num" id="cal-month-num">--</span>
                            <span class="checkin-stat-label">本月累计</span>
                        </div>
                    </div>
                </div>
                <div class="checkin-month-nav">
                    <button class="checkin-nav-btn" id="cal-prev-month"><i data-lucide="chevron-left" style="width:16px;height:16px"></i></button>
                    <span class="checkin-month-label" id="cal-month-label">2026年7月</span>
                    <button class="checkin-nav-btn" id="cal-next-month"><i data-lucide="chevron-right" style="width:16px;height:16px"></i></button>
                </div>
            </div>
            <div class="checkin-weekdays">
                <span>日</span><span>一</span><span>二</span><span>三</span><span>四</span><span>五</span><span>六</span>
            </div>
            <div class="checkin-grid" id="checkin-grid"></div>
        </div>

        <!-- 复习计划 -->
        <div class="review-plan" id="review-plan">
            <div class="review-plan-header">
                <i data-lucide="brain" style="width:18px;height:18px;color:var(--color-primary)"></i>
                <span>复习计划</span>
                <span class="review-plan-badge" id="review-plan-badge" style="display:none"></span>
            </div>
            <div class="review-plan-list" id="review-plan-list">
                <p class="review-plan-empty">加载中...</p>
            </div>
        </div>

        <div style="border-top: 1px solid var(--border-light); margin: var(--space-lg) 0;"></div>

        <div class="settings-list">
            <div class="settings-item clickable" id="profile-wrong">
                <div class="settings-item-info">
                    <div class="settings-item-title"><i data-lucide="edit-3" style="width:18px;height:18px"></i> 错题本</div>
                    <div class="settings-item-desc">查看和复习做错的题目</div>
                </div>
                <i data-lucide="chevron-right" style="width:16px;height:16px;color:var(--text-tertiary)"></i>
            </div>
            <div class="settings-item clickable" id="profile-history">
                <div class="settings-item-info">
                    <div class="settings-item-title"><i data-lucide="clipboard-list" style="width:18px;height:18px"></i> 历史记录</div>
                    <div class="settings-item-desc">查看过往练习记录</div>
                </div>
                <i data-lucide="chevron-right" style="width:16px;height:16px;color:var(--text-tertiary)"></i>
            </div>
        </div>
    `;
    refreshIcons();

    // 加载打卡数据并渲染日历
    renderCheckinCalendar();

    // 加载复习计划
    loadReviewPlan();

    $("#profile-wrong").onclick = initWrongBookScreen;
    $("#profile-history").onclick = initHistoryScreen;

    // 返回按钮（不在 card 内，始终安全）
    const skipBtn = $("#btn-skip-setup");
    if (skipBtn) {
        skipBtn.style.display = "";
        skipBtn.textContent = "← 返回";
        skipBtn.onclick = showMainScreen;
    }
}

// 隐私政策弹窗
function showPrivacyScreen() {
    show($("#modal-privacy"));
    refreshIcons();
    $("#btn-privacy-close").onclick = () => hide($("#modal-privacy"));
    // 点击遮罩关闭
    $("#modal-privacy").onclick = (e) => {
        if (e.target === $("#modal-privacy")) hide($("#modal-privacy"));
    };
}

// 使用说明弹窗
function showGuideModal() {
    show($("#modal-guide"));
    refreshIcons();
    $("#btn-guide-close").onclick = () => hide($("#modal-guide"));
    $("#modal-guide").onclick = (e) => {
        if (e.target === $("#modal-guide")) hide($("#modal-guide"));
    };
}

// 开发路线图弹窗
function showRoadmapModal() {
    show($("#modal-roadmap"));
    refreshIcons();
    $("#btn-roadmap-close").onclick = () => hide($("#modal-roadmap"));
    $("#modal-roadmap").onclick = (e) => {
        if (e.target === $("#modal-roadmap")) hide($("#modal-roadmap"));
    };
}

// ============================================================
// 打卡记录
// ============================================================
let checkinData = null;
let calYear = new Date().getFullYear();
let calMonth = new Date().getMonth() + 1; // 0-based → 1-based

async function loadCheckinData() {
    try {
        checkinData = await api("/api/checkin");
    } catch {
        checkinData = { dates: [], streak: 0, monthly_count: 0, monthly_dates: [] };
    }
    return checkinData;
}

// 主页右侧迷你打卡卡片
async function loadCheckinMini() {
    const data = await loadCheckinData();
    const streakEl = $("#checkin-streak-num");
    const monthEl = $("#checkin-month-num");
    const dotsEl = $("#checkin-mini-dots");
    if (!streakEl || !monthEl || !dotsEl) return;

    streakEl.textContent = data.streak || "0";
    monthEl.textContent = data.monthly_count || "0";

    // 近 7 天的小圆点
    const today = new Date();
    let dotsHtml = "";
    for (let i = 6; i >= 0; i--) {
        const d = new Date(today);
        d.setDate(d.getDate() - i);
        const dateStr = d.toISOString().slice(0, 10);
        const active = (data.dates || []).includes(dateStr);
        const weekday = ["日","一","二","三","四","五","六"][d.getDay()];
        dotsHtml += `<span class="checkin-dot${active ? " active" : ""}" title="${dateStr} 周${weekday}">${active ? '<i data-lucide="check" style="width:10px;height:10px"></i>' : ""}</span>`;
    }
    dotsEl.innerHTML = dotsHtml;
    if (typeof lucide !== "undefined") lucide.createIcons();
}

// 个人页完整日历
let calActiveSet = new Set();

async function renderCheckinCalendar(monthOffset = 0) {
    const data = await loadCheckinData();
    calActiveSet = new Set(data.dates || []);

    // 计算目标月份
    const now = new Date();
    const target = new Date(now.getFullYear(), now.getMonth() + monthOffset, 1);
    calYear = target.getFullYear();
    calMonth = target.getMonth() + 1;

    // 更新标题
    const label = $("#cal-month-label");
    if (label) label.textContent = `${calYear}年${calMonth}月`;

    // 本月活跃天数
    const monthPrefix = `${calYear}-${String(calMonth).padStart(2, "0")}`;
    const monthActive = (data.dates || []).filter(d => d.startsWith(monthPrefix));

    // 更新统计数字
    const streakEl = $("#cal-streak-num");
    const monthEl = $("#cal-month-num");
    if (streakEl) streakEl.textContent = data.streak || "0";
    if (monthEl) monthEl.textContent = monthActive.length;

    // 渲染日历网格
    const grid = $("#checkin-grid");
    if (!grid) return;

    const firstDay = new Date(calYear, calMonth - 1, 1).getDay(); // 0=周日
    const daysInMonth = new Date(calYear, calMonth, 0).getDate();

    let html = "";
    // 填充前面的空白格
    for (let i = 0; i < firstDay; i++) {
        html += '<div class="checkin-day empty"></div>';
    }
    // 日期格
    for (let day = 1; day <= daysInMonth; day++) {
        const dateStr = `${calYear}-${String(calMonth).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
        const isActive = calActiveSet.has(dateStr);
        const isToday = dateStr === new Date().toISOString().slice(0, 10);
        let cls = "checkin-day";
        if (isToday) cls += " today";
        if (isActive) cls += " active";
        html += `<div class="${cls}">${isActive ? '<span class="checkin-day-num">' + day + '</span>' : day}</div>`;
    }
    grid.innerHTML = html;

    // 导航按钮
    const prevBtn = $("#cal-prev-month");
    const nextBtn = $("#cal-next-month");
    if (prevBtn) prevBtn.onclick = () => renderCheckinCalendar(monthOffset - 1);
    if (nextBtn) {
        // 不能超过当前月份
        const isCurrentOrFuture = (calYear === now.getFullYear() && calMonth >= now.getMonth() + 1) || calYear > now.getFullYear();
        nextBtn.disabled = isCurrentOrFuture;
        if (!isCurrentOrFuture) nextBtn.onclick = () => renderCheckinCalendar(monthOffset + 1);
    }
}

// 个人页复习计划
async function loadReviewPlan() {
    try {
        const data = await api("/api/review_due");
        const due = data.due || [];
        const total = data.total || 0;
        const badge = $("#review-plan-badge");
        const list = $("#review-plan-list");
        if (!list) return;

        if (due.length > 0) {
            if (badge) { badge.textContent = `${due.length} 个待复习`; badge.style.display = ""; }
            const items = due.slice(0, 5);
            list.innerHTML = items.map(i => {
                const stageLabel = i.review_stage ? `第${i.review_stage}轮` : "新学";
                const lastScore = i.history_scores?.length ? i.history_scores[i.history_scores.length - 1].toFixed(1) : "--";
                return `<div class="review-plan-item" data-grammar="${i.grammar_point}">
                    <div class="review-plan-item-left">
                        <span class="review-plan-grammar">${i.grammar_point}</span>
                        <span class="review-plan-meta">${stageLabel} · 上次得分 ${lastScore} · ${i.review_interval || 0} 天间隔</span>
                    </div>
                    <i data-lucide="play-circle" style="width:18px;height:18px;color:var(--color-primary)"></i>
                </div>`;
            }).join("") + (due.length > 5 ? `<p class="review-plan-more">还有 ${due.length - 5} 个语法点待复习...</p>` : "");
        } else if (total > 0) {
            list.innerHTML = `<p class="review-plan-empty">✅ 全部语法点已掌握，暂无到期复习</p>`;
            if (badge) badge.style.display = "none";
        } else {
            list.innerHTML = `<p class="review-plan-empty">完成首次练习后，艾宾浩斯记忆系统将自动安排复习</p>`;
            if (badge) badge.style.display = "none";
        }
        refreshIcons();

        // 点击复习项
        $$(".review-plan-item").forEach(el => {
            el.onclick = async () => {
                const gp = el.dataset.grammar;
                showLoading(`正在为「${gp}」生成复习题...`);
                try {
                    const result = await api("/api/generate_questions", {
                        method: "POST",
                        body: JSON.stringify({
                            notes: `复习：${gp}`,
                            level: AppState.config.level,
                            vocabulary: "",
                            textbook_vocab: [],
                        }),
                    });
                    if (!result.success || !result.data) throw new Error("生成失败");
                    AppState.notes = `复习：${gp}`; AppState.vocabulary = "";
                    AppState.questions = result.data.questions || [];
                    AppState.vocabUsed = result.data.vocab_used || [];
                    AppState.currentIndex = 0; AppState.records = [];
                    AppState.totalAnswered = 0; AppState.baseTotal = AppState.questions.length;
                    hideLoading(); initQuizScreen();
                } catch (err) { hideLoading(); alert(`复习题生成失败：${err.message}`); }
            };
        });
    } catch { /* 静默 */ }
}

// ============================================================
// 主题管理
// ============================================================
function getTheme() { return localStorage.getItem('japai-theme') || 'auto'; }
function setTheme(theme) { localStorage.setItem('japai-theme', theme); applyTheme(); }
function applyTheme() {
    const theme = getTheme();
    document.documentElement.removeAttribute('data-theme');
    if (theme === 'dark') document.documentElement.setAttribute('data-theme', 'dark');
    if (theme === 'light') document.documentElement.setAttribute('data-theme', 'light');
}
applyTheme(); // 页面加载时立即应用

// 页面加载完成后启动
document.addEventListener("DOMContentLoaded", () => {
    if (typeof lucide !== "undefined") lucide.createIcons();
    init();
    // Dock 导航
    if (typeof initDock === 'function') initDock();
    // ShinyText — 流光 Logo（延迟确保 DOM 就绪）
    setTimeout(() => {
        const logo = document.querySelector('.main-logo');
        if (logo && typeof createShinyText === 'function') {
            createShinyText(logo, { speed: 6, shimmerWidth: 100 });
        }
        // BorderGlow — 给带 data-glow 的卡片加边缘发光
        if (typeof initBorderGlowCards === 'function') {
            initBorderGlowCards();
        }
    }, 600);
});
