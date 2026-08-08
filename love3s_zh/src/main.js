document.documentElement.classList.add("js");

/* ============================================================
   Love4z — 主脚本
   四大模块：
     0. FPS 帧率检测器
     1. Matrix 数字雨生成器
     2. Ghost 幽灵错误消息
     3. 全屏翻页系统（滚轮 / 触摸 / 键盘）
     4. 打字机效果
   ============================================================ */

/* ============================================================
   模块 0 — FPS 帧率检测器
   在页面左上角实时显示当前帧率，用于性能调试
   ============================================================ */

(function () {
    "use strict";

    // 调试面板仅通过 URL ?debug=1 开启，避免生产环境持续占用一条动画帧循环。
    if (new URLSearchParams(window.location.search).get("debug") !== "1") return;

    /* ---- 配置 ---- */
    var FPS_MONITOR = {
        updateInterval: 500,    // FPS 数值刷新间隔，避免数字闪烁太快
        warnThreshold: 30       // 低于该帧率时数字变红警告
    };

    /* ---- 创建 DOM ---- */
    var monitor = document.createElement("div");
    monitor.style.cssText =
        "position: fixed;" +
        "top: 10px;" +
        "left: 10px;" +
        "padding: 4px 8px;" +
        "background: rgba(0, 0, 0, 0.6);" +
        "color: #0f0;" +
        "font: bold 14px monospace;" +
        "z-index: 99999;" +
        "pointer-events: none;" +
        "border-radius: 4px;";

    document.documentElement.appendChild(monitor);

    /* ---- 核心统计逻辑 ---- */
    var frameCount = 0;
    var lastTime = performance.now();
    var currentFps = 0;

    function tick(now) {
        frameCount++;

        var elapsed = now - lastTime;
        if (elapsed >= FPS_MONITOR.updateInterval) {
            currentFps = Math.round((frameCount * 1000) / elapsed);

            frameCount = 0;
            lastTime = now;

            monitor.textContent = currentFps + " FPS";
            monitor.style.color = currentFps < FPS_MONITOR.warnThreshold ? "#f00" : "#0f0";
        }

        window.requestAnimationFrame(tick);
    }

    window.requestAnimationFrame(tick);

})();


/* ============================================================
   模块 1 — Matrix 数字雨生成器
   在 #rain 容器中批量生成随机字符流，模拟 Matrix 代码雨
   ============================================================ */

(function () {
    "use strict";

    /* ---- 1a. 配置 ---- */
    var RAIN = {
        container: document.getElementById("rain"),
        chars: "ｱｲｳｴｵｶｷｸｹｺｻｼｽｾｿﾀﾁﾂﾃﾅﾆﾇﾈﾉﾊﾋﾌﾍﾎﾏﾐﾑﾒﾓﾔﾕﾖﾗﾘﾙﾚﾛﾜﾝ013456789",
        count: 100,
        sizeMin: 20,
        sizeMax: 40,
        durMin: 2,
        durMax: 5
    };

    // 与 CSS 移动端降级一致：窄屏不生成雨滴 DOM，避免无效节点开销。
    if (!RAIN.container || window.matchMedia("(max-width: 799px)").matches) return;

    /**
     * 范围随机数生成
     * @param {number} min 下限（含）
     * @param {number} max 上限（不含）
     * @returns {number} [min, max) 范围内的随机浮点数
     */
    function rand(min, max) {
        return Math.random() * (max - min) + min;
    }

    /* ---- 1b. 批量构建 DOM ---- */
    var fragment = document.createDocumentFragment();

    for (var i = 0; i < RAIN.count; i++) {
        var span = document.createElement("span");

        span.textContent = RAIN.chars[rand(0, RAIN.chars.length) | 0];

        span.style.cssText =
            "left: " + rand(0, 100) + "vw;" +
            "font-size: " + rand(RAIN.sizeMin, RAIN.sizeMax) + "px;" +
            "animation-duration: " + rand(RAIN.durMin, RAIN.durMax) + "s";

        fragment.appendChild(span);
    }

    RAIN.container.appendChild(fragment);

})();


/* ============================================================
   模块 2 — Ghost 幽灵错误消息
   定时在页面随机位置显示系统错误风格的文本，营造 glitch 氛围
   ============================================================ */

