/* ============================================================
   JapAI 高级动效 — 基于 ReactBits 的 Vanilla JS 移植
   ClickSpark / ShinyText / FadeContent
   https://reactbits.dev
   ============================================================ */

// ========== ClickSpark — 点击火花粒子效果 ==========
function createClickSpark(options = {}) {
    const {
        sparkColor = getComputedStyle(document.documentElement).getPropertyValue('--color-primary').trim() || '#0D9488',
        sparkSize = 10,
        sparkRadius = 20,
        sparkCount = 8,
        duration = 400,
        easing = 'ease-out',
    } = options;

    // 创建覆盖全屏的 Canvas
    const canvas = document.createElement('canvas');
    canvas.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;pointer-events:none;z-index:9999;';
    document.body.appendChild(canvas);
    const ctx = canvas.getContext('2d');

    let sparks = [];
    let animId = null;
    let animating = false;

    function resize() {
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
    }
    window.addEventListener('resize', resize);
    resize();

    const easeFuncs = {
        'linear': t => t,
        'ease-in': t => t * t,
        'ease-in-out': t => t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t,
        'ease-out': t => t * (2 - t),
    };
    const ease = easeFuncs[easing] || easeFuncs['ease-out'];

    function animate(timestamp) {
        if (sparks.length === 0) {
            animating = false;
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            return;
        }
        animating = true;
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        sparks = sparks.filter(spark => {
            const elapsed = timestamp - spark.startTime;
            if (elapsed >= duration) return false;

            const progress = elapsed / duration;
            const eased = ease(progress);
            const distance = eased * sparkRadius;
            const len = sparkSize * (1 - eased);

            const x1 = spark.x + distance * Math.cos(spark.angle);
            const y1 = spark.y + distance * Math.sin(spark.angle);
            const x2 = spark.x + (distance + len) * Math.cos(spark.angle);
            const y2 = spark.y + (distance + len) * Math.sin(spark.angle);

            ctx.strokeStyle = sparkColor;
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.moveTo(x1, y1);
            ctx.lineTo(x2, y2);
            ctx.stroke();

            return true;
        });

        if (sparks.length > 0) {
            animId = requestAnimationFrame(animate);
        } else {
            animating = false;
        }
    }

    document.addEventListener('click', e => {
        const now = performance.now();
        for (let i = 0; i < sparkCount; i++) {
            sparks.push({
                x: e.clientX,
                y: e.clientY,
                angle: (2 * Math.PI * i) / sparkCount,
                startTime: now,
            });
        }
        if (!animating) {
            animId = requestAnimationFrame(animate);
        }
    });

    return {
        destroy() {
            if (animId) cancelAnimationFrame(animId);
            window.removeEventListener('resize', resize);
            document.body.removeChild(canvas);
        }
    };
}

// ========== ShinyText — 流光文字效果 ==========
function createShinyText(element, options = {}) {
    const {
        speed = 5,
        shimmerWidth = 80,
    } = options;

    element.style.display = 'inline-block';
    element.style.background = `linear-gradient(110deg,
        var(--text-primary, #134E4A) 35%,
        var(--color-primary-light, #CCFBF1) 42%,
        var(--color-primary, #0D9488) 45%,
        var(--color-primary-light, #CCFBF1) 48%,
        var(--text-primary, #134E4A) 55%
    )`;
    element.style.backgroundSize = '200% 100%';
    element.style.webkitBackgroundClip = 'text';
    element.style.backgroundClip = 'text';
    element.style.color = 'transparent';
    element.style.animation = `shinyText ${speed}s linear infinite`;

    // 注入 keyframes（如果还没有）
    if (!document.getElementById('shiny-text-keyframes')) {
        const style = document.createElement('style');
        style.id = 'shiny-text-keyframes';
        style.textContent = `
            @keyframes shinyText {
                0% { background-position: 200% 0; }
                100% { background-position: -200% 0; }
            }
        `;
        document.head.appendChild(style);
    }
}

