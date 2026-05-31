/* ============================================================
   Love4z — 主脚本
   四大模块：
     0. FPS 帧率检测器
     1. Matrix 数字雨生成器
     2. Ghost 幽灵错误消息
     3. 全屏翻页系统（滚轮 / 触摸 / 键盘）
     4. 打字机效果（（
   ============================================================ */

/* ============================================================
   模块 0 — FPS 帧率检测器
   在页面左上角实时显示当前帧率，用于性能调试
   ============================================================ */

(function () {
    "use strict";

    /* ---- 配置 ---- */
    var FPS_MONITOR = {
        updateInterval: 500,    // FPS 数值刷新间隔，避免数字闪烁太快
        warnThreshold: 5        // 低于目标帧率该数值时，数字变红警告
    };

    /* ---- 创建 DOM ---- */
    var monitor = document.createElement("div");
    monitor.style.cssText =
        "position: fixed;" +
        "top: 10px;" +
        "left: 10px;" +
        "padding: 4px 8px;" +
        "background: rgba(0, 0, 0, 0.6);" +
        "color: #0f0;" +              // 默认绿色，表示流畅
        "font: bold 14px monospace;" +
        "z-index: 99999;" +
        "pointer-events: none;" +      // 穿透点击，不影响页面交互
        "border-radius: 4px;";

    document.documentElement.appendChild(monitor);

    /* ---- 核心统计逻辑 ---- */
    var frameCount = 0;               // 帧计数器
    var lastTime = performance.now(); // 上次统计的时间戳
    var currentFps = 0;               // 当前计算出的 FPS 值

    function tick(now) {
        frameCount++;

        // 时间差验证：是否达到刷新间隔
        var elapsed = now - lastTime;
        if (elapsed >= FPS_MONITOR.updateInterval) {
            // 核心公式：帧数 / 经过时间(秒) = 帧率
            // 乘以 1000 是将毫秒转换为秒
            currentFps = Math.round((frameCount * 1000) / elapsed);

            frameCount = 0;
            lastTime = now;

            // 更新显示
            monitor.textContent = currentFps + " FPS";

            // 性能警告验证：如果帧率严重低于预期（掉帧严重），变红提示
            monitor.style.color = currentFps < FPS_MONITOR.warnThreshold ? "#f00" : "#0f0";
        }

        // 使用原生的 requestAnimationFrame 保证统计精度
        // 如果使用被重写的 rAF，统计出来的 FPS 永远等于限制后的帧率，无法反映底层真实情况
        window.requestAnimationFrame(tick);
    }

    // 启动检测循环
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
        chars: "ｱｲｳｴｵｶｷｸｹｺｻｼｽｾｿﾀﾁﾂﾃﾅﾆﾇﾈﾉﾊﾋﾌﾍﾎﾏﾐﾑﾒﾓﾔﾕﾖﾗﾘﾙﾚﾛﾜﾝ013456789",           // 雨滴字符集（半宽数字，易读）
        count: 100,                   // 同时存在的雨滴数量
        sizeMin: 20,                  // 字号下限
        sizeMax: 40,                  // 字号上限
        durMin: 2,                    // 下落动画最短时长
        durMax: 5                     // 下落动画最长时长
    };

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

    // 使用 DocumentFragment 做离屏构建，一次性 append 到 DOM
    // 优势：规避逐个 appendChild 触发的多次回流
    var fragment = document.createDocumentFragment();

    for (var i = 0; i < RAIN.count; i++) {
        var span = document.createElement("span");

        // | 0 是 JavaScript 中最快的整数截断方式（等价于 Math.floor）
        // 对正数有效；这里 rand 始终返回正数，安全使用
        span.textContent = RAIN.chars[rand(0, RAIN.chars.length) | 0];

        // 单次 cssText 赋值优于逐属性 style.left / style.fontSize 赋值
        // 每次 .style.xxx = 都会触发样式重算，合并写入只需一次
        span.style.cssText =
            "left: " + rand(0, 100) + "vw;" +
            "font-size: " + rand(RAIN.sizeMin, RAIN.sizeMax) + "px;" +
            "animation-duration: " + rand(RAIN.durMin, RAIN.durMax) + "s";

        fragment.appendChild(span);
    }

    // 一次性挂载所有雨滴到 DOM
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

        // 错误消息池：仿系统崩溃 / 维度异常 / 意识溢出 等伪错误码
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

        interval: 5000,       // 每条消息驻留总时长
        fadeBefore: 4500,     // 提前多少 ms 开始淡出（需 CSS transition: opacity 0.5s 配合）
        posMin: 10,           // 定位下限 (%) — 避免文字贴边
        posMax: 90            // 定位上限 (%)
    };

    /**
     * 状态锁：记录上一条消息的索引
     * 用于防止相邻两次刷新选中同一条消息，避免"视觉静止"错觉
     * 初始值 -1 确保首次随机时 do-while 至少执行一次
     */
    var lastIndex = -1;

    /* ---- 2b. 刷新消息 ---- */
    function updateGhost() {
        var el = GHOST.el;
        var msgs = GHOST.msgs;
        var newIndex;

        /* 索引去重验证：
         * do-while 保证新索引与上一次不同。
         * 当 msgs.length === 1 时会死循环，但消息池有 10 条，安全。 */
        do {
            newIndex = (Math.random() * msgs.length) | 0;
        } while (newIndex === lastIndex);

        lastIndex = newIndex;
        el.textContent = msgs[newIndex];

        /* 随机定位验证：
         * posMin ~ posMax 区间确保文字不会超出视口边界。
         * 使用 cssText 单次写入，合并位置 + 显形两个操作 */
        el.style.cssText =
            "top: " + (GHOST.posMin + Math.random() * (GHOST.posMax - GHOST.posMin)) + "%;" +
            "left: " + (GHOST.posMin + Math.random() * (GHOST.posMax - GHOST.posMin)) + "%;" +
            "opacity: 1";

        /* 定时淡出：
         * 在下一个周期到来前 GHOST.fadeBefore 毫秒开始淡出。
         * CSS 中 transition: opacity 0.5s 确保平滑过渡。
         * 计算公式：interval - fadeBefore = 5000 - 500 = 4500ms 后触发淡出 */
        setTimeout(function () {
            el.style.opacity = "0";
        }, GHOST.interval - GHOST.fadeBefore);
    }

    // 立即显示第一条消息，之后定时更新
    updateGhost();
    setInterval(updateGhost, GHOST.interval);

})();