(function () {
    "use strict";

    /* ---- 2a. 配置 ---- */
    var GHOST = {
        el: document.getElementById("ghost"),

        msgs: [
            "#ERR?13: DIMENSION SHIFT DETECTED",
            "#FATAL?993: GATEWAY BREACHED",
            "#VOID?22: UNKNOWN PRESENCE",
            "#?404: REALITY NOT FOUND",
            "#PSI?77: SIGNAL FROM THE OTHER SIDE",
            "#SYS?00: MEMORY LEAK IN SECTOR 7G",
            "#ERR?666: OBSERVER EFFECT TRIGGERED",
            "#NULL?55: SCHRÖDINGER'S STATE COLLAPSED",
            "#WARN?01: GLITCH IN THE SPINE",
            "#XPN?0x0: CONSCIOUSNESS OVERFLOW"
        ],

        interval: 5000,
        fadeDelay: 4500,
        posMin: 10,
        posMax: 90
    };

    if (!GHOST.el || GHOST.msgs.length === 0) return;

    var lastIndex = -1;
    var fadeTimer = 0;

    /* ---- 2b. 刷新消息 ---- */
    function updateGhost() {
        var el = GHOST.el;
        var msgs = GHOST.msgs;
        var newIndex;

        if (msgs.length === 1) {
            newIndex = 0;
        } else {
            do {
                newIndex = (Math.random() * msgs.length) | 0;
            } while (newIndex === lastIndex);
        }

        lastIndex = newIndex;
        el.textContent = msgs[newIndex];

        el.style.cssText =
            "top: " + (GHOST.posMin + Math.random() * (GHOST.posMax - GHOST.posMin)) + "%;" +
            "left: " + (GHOST.posMin + Math.random() * (GHOST.posMax - GHOST.posMin)) + "%;" +
            "opacity: 1";

        if (fadeTimer) clearTimeout(fadeTimer);
        fadeTimer = setTimeout(function () {
            fadeTimer = 0;
            el.style.opacity = "0";
        }, GHOST.fadeDelay);
    }

    updateGhost();
    var ghostInterval = setInterval(updateGhost, GHOST.interval);
    window.addEventListener("pagehide", function () {
        clearInterval(ghostInterval);
        if (fadeTimer) clearTimeout(fadeTimer);
    }, { once: true });

})();


/* ============================================================
   模块 3 — 全屏翻页系统
   将 .screen 作为独立"页"，通过 transform: translateY()
   在页面间平滑切换。支持三种输入方式：
     - 鼠标滚轮
     - 触摸滑动（touchstart / touchend）
     - 键盘按键（方向键 / PageUp / PageDown / 空格）
   ============================================================ */

(function () {
    "use strict";

    /* ---- 3a. 状态 & 引用 ---- */
    var page = 0;
    var pages = document.getElementsByClassName("screen");
    var wrapper = document.getElementById("pages");
    var total = pages.length;

    if (!wrapper || total === 0) return;

    /* ---- 3b. 动画工具函数 ---- */

    /**
     * 在指定元素上触发 rubberBand 弹性动画
     * @param {Element|null|undefined} el 目标 .screen 元素
     */
    function playRubberBand(el) {
        if (!el) return;

        el.classList.remove("rubberBand");
        void el.offsetWidth;
        el.classList.add("rubberBand");

        el.addEventListener("animationend", function handler() {
            el.classList.remove("rubberBand");
            el.removeEventListener("animationend", handler);
        });
    }

    /* ---- 3c. 翻页核心函数 ---- */

    /**
     * 切换到第 n 页
     * @param {number} n 目标页索引
     */
    function goPage(n) {
        var target = Math.max(0, Math.min(total - 1, n | 0));
        var screen = pages[target];
        if (!screen) return;

        if (target !== page) {
            page = target;
            // 与 CSS 的 --page-height 保持一致，避免移动端地址栏变化造成错位。
            wrapper.style.transform = "translateY(calc(-" + page + " * var(--page-height)))";
            playRubberBand(screen);
        }

        // 通知打字机等模块：当前屏进入可视（transform 翻页下 IO 不一定可靠）
        window.dispatchEvent(new CustomEvent("love4z:pagechange", {
            detail: { page: page, screen: screen }
        }));
    }

    function requestPage(delta) {
        goPage(page + delta);
    }

    /* ---- 3d. 输入事件绑定 ---- */

    window.addEventListener("wheel", function (e) {
        requestPage(e.deltaY > 0 ? 1 : -1);
    }, { passive: true });

    var touchStartY = 0;

    window.addEventListener("touchstart", function (e) {
        var t = e.touches && e.touches[0];
        if (!t) return;
        touchStartY = t.clientY;
    }, { passive: true });

    window.addEventListener("touchend", function (e) {
        var t = e.changedTouches && e.changedTouches[0];
        if (!t) return;

        var deltaY = t.clientY - touchStartY;
        if (Math.abs(deltaY) < 50) return;

        requestPage(deltaY < 0 ? 1 : -1);
    }, { passive: true });

    window.addEventListener("keydown", function (e) {
        if (e.key === "ArrowDown" || e.key === "PageDown" || e.key === " ") {
            e.preventDefault();
            requestPage(1);
        } else if (e.key === "ArrowUp" || e.key === "PageUp") {
            e.preventDefault();
            requestPage(-1);
        }
    });

    window.addEventListener("load", function () {
        playRubberBand(pages[0]);
        goPage(0);
    });

})();