// ========== FadeContent — 内容淡入过渡 ==========
function fadeContent(container, newContent, options = {}) {
    const {
        duration = 300,
        direction = 'up',  // 'up' | 'down' | 'none'
    } = options;

    const translates = {
        up: 'translateY(12px)',
        down: 'translateY(-12px)',
        none: 'translateY(0)',
    };

    // 淡出旧内容
    container.style.transition = `opacity ${duration * 0.4}ms ease-out`;
    container.style.opacity = '0';

    setTimeout(() => {
        // 替换内容
        if (typeof newContent === 'string') {
            container.innerHTML = newContent;
        } else if (newContent instanceof HTMLElement) {
            container.innerHTML = '';
            container.appendChild(newContent);
        }

        // 设置初始状态
        container.style.transition = `opacity ${duration * 0.6}ms ease-out, transform ${duration * 0.6}ms ease-out`;
        container.style.transform = translates[direction] || translates.up;
        container.style.opacity = '1';

        // 触发重排后移除 transform
        requestAnimationFrame(() => {
            container.style.transform = 'translateY(0)';
        });
    }, duration * 0.4);
}

// ========== SpringScale — 弹簧缩放（按钮点击反馈） ==========
function springPress(element) {
    element.style.transition = 'transform 0.15s cubic-bezier(0.34, 1.56, 0.64, 1)';
    element.style.transform = 'scale(0.92)';
    setTimeout(() => {
        element.style.transform = 'scale(1)';
    }, 150);
}

// ========== FloatingParticles — 浮动装饰粒子 ==========
function createFloatingParticles(container, options = {}) {
    const {
        count = 15,
        color = 'rgba(13, 148, 136, 0.12)',
        minSize = 4,
        maxSize = 12,
        speed = 1,
    } = options;

    const canvas = document.createElement('canvas');
    canvas.style.cssText = 'position:absolute;top:0;left:0;width:100%;height:100%;pointer-events:none;z-index:0;';
    canvas.width = container.offsetWidth;
    canvas.height = container.offsetHeight;
    container.style.position = 'relative';
    container.appendChild(canvas);

    const ctx = canvas.getContext('2d');
    const particles = [];

    for (let i = 0; i < count; i++) {
        particles.push({
            x: Math.random() * canvas.width,
            y: Math.random() * canvas.height,
            r: minSize + Math.random() * (maxSize - minSize),
            vx: (Math.random() - 0.5) * 0.5 * speed,
            vy: (Math.random() - 0.5) * 0.5 * speed,
            opacity: 0.3 + Math.random() * 0.5,
        });
    }

    function animate() {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        for (const p of particles) {
            p.x += p.vx;
            p.y += p.vy;
            if (p.x < 0) p.x = canvas.width;
            if (p.x > canvas.width) p.x = 0;
            if (p.y < 0) p.y = canvas.height;
            if (p.y > canvas.height) p.y = 0;
            ctx.beginPath();
            ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
            ctx.fillStyle = color.replace('0.12', String(p.opacity));
            ctx.fill();
        }
        requestAnimationFrame(animate);
    }
    animate();

    return canvas;
}