/* ============================================================
   模块 3 — 全屏翻页系统
   将11个 .screen 作为独立"页"，通过 transform: translateY()
   在页面间平滑切换。支持三种输入方式：
     - 鼠标滚轮
     - 触摸滑动（touchstart / touchend）
     - 键盘按键（方向键 / PageUp / PageDown / 空格）
   ============================================================ */

(function () {
    "use strict";

    /* ---- 3a. 状态 & 引用 ---- */
    var page = 0;                                    // 当前页索引 (0-based)
    var pages = document.getElementsByClassName("screen");  // 实时 HTMLCollection
    var wrapper = document.getElementById("pages");  // 滚动包裹层
    var total = pages.length;                        // 总页数

    var lastScrollTime = 0;    // 上次翻页时间戳，用于节流
    var SCROLL_DELAY = 800;    // 翻页冷却时间 — 800ms 匹配 CSS transition 0.75s

    /* ---- 3b. 动画工具函数 ---- */

    /**
     * 在指定元素上触发 rubberBand 弹性动画
     *
     * 实现原理：
     * 1. 先移除 rubberBand 类（确保可以重新触发）
     * 2. 强制重排：读取 offsetWidth 迫使浏览器
     *    将"移除类"的变更同步到渲染树，这样再添加类时动画会从头播放
     * 3. 添加 rubberBand 类 → CSS @keyframes rubberBand 执行
     * 4. animationend 事件中清理类，防止污染后续状态
     *
     * @param {Element} el 目标 .screen 元素
     */
    function playRubberBand(el) {
        el.classList.remove("rubberBand");
        // 强制回流：读取 offsetWidth 触发同步布局计算
        // 这是 CSS 动画重放的经典技巧，无副作用
        void el.offsetWidth;
        el.classList.add("rubberBand");

        // 动画结束后自动清理
        el.addEventListener("animationend", function handler() {
            el.classList.remove("rubberBand");
            el.removeEventListener("animationend", handler);
        });
    }

    /* ---- 3c. 翻页核心函数 ---- */

    /**
     * 切换到第 n 页
     *
     * 验证逻辑：
     * - Math.max(0, ...) 防止索引 < 0（向上溢出）
     * - Math.min(total - 1, ...) 防止索引 >= total（向下溢出）
     * - 仅当目标页与当前页不同时才执行动画（避免重复翻页）
     *
     * @param {number} n 目标页索引
     */
    function goPage(n) {
        // 边界钳位验证：确保 target 在 [0, total-1] 范围内
        var target = Math.max(0, Math.min(total - 1, n));

        if (target !== page) {
            page = target;
            // translateY(-100vh * page)：每页上移一个视口高度
            wrapper.style.transform = "translateY(-" + (page * 100) + "vh)";
            playRubberBand(pages[page]);
        }
    }

    /* ---- 3d. 输入事件绑定 ---- */

    // 鼠标滚轮
    // deltaY > 0 表示向下滚动 → 下一页；< 0 向上 → 上一页
    window.addEventListener("wheel", function (e) {
        var now = Date.now();
        // 节流验证：冷却时间内忽略所有滚轮事件
        if (now - lastScrollTime < SCROLL_DELAY) return;
        lastScrollTime = now;

        goPage(page + (e.deltaY > 0 ? 1 : -1));
    });

    // 触摸滑动
    var touchStartY = 0;

    window.addEventListener("touchstart", function (e) {
        touchStartY = e.touches[0].clientY;
    });

    window.addEventListener("touchend", function (e) {
        var deltaY = e.changedTouches[0].clientY - touchStartY;
        var now = Date.now();

        /* 两重验证：
         * 1. 滑动距离 < 50px → 视为误触，忽略
         * 2. 冷却时间内 → 节流忽略 */
        if (Math.abs(deltaY) < 50 || now - lastScrollTime < SCROLL_DELAY) return;
        lastScrollTime = now;

        // deltaY < 0 表示手指上滑 → 下一页
        goPage(page + (deltaY < 0 ? 1 : -1));
    });

    // 键盘控制
    window.addEventListener("keydown", function (e) {
        // 向下翻页键：ArrowDown / PageDown / Space
        if (e.key === "ArrowDown" || e.key === "PageDown" || e.key === " ") {
            e.preventDefault();  // 阻止 Space 触发默认滚动
            goPage(page + 1);
        }
        // 向上翻页键：ArrowUp / PageUp
        if (e.key === "ArrowUp" || e.key === "PageUp") {
            e.preventDefault();
            goPage(page - 1);
        }
    });

    // 页面加载时首屏播放入场动画
    window.addEventListener("load", function () {
        if (pages[0]) {
            playRubberBand(pages[0]);
        }
    });

})();