/* ============================================================
   模块 4 — 打字机效果
   神秘乱码打字机（修复完美版 v2.0）
   ============================================================ */
(function () {
    const SCRAMBLE_CHARS = ' █▓▒░╫╪╗╝╚╔║═╬▀■□◇◆▽⊿⟐⟡⧫⬡⬢⏣'.split('');

    const CLS = {
        WRAP: 'char-wrap',
        FINAL: 'final',
        SCRAMBLE: 'scramble',
        REVEALED: 'revealed'
    };

    const ATTR = {
        IDX: 'data-typerr-idx',
        INTERVAL: 'data-interval',
        RANDOM: 'data-random'
    };

    function prepareTemplate(phraseText) {
        const tempContainer = document.createElement('div');
        tempContainer.innerHTML = phraseText;

        const globalIndexRef = { count: 0 };
        processNodes(tempContainer, globalIndexRef);

        return { html: tempContainer.innerHTML, totalChars: globalIndexRef.count };
    }

    function processNodes(node, globalIndexRef) {
        const childNodes = Array.from(node.childNodes);
        childNodes.forEach(child => {
            if (child.nodeType === Node.TEXT_NODE) {
                const text = child.nodeValue;
                const parent = child.parentNode;
                const fragment = document.createDocumentFragment();

                for (let i = 0; i < text.length; i++) {
                    const ch = text[i];
                    if (ch === ' ' || ch === '\n' || ch === '\r' || ch === '\t') {
                        fragment.appendChild(document.createTextNode(ch));
                        continue;
                    }

                    const idx = globalIndexRef.count++;
                    const span = document.createElement('span');
                    span.className = CLS.WRAP;

                    const finalSpan = document.createElement('span');
                    finalSpan.className = CLS.FINAL;
                    finalSpan.setAttribute(ATTR.IDX, idx);
                    finalSpan.textContent = ch;

                    const scrambleSpan = document.createElement('span');
                    scrambleSpan.className = CLS.SCRAMBLE;
                    scrambleSpan.setAttribute(ATTR.IDX, idx);
                    scrambleSpan.textContent = SCRAMBLE_CHARS[0];

                    span.appendChild(finalSpan);
                    span.appendChild(scrambleSpan);
                    fragment.appendChild(span);
                }
                parent.replaceChild(fragment, child);
            } else if (child.nodeType === Node.ELEMENT_NODE) {
                processNodes(child, globalIndexRef);
            }
        });
    }

    function typeIn(container, totalChars, state) {
        return new Promise(resolve => {
            if (totalChars === 0) { resolve(); return; }

            const promises = [];
            const finalEls = [];
            const scrambleEls = [];
            container.querySelectorAll(`.${CLS.FINAL}`).forEach(el => {
                finalEls[Number(el.getAttribute(ATTR.IDX))] = el;
            });
            container.querySelectorAll(`.${CLS.SCRAMBLE}`).forEach(el => {
                scrambleEls[Number(el.getAttribute(ATTR.IDX))] = el;
            });

            if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
                finalEls.forEach(el => el && el.classList.add(CLS.REVEALED));
                scrambleEls.forEach(el => el && (el.style.display = 'none'));
                resolve();
                return;
            }

            for (let i = 0; i < totalChars; i++) {
                promises.push(new Promise(res => {
                    const finalEl = finalEls[i];
                    const scrambleEl = scrambleEls[i];

                    if (!finalEl || !scrambleEl) { res(); return; }

                    const startDelay = Math.random() * 4000;
                    const scrambleCount = 2 + Math.floor(Math.random() * 8);
                    const scrambleInterval = 40 + Math.random() * 40;

                    state.setTimeout(() => {
                        let step = 0;
                        const timer = state.setInterval(() => {
                            step++;
                            if (step >= scrambleCount) {
                                state.clearInterval(timer);
                                scrambleEl.style.display = 'none';
                                finalEl.classList.add(CLS.REVEALED);
                                res();
                            } else {
                                scrambleEl.textContent = SCRAMBLE_CHARS[Math.floor(Math.random() * SCRAMBLE_CHARS.length)];
                            }
                        }, scrambleInterval);
                    }, startDelay);
                }));
            }
            Promise.all(promises).then(resolve);
        });
    }

    function glitchOut(container, state) {
        return new Promise(resolve => {
            if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
                container.style.opacity = '0';
                resolve();
                return;
            }

            const charWraps = Array.from(container.querySelectorAll(`.${CLS.WRAP}`));

            if (charWraps.length === 0) {
                container.style.opacity = '0';
                state.setTimeout(resolve, 200);
                return;
            }

            const timelines = charWraps.map(wrap => ({
                finalEl: wrap.querySelector(`.${CLS.FINAL}`),
                scrambleEl: wrap.querySelector(`.${CLS.SCRAMBLE}`),
                startAt: Math.random() * 1000
            }));
            const startTime = performance.now();
            const charDuration = 250;

            function tick(now) {
                if (state.disposed) {
                    resolve();
                    return;
                }

                const elapsed = now - startTime;
                let allDone = true;

                for (let i = 0; i < timelines.length; i++) {
                    const { finalEl, scrambleEl, startAt } = timelines[i];
                    const charElapsed = elapsed - startAt;
                    if (charElapsed < 0) { allDone = false; continue; }

                    const progress = Math.min(charElapsed / charDuration, 1);

                    if (progress < 1) {
                        allDone = false;
                        const opacity = 1 - progress;
                        if (finalEl) finalEl.style.opacity = opacity;

                        if (scrambleEl) {
                            if (Math.random() > 0.5) {
                                scrambleEl.style.display = '';
                                scrambleEl.textContent = SCRAMBLE_CHARS[Math.floor(Math.random() * SCRAMBLE_CHARS.length)];
                                scrambleEl.style.opacity = opacity * 0.35;
                                if (finalEl) finalEl.style.opacity = opacity * 0.7;
                            } else {
                                scrambleEl.style.display = 'none';
                            }
                        }
                    } else {
                        if (finalEl) finalEl.style.opacity = 0;
                        if (scrambleEl) scrambleEl.style.display = 'none';
                    }
                }

                if (allDone) {
                    container.style.opacity = '0';
                    resolve();
                } else {
                    state.requestFrame(tick);
                }
            }
            state.requestFrame(tick);
        });
    }

    function initTyperr(container) {
        const itemElements = Array.from(container.querySelectorAll('[data-phrase]'));
        let phrases = [];

        if (itemElements.length > 0) {
            phrases = itemElements.map(el => el.innerHTML.trim());
        } else {
            const rawText = container.innerHTML.trim();
            phrases = rawText.split('&&').map(p => p.trim()).filter(p => p.length > 0);
        }

        if (phrases.length === 0) return;

        container.innerHTML = '';

        const rawInterval = container.getAttribute(ATTR.INTERVAL) || '2000 - 7000';
        let minInterval = 4000;
        let maxInterval = 4000;
        let isFixedTime = true;

        // 兼容中英文逗号与横杠分隔的区间写法
        if (/[-–,，]/.test(rawInterval)) {
            const parts = rawInterval.split(/[-–,，]/);
            minInterval = Math.max(0, parseInt(parts[0], 10) || 2000);
            maxInterval = Math.max(minInterval, parseInt(parts[1], 10) || 6000);
            isFixedTime = false;
        } else {
            const val = parseInt(rawInterval, 10);
            if (!isNaN(val)) {
                minInterval = maxInterval = Math.max(0, val);
            }
        }

        const isRandom = container.getAttribute(ATTR.RANDOM) === 'true';
        const templates = phrases.map(phrase => prepareTemplate(phrase));

        let currentIndex = -1;
        let isTransitioning = false;
        const state = {
            disposed: false,
            timers: new Set(),
            frames: new Set(),
            setTimeout(callback, delay) {
                const id = window.setTimeout(() => {
                    this.timers.delete(id);
                    if (!this.disposed) callback();
                }, delay);
                this.timers.add(id);
                return id;
            },
            setInterval(callback, delay) {
                const id = window.setInterval(() => {
                    if (!this.disposed) callback();
                }, delay);
                this.timers.add(id);
                return id;
            },
            clearInterval(id) {
                window.clearInterval(id);
                this.timers.delete(id);
            },
            requestFrame(callback) {
                const id = window.requestAnimationFrame(now => {
                    this.frames.delete(id);
                    if (!this.disposed) callback(now);
                });
                this.frames.add(id);
                return id;
            },
            dispose() {
                this.disposed = true;
                this.timers.forEach(id => {
                    window.clearTimeout(id);
                    window.clearInterval(id);
                });
                this.frames.forEach(id => window.cancelAnimationFrame(id));
                this.timers.clear();
                this.frames.clear();
            }
        };

        window.addEventListener('pagehide', () => state.dispose(), { once: true });

        function getNextIndex() {
            if (phrases.length === 1) return 0;
            if (isRandom) {
                let idx;
                do { idx = Math.floor(Math.random() * phrases.length); } while (idx === currentIndex && phrases.length > 1);
                return idx;
            }
            return (currentIndex + 1) % phrases.length;
        }

        async function showNext() {
            if (state.disposed || isTransitioning) return;
            isTransitioning = true;

            currentIndex = getNextIndex();
            const currentTemplate = templates[currentIndex];

            container.innerHTML = currentTemplate.html;
            container.style.opacity = '1';

            await typeIn(container, currentTemplate.totalChars, state);
            if (!state.disposed) isTransitioning = false;
        }

        if (phrases.length === 1) {
            showNext();
        } else {
            async function loop() {
                if (state.disposed) return;

                await showNext();
                if (state.disposed) return;

                const delay = isFixedTime
                    ? minInterval
                    : (minInterval + Math.random() * (maxInterval - minInterval + 1));

                state.setTimeout(async () => {
                    if (state.disposed) return;
                    await glitchOut(container, state);
                    if (state.disposed) return;
                    state.setTimeout(loop, 400);
                }, delay);
            }
            loop();
        }
    }

    function startTyperr(target) {
        if (!target || target.dataset.typerrInitialized === 'true') return;
        initTyperr(target);
        target.dataset.typerrInitialized = 'true';
    }

    function startTyperrsIn(root) {
        if (!root) return;
        if (root.classList && root.classList.contains('typerr')) startTyperr(root);
        if (root.querySelectorAll) {
            root.querySelectorAll('.typerr').forEach(startTyperr);
        }
    }

    document.addEventListener('DOMContentLoaded', () => {
        const targets = document.querySelectorAll('.typerr');

        // 翻页事件：transform 场景下保证进入屏内的 typerr 能启动
        window.addEventListener('love4z:pagechange', (e) => {
            const screen = e.detail && e.detail.screen;
            startTyperrsIn(screen);
        });

        if (!('IntersectionObserver' in window)) {
            targets.forEach(startTyperr);
            return;
        }

        const observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    startTyperr(entry.target);
                    observer.unobserve(entry.target);
                }
            });
        }, { threshold: 0.15 });

        targets.forEach(target => observer.observe(target));

        // 首屏：若 load 前 DOM 已就绪，尝试启动首屏内实例
        const firstScreen = document.querySelector('.screen');
        startTyperrsIn(firstScreen);
    });
})();