// ========== BorderGlow — 鼠标边缘发光卡片 ==========
function borderGlow(element, options = {}) {
    const {
        edgeSensitivity = 30,
        glowColor = '173 80 40',   // JapAI teal HSL
        glowRadius = 30,
        glowIntensity = 1.0,
        coneSpread = 25,
        animated = false,
        colors = ['rgba(13,148,136,0.9)', 'rgba(45,212,191,0.9)', 'rgba(217,119,6,0.9)'],
        fillOpacity = 0.35,
    } = options;

    // 构建 glow color CSS 变量
    function parseHSL(str) {
        const m = str.match(/([\d.]+)\s*([\d.]+)\s*([\d.]+)/);
        if (!m) return { h: 40, s: 80, l: 80 };
        return { h: parseFloat(m[1]), s: parseFloat(m[2]), l: parseFloat(m[3]) };
    }

    const { h, s, l } = parseHSL(glowColor);
    const opacities = [100, 60, 50, 40, 30, 20, 10];
    const keys = ['--glow-color', '--glow-color-60', '--glow-color-50', '--glow-color-40', '--glow-color-30', '--glow-color-20', '--glow-color-10'];
    for (let i = 0; i < opacities.length; i++) {
        element.style.setProperty(keys[i], `hsl(${h}deg ${s}% ${l}% / ${Math.min(opacities[i] * glowIntensity, 100)}%)`);
    }

    // 构建 gradient CSS 变量
    const positions = ['80% 55%', '69% 34%', '8% 6%', '41% 38%', '86% 85%', '82% 18%', '51% 4%'];
    const gradKeys = ['--gradient-one', '--gradient-two', '--gradient-three', '--gradient-four', '--gradient-five', '--gradient-six', '--gradient-seven'];
    const colorMap = [0, 1, 2, 0, 1, 2, 1];
    for (let i = 0; i < 7; i++) {
        const c = colors[Math.min(colorMap[i], colors.length - 1)];
        element.style.setProperty(gradKeys[i], `radial-gradient(at ${positions[i]}, ${c} 0px, transparent 50%)`);
    }
    element.style.setProperty('--gradient-base', `linear-gradient(${colors[0]} 0 100%)`);

    element.style.setProperty('--edge-sensitivity', edgeSensitivity);
    element.style.setProperty('--glow-padding', `${glowRadius}px`);
    element.style.setProperty('--cone-spread', coneSpread);
    element.style.setProperty('--fill-opacity', fillOpacity);

    // 鼠标边缘检测
    function handleMove(e) {
        const rect = element.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        const cx = rect.width / 2;
        const cy = rect.height / 2;
        const dx = x - cx;
        const dy = y - cy;

        let kx = Infinity, ky = Infinity;
        if (dx !== 0) kx = cx / Math.abs(dx);
        if (dy !== 0) ky = cy / Math.abs(dy);
        const edge = Math.min(Math.max(1 / Math.min(kx, ky), 0), 1);

        const radians = Math.atan2(dy, dx);
        let degrees = radians * (180 / Math.PI) + 90;
        if (degrees < 0) degrees += 360;

        element.style.setProperty('--edge-proximity', (edge * 100).toFixed(3));
        element.style.setProperty('--cursor-angle', `${degrees.toFixed(3)}deg`);
    }

    element.addEventListener('pointermove', handleMove);

    // 扫光动画
    if (animated) {
        const t0 = performance.now();
        element.classList.add('sweep-active');
        function sweep(ts) {
            const elapsed = ts - t0;
            if (elapsed < 500) {
                element.style.setProperty('--edge-proximity', (elapsed / 5).toFixed(3));
            } else if (elapsed < 2000) {
                const t = (elapsed - 500) / 1500;
                element.style.setProperty('--cursor-angle', `${110 + t * 355}deg`);
            } else if (elapsed < 4250) {
                const t = (elapsed - 2000) / 2250;
                element.style.setProperty('--cursor-angle', `${110 + t * 355}deg`);
            } else if (elapsed < 5750) {
                element.style.setProperty('--edge-proximity', (100 - ((elapsed - 4250) / 1500) * 100).toFixed(3));
            } else {
                element.classList.remove('sweep-active');
                return;
            }
            requestAnimationFrame(sweep);
        }
        requestAnimationFrame(sweep);
    }

    return {
        destroy() {
            element.removeEventListener('pointermove', handleMove);
        }
    };
}