/* ============================================================
   模块 4 — 打字机效果
   神秘乱码打字机（修复完美版 v2.0）
   ============================================================ */
(function () {
    const SCRAMBLE_CHARS = ' █▓▒░╫╪╗╝╚╔║═╬▀■□◇◆▽⊿⟐⟡⧫⬡⬢⏣'.split('');

    // CSS 类名常量，方便维护
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

    // 1. 解析词条并生成乱码所需的 DOM 结构
    function prepareTemplate(phraseText) {
        const tempContainer = document.createElement('div');
        tempContainer.innerHTML = phraseText;

        const globalIndexRef = { count: 0 };
        processNodes(tempContainer, globalIndexRef);

        return { html: tempContainer.innerHTML, totalChars: globalIndexRef.count };
    }

    // 递归处理文本节点
    function processNodes(node, globalIndexRef) {
        const childNodes = Array.from(node.childNodes);
        childNodes.forEach(child => {
            if (child.nodeType === Node.TEXT_NODE) {
                const text = child.nodeValue;
                const parent = child.parentNode;
                const fragment = document.createDocumentFragment();

                for (let i = 0; i < text.length; i++) {
                    const ch = text[i];
                    // 空白字符直接作为文本节点添加，不包裹 span，减少 DOM 数量并保留原生换行行为
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

    // 2. 打字机切入动画
    function typeIn(container, totalChars) {
        return new Promise(resolve => {
            if (totalChars === 0) { resolve(); return; }

            const promises = [];
            // 一次性缓存节点
            const finalEls = Array.from(container.querySelectorAll(`.${CLS.FINAL}`));
            const scrambleEls = Array.from(container.querySelectorAll(`.${CLS.SCRAMBLE}`));

            for (let i = 0; i < totalChars; i++) {
                promises.push(new Promise(res => {
                    const finalEl = finalEls.find(el => el.getAttribute(ATTR.IDX) == i);
                    const scrambleEl = scrambleEls.find(el => el.getAttribute(ATTR.IDX) == i);

                    // 如果找不到元素（理论上不应该发生），直接 resolve
                    if (!finalEl || !scrambleEl) { res(); return; }

                    const startDelay = Math.random() * 4000;
                    const scrambleCount = 2 + Math.floor(Math.random() * 8);
                    const scrambleInterval = 40 + Math.random() * 40;

                    setTimeout(() => {
                        let step = 0;
                        const timer = setInterval(() => {
                            step++;
                            if (step >= scrambleCount) {
                                clearInterval(timer);
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

    // 3. 乱码消散动画
    function glitchOut(container) {
        return new Promise(resolve => {
            const charWraps = Array.from(container.querySelectorAll(`.${CLS.WRAP}`));

            if (charWraps.length === 0) {
                container.style.opacity = '0';
                setTimeout(resolve, 200);
                return;
            }

            const timelines = charWraps.map((wrap) => ({ el: wrap, startAt: Math.random() * 1000 })); // 持续时间
            const startTime = performance.now();
            const charDuration = 250;

            function tick(now) {
                const elapsed = now - startTime;
                let allDone = true;

                timelines.forEach(({ el, startAt }) => {
                    const charElapsed = elapsed - startAt;
                    if (charElapsed < 0) { allDone = false; return; }

                    const progress = Math.min(charElapsed / charDuration, 1);
                    const finalEl = el.querySelector(`.${CLS.FINAL}`);
                    const scrambleEl = el.querySelector(`.${CLS.SCRAMBLE}`);

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
                });

                if (allDone) {
                    container.style.opacity = '0';
                    resolve();
                } else {
                    requestAnimationFrame(tick);
                }
            }
            requestAnimationFrame(tick);
        });
    }

    // 4. 核心控制器
    function initTyperr(container) {
        const itemElements = Array.from(container.querySelectorAll('item'));
        let phrases = [];

        if (itemElements.length > 0) {
            phrases = itemElements.map(el => el.innerHTML.trim());
        } else {
            const rawText = container.innerHTML.trim();
            phrases = rawText.split('&&').map(p => p.trim()).filter(p => p.length > 0);
        }

        if (phrases.length === 0) return;

        // 清空容器，准备开始
        container.innerHTML = '';

        // --- 时间解析逻辑优化 (提前处理，避免循环内重复计算) ---
        const rawInterval = container.getAttribute(ATTR.INTERVAL) || '2000 - 7000';
        let minInterval = 4000;
        let maxInterval = 4000;
        let isFixedTime = true;

        if (rawInterval.includes('-') || rawInterval.includes(',')) {
            const parts = rawInterval.split(/[-,]/); // 兼容中英文逗号和横杠
            minInterval = parseInt(parts[0]) || 2000;
            maxInterval = parseInt(parts[1]) || 6000;
            isFixedTime = false;
        } else {
            const val = parseInt(rawInterval);
            if (!isNaN(val)) {
                minInterval = maxInterval = val;
            }
        }

        const isRandom = container.getAttribute(ATTR.RANDOM) === 'true';
        const templates = phrases.map(phrase => prepareTemplate(phrase));

        let currentIndex = -1;
        let isTransitioning = false;

        function getNextIndex() {
            if (phrases.length === 1) return 0;
            if (isRandom) {
                let idx;
                do { idx = Math.floor(Math.random() * phrases.length); } while (idx === currentIndex && phrases.length > 1);
                return idx;
            } else {
                return (currentIndex + 1) % phrases.length;
            }
        }

        async function showNext() {
            if (isTransitioning) return;
            isTransitioning = true;

            currentIndex = getNextIndex();
            const currentTemplate = templates[currentIndex];

            container.innerHTML = currentTemplate.html;
            container.style.opacity = '1'; // 确保显示

            await typeIn(container, currentTemplate.totalChars);
            isTransitioning = false;
        }

        // 启动逻辑
        if (phrases.length === 1) {
            showNext();
        } else {
            async function loop() {
                // 1. 播放入场动画
                await showNext();

                // 2. 计算停留时间
                let delay = isFixedTime ? minInterval : (minInterval + Math.random() * (maxInterval - minInterval + 1));

                // 3. 停留 -> 消散 -> 递归
                setTimeout(async () => {
                    await glitchOut(container);
                    // 稍微留白后进入下一轮，避免闪烁
                    setTimeout(loop, 400);
                }, delay);
            }
            loop();
        }
    }

    // 5. 观察器
    document.addEventListener('DOMContentLoaded', () => {
        const targets = document.querySelectorAll('.typerr');

        const observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    const target = entry.target;
                    // 防止重复初始化
                    if (!target.dataset.typerrInitialized) {
                        initTyperr(target);
                        target.dataset.typerrInitialized = 'true';
                    }
                    observer.unobserve(target);
                }
            });
        }, { threshold: 0.5 });

        targets.forEach(target => observer.observe(target));
    });
})();