// 初始化页面中所有带 data-glow 属性的卡片
function initBorderGlowCards() {
    document.querySelectorAll('[data-glow]').forEach(el => {
        // 如果已经初始化过，跳过
        if (el.classList.contains('border-glow-card')) return;

        const animated = el.dataset.glow === 'sweep';

        // 包装原有内容：将所有子元素移入 border-glow-inner
        const inner = document.createElement('div');
        inner.className = 'border-glow-inner';
        while (el.firstChild) {
            inner.appendChild(el.firstChild);
        }

        // 添加 glow 结构
        const edgeLight = document.createElement('span');
        edgeLight.className = 'edge-light';
        el.appendChild(edgeLight);
        el.appendChild(inner);

        // 加 class + 初始化
        el.classList.add('border-glow-card');
        borderGlow(el, {
            edgeSensitivity: 30,
            glowRadius: 30,
            glowIntensity: 1.0,
            colors: ['rgba(13,148,136,0.9)', 'rgba(45,212,191,0.9)', 'rgba(217,119,6,0.9)'],
            animated,
        });
    });
}

// ========== FloatingOrbs — 渐变流动光斑背景 ==========
function createFloatingOrbs(container, options = {}) {
    const {
        count = 5,
        minSize = 200,
        maxSize = 400,
        speed = 1,
        colors = [
            'rgba(13,148,136,0.15)',
            'rgba(45,212,191,0.10)',
            'rgba(217,119,6,0.08)',
            'rgba(13,148,136,0.12)',
            'rgba(59,130,246,0.06)',
        ],
    } = options;

    const canvas = document.createElement('canvas');
    canvas.style.cssText = 'position:absolute;top:0;left:0;width:100%;height:100%;pointer-events:none;z-index:0;';
    canvas.width = container.offsetWidth || window.innerWidth;
    canvas.height = container.offsetHeight || window.innerHeight;
    container.style.position = 'relative';
    container.insertBefore(canvas, container.firstChild);

    const ctx = canvas.getContext('2d');
    const orbs = [];

    for (let i = 0; i < count; i++) {
        orbs.push({
            x: Math.random() * canvas.width,
            y: Math.random() * canvas.height,
            r: minSize + Math.random() * (maxSize - minSize),
            vx: (Math.random() - 0.5) * 0.3 * speed,
            vy: (Math.random() - 0.5) * 0.3 * speed,
            color: colors[i % colors.length],
            phase: Math.random() * Math.PI * 2,
        });
    }

    function animate() {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        const now = Date.now() / 1000;

        for (const orb of orbs) {
            orb.x += orb.vx;
            orb.y += orb.vy;
            if (orb.x < -orb.r) orb.x = canvas.width + orb.r;
            if (orb.x > canvas.width + orb.r) orb.x = -orb.r;
            if (orb.y < -orb.r) orb.y = canvas.height + orb.r;
            if (orb.y > canvas.height + orb.r) orb.y = -orb.r;

            const pulse = 1 + Math.sin(now * 0.5 + orb.phase) * 0.15;
            const r = orb.r * pulse;

            const gradient = ctx.createRadialGradient(orb.x, orb.y, 0, orb.x, orb.y, r);
            gradient.addColorStop(0, orb.color);
            gradient.addColorStop(0.5, orb.color.replace(/[\d.]+\)$/, (m) => {
                const v = parseFloat(m) / 2;
                return v + ')';
            }));
            gradient.addColorStop(1, 'transparent');

            ctx.fillStyle = gradient;
            ctx.beginPath();
            ctx.arc(orb.x, orb.y, r, 0, Math.PI * 2);
            ctx.fill();
        }
        requestAnimationFrame(animate);
    }
    animate();

    // 响应窗口大小
    const resize = () => {
        canvas.width = container.offsetWidth || window.innerWidth;
        canvas.height = container.offsetHeight || window.innerHeight;
    };
    window.addEventListener('resize', resize);

    return {
        destroy() { window.removeEventListener('resize', resize); canvas.remove(); }
    };
}

// 引导页初始化背景
function initGuideBackground() {
    const guide = document.querySelector('#screen-guide .guide-container');
    if (guide && !guide.dataset.orbsInit) {
        guide.dataset.orbsInit = '1';
        createFloatingOrbs(guide, {
            count: 5,
            minSize: 180,
            maxSize: 350,
            speed: 0.8,
        });
    }
}

console.log('✨ JapAI effects loaded: ClickSpark · ShinyText · FadeContent · SpringPress · BorderGlow · FloatingOrbs');
