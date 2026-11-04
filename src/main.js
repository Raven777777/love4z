/* ============================================================
   Love4z — 主脚本
   五大模块：
     1. Matrix 数字雨生成器（WebGPU）
     2. Ghost 幽灵错误消息
     3. 全屏翻页系统（滚轮 / 触摸 / 键盘）
     4. 打字机效果
     5. 相恋计时器
   ============================================================ */

/* ============================================================
   模块 1 — 黑客字符雨（WebGPU 实例化渲染）
   1) 字符 Atlas：离屏 2D Canvas 画完整张字库，拷入显存
   2) Instance Buffer：每字符 x / y / 字号 / 字符索引 / 速度
   3) WGSL：顶点着色器把 4 顶点矩形摆到 NDC 并算出 Atlas UV，
      片元着色器采样字符，全部字符只用一次 draw 提交
   不支持 WebGPU（或窄屏 / 减少动效）时退化为 <span> + CSS 动画。
   ============================================================ */

(function () {
    "use strict";

    /* ---- 1a. 配置 ---- */
    var CHARS = "ｱｲｳｴｵｶｷｸｹｺｻｼｽｾｿﾀﾁﾂﾃﾅﾆﾇﾈﾉﾊﾋﾌﾍﾎﾏﾐﾑﾒﾓﾔﾕﾖﾗﾘﾙﾚﾛﾜﾝ013456789";
    var COUNT = 100;   // 同屏下落字符数（加大即可扩容，无需改渲染管线）
    var CELL = 48;     // Atlas 单元格边长
    var COLS = 16;     // Atlas 列数
    var ROWS = Math.ceil(CHARS.length / COLS);
    var STRIDE = 5;    // 每实例 5 个 float32：x, y, size, charIdx, speed
    var MUTATE = 6;    // 每秒每字符随机换字的概率

    var container = document.getElementById("rain");

    // 与 CSS 降级一致：窄屏 / 减少动效不生成雨滴。
    var rainQuery = window.matchMedia("(max-width: 799px), (prefers-reduced-motion: reduce)");
    if (!container || rainQuery.matches) return;

    /**
     * 范围随机数生成
     * @param {number} min 下限（含）
     * @param {number} max 上限（不含）
     * @returns {number} [min, max) 范围内的随机浮点数
     */
    function rand(min, max) {
        return Math.random() * (max - min) + min;
    }

    /* ---- 1b. 降级：CSS 动画的 <span> 雨 ---- */
    function startCssRain() {
        var box = container;

        if (box.tagName === "CANVAS") {
            box = document.createElement("div");
            box.className = "rain";
            box.id = container.id;
            container.parentNode.replaceChild(box, container);
        }

        box.setAttribute("aria-hidden", "true");
        container = box;
        var fragment = document.createDocumentFragment();

        for (var i = 0; i < COUNT; i++) {
            var span = document.createElement("span");
            span.textContent = CHARS[(Math.random() * CHARS.length) | 0];
            span.style.cssText =
                "left: " + rand(0, 100) + "vw;" +
                "font-size: " + rand(20, 40) + "px;" +
                "animation-duration: " + rand(2, 5) + "s";
            fragment.appendChild(span);
        }

        box.replaceChildren(fragment);
    }

    if (container.tagName !== "CANVAS" || !navigator.gpu) {
        startCssRain();
        return;
    }

    /* ---- 1c. WGSL 着色器 ---- */
    var WGSL = `
struct Uniforms {
  screen: vec2<f32>,
  cols: f32,
  rows: f32,
  dpr: f32,
  _pad: f32,
};

@group(0) @binding(0) var<uniform> u: Uniforms;
@group(0) @binding(1) var charSampler: sampler;
@group(0) @binding(2) var charAtlas: texture_2d<f32>;

struct VertexInput {
  @builtin(vertex_index) vertexIndex: u32,
  @location(0) pos: vec2<f32>,
  @location(1) size: f32,
  @location(2) charIdx: f32,
};

struct VertexOutput {
  @builtin(position) clip: vec4<f32>,
  @location(0) uv: vec2<f32>,
};

@vertex
fn vs_main(input: VertexInput) -> VertexOutput {
  var quad = array<vec2<f32>, 4>(
    vec2<f32>(0.0, 0.0),
    vec2<f32>(1.0, 0.0),
    vec2<f32>(0.0, 1.0),
    vec2<f32>(1.0, 1.0)
  );
  let off = quad[input.vertexIndex % 4u];

  // 屏幕像素坐标（CSS 像素 × dpr）转 NDC
  let world = (input.pos + off * input.size) * u.dpr;

  var output: VertexOutput;
  output.clip = vec4<f32>(
    world.x / u.screen.x * 2.0 - 1.0,
    1.0 - world.y / u.screen.y * 2.0,
    0.0,
    1.0
  );

  // 由字符索引定位到 Atlas 中的单元格，再取矩形四角 UV
  let idx = floor(input.charIdx + 0.5);
  let row = floor(idx / u.cols);
  let col = idx - row * u.cols;
  output.uv = vec2<f32>((col + off.x) / u.cols, (row + off.y) / u.rows);
  return output;
}

@fragment
fn fs_main(input: VertexOutput) -> @location(0) vec4<f32> {
  let tex = textureSample(charAtlas, charSampler, input.uv);
  return vec4<f32>(tex.rgb, tex.a * 0.8);
}
`;

    /* ---- 1d. CPU 侧实例数据 ---- */
    var data = new Float32Array(COUNT * STRIDE);
    var uniforms = new Float32Array(6); // [w, h, cols, rows, dpr, pad]

    function resetInstance(i, initial) {
        var o = i * STRIDE;
        data[o] = Math.random() * window.innerWidth;
        data[o + 1] = initial ? Math.random() * window.innerHeight : -CELL;
        data[o + 2] = rand(24, 48);                      // 字符尺寸
        data[o + 3] = (Math.random() * CHARS.length) | 0;
        data[o + 4] = rand(150, 520);                    // 下落速度（像素 / 秒）
    }

    /* ---- 1e. 初始化 ---- */
    start();

    async function start() {
        try {
            var adapter = await navigator.gpu.requestAdapter({ powerPreference: "high-performance" });
            if (!adapter) { startCssRain(); return; }

            var device = await adapter.requestDevice();
            if (rainQuery.matches) { device.destroy(); return; }
            boot(device);
        } catch (err) {
            startCssRain();
        }
    }

    function boot(device) {
        var canvas = container;
        var context = canvas.getContext("webgpu");
        if (!context) { startCssRain(); return; }

        context.configure({
            device: device,
            format: navigator.gpu.getPreferredCanvasFormat(),
            alphaMode: "premultiplied"
        });

        /* 字符 Atlas：2D Canvas 上按网格逐字绘制 */
        var atlas = document.createElement("canvas");
        atlas.width = CELL * COLS;
        atlas.height = CELL * ROWS;

        var actx = atlas.getContext("2d");
        actx.font = "bold 40px monospace";
        actx.fillStyle = "#00ff66";
        actx.textAlign = "center";
        actx.textBaseline = "middle";

        for (var i = 0; i < CHARS.length; i++) {
            actx.fillText(CHARS[i], ((i % COLS) + 0.5) * CELL, (Math.floor(i / COLS) + 0.5) * CELL);
        }

        var atlasTexture = device.createTexture({
            size: [atlas.width, atlas.height, 1],
            format: "rgba8unorm",
            usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST | GPUTextureUsage.RENDER_ATTACHMENT
        });

        device.queue.copyExternalImageToTexture(
            { source: atlas },
            { texture: atlasTexture },
            [atlas.width, atlas.height]
        );

        var sampler = device.createSampler({ magFilter: "linear", minFilter: "linear" });

        uniforms[2] = COLS;
        uniforms[3] = ROWS;

        var uniformBuffer = device.createBuffer({
            size: uniforms.byteLength,
            usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST
        });

        for (var j = 0; j < COUNT; j++) resetInstance(j, true);

        var instanceBuffer = device.createBuffer({
            size: data.byteLength,
            usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST
        });

        var module = device.createShaderModule({ code: WGSL });

        var pipeline = device.createRenderPipeline({
            layout: "auto",
            vertex: {
                module: module,
                entryPoint: "vs_main",
                buffers: [{
                    arrayStride: STRIDE * 4,
                    stepMode: "instance",
                    attributes: [
                        { shaderLocation: 0, offset: 0, format: "float32x2" }, // x, y
                        { shaderLocation: 1, offset: 8, format: "float32" },   // size
                        { shaderLocation: 2, offset: 12, format: "float32" }   // charIdx
                    ]
                }]
            },
            fragment: {
                module: module,
                entryPoint: "fs_main",
                targets: [{
                    format: navigator.gpu.getPreferredCanvasFormat(),
                    blend: {
                        color: { srcFactor: "src-alpha", dstFactor: "one-minus-src-alpha", operation: "add" },
                        alpha: { srcFactor: "one", dstFactor: "one-minus-src-alpha", operation: "add" }
                    }
                }]
            },
            primitive: { topology: "triangle-strip" }
        });

        var bindGroup = device.createBindGroup({
            layout: pipeline.getBindGroupLayout(0),
            entries: [
                { binding: 0, resource: { buffer: uniformBuffer } },
                { binding: 1, resource: sampler },
                { binding: 2, resource: atlasTexture.createView() }
            ]
        });

        function resize() {
            var dpr = Math.min(window.devicePixelRatio || 1, 2);
            canvas.width = Math.max(1, Math.round(window.innerWidth * dpr));
            canvas.height = Math.max(1, Math.round(window.innerHeight * dpr));
            uniforms[0] = canvas.width;
            uniforms[1] = canvas.height;
            uniforms[4] = dpr;
            device.queue.writeBuffer(uniformBuffer, 0, uniforms);
        }

        resize();
        window.addEventListener("resize", resize);

        var alive = true;
        var frameId = 0;
        var last = performance.now();

        function updateRain() {
            cancelAnimationFrame(frameId);
            frameId = 0;
            if (alive && !rainQuery.matches) {
                last = performance.now();
                frameId = requestAnimationFrame(frame);
            }
        }
        rainQuery.addEventListener("change", updateRain);
        device.lost.then(function () {
            alive = false;
            cancelAnimationFrame(frameId);
            window.removeEventListener("resize", resize);
            rainQuery.removeEventListener("change", updateRain);
            startCssRain();
        });

        function frame(now) {
            if (!alive || rainQuery.matches) return;

            var dt = Math.min((now - last) / 1000, 0.05);
            last = now;

            // 更新下落位置 / 随机换字，整块回写显存
            var viewportHeight = window.innerHeight;

            for (var k = 0; k < COUNT; k++) {
                var o = k * STRIDE;
                data[o + 1] += data[o + 4] * dt;
                if (Math.random() < MUTATE * dt) data[o + 3] = (Math.random() * CHARS.length) | 0;
                if (data[o + 1] > viewportHeight) resetInstance(k, false);
            }
            device.queue.writeBuffer(instanceBuffer, 0, data);

            var encoder = device.createCommandEncoder();
            var pass = encoder.beginRenderPass({
                colorAttachments: [{
                    view: context.getCurrentTexture().createView(),
                    clearValue: { r: 0, g: 0, b: 0, a: 0 },
                    loadOp: "clear",
                    storeOp: "store"
                }]
            });

            pass.setPipeline(pipeline);
            pass.setBindGroup(0, bindGroup);
            pass.setVertexBuffer(0, instanceBuffer);
            pass.draw(4, COUNT, 0, 0); // 4 顶点 × COUNT 实例，一次 draw
            pass.end();

            device.queue.submit([encoder.finish()]);
            frameId = requestAnimationFrame(frame);
        }

        updateRain();
    }

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

        var top = GHOST.posMin + Math.random() * (GHOST.posMax - GHOST.posMin);
        var left = GHOST.posMin + Math.random() * (GHOST.posMax - GHOST.posMin);
        // 文字框最宽 min(90vw, 700px)（见 CSS #ghost），钳在屏内，不伸出右下角
        el.style.cssText =
            "top: min(" + top + "%, calc(100vh - 8rem));" +
            "left: min(" + left + "%, calc(100vw - min(90vw, 700px)));" +
            "opacity: 1";

        if (fadeTimer) clearTimeout(fadeTimer);
        fadeTimer = setTimeout(function () {
            fadeTimer = 0;
            el.style.opacity = "0";
        }, GHOST.fadeDelay);
    }

    updateGhost();
    var ghostInterval = setInterval(updateGhost, GHOST.interval);
    window.addEventListener("pagehide", function (event) {
        if (event.persisted) return;
        clearInterval(ghostInterval);
        if (fadeTimer) clearTimeout(fadeTimer);
    });

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

    document.documentElement.classList.add("js");
    for (var i = 0; i < total; i++) pages[i].tabIndex = -1;

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

        el.addEventListener("animationend", function handler(e) {
            // animationend 会冒泡：只认自己身上那个 rubberBand，
            // 否则页内元素（如计时器数字的 digit-pop）结束时会把弹性动画提前收掉
            if (e.target !== el || e.animationName !== "rubberBand") return;

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
            if (!screen.contains(document.activeElement)) screen.focus({ preventScroll: true });
            playRubberBand(screen);
        }

        // 通知打字机等模块：当前屏进入可视（transform 翻页下 IO 不一定可靠）
        window.dispatchEvent(new CustomEvent("love4z:pagechange", {
            detail: { page: page, screen: screen }
        }));
    }

    function canScroll(delta) {
        var screen = pages[page];
        return delta > 0
            ? screen.scrollTop + screen.clientHeight < screen.scrollHeight - 1
            : screen.scrollTop > 1;
    }

    // 设计上允许滚轮连续事件和键盘长按连续翻页，不加冷却或合并手势，以保持流畅。
    function requestPage(delta) {
        goPage(page + delta);
    }

    /* ---- 3d. 输入事件绑定 ---- */

    wrapper.addEventListener("focusin", function (e) {
        var screen = e.target.closest(".screen");
        if (screen && screen !== pages[page]) goPage(Array.from(pages).indexOf(screen));
    });

    window.addEventListener("wheel", function (e) {
        if (e.ctrlKey || Math.abs(e.deltaY) <= Math.abs(e.deltaX)) return;
        var delta = e.deltaY > 0 ? 1 : -1;
        if (canScroll(delta)) return;
        e.preventDefault();
        requestPage(delta);
    }, { passive: false });

    var touchStartY = null;
    var touchStartScroll = 0;

    window.addEventListener("touchstart", function (e) {
        touchStartY = e.touches.length === 1 ? e.touches[0].clientY : null;
        touchStartScroll = pages[page].scrollTop;
    }, { passive: true });

    window.addEventListener("touchcancel", function () {
        touchStartY = null;
    }, { passive: true });

    window.addEventListener("touchend", function (e) {
        var t = e.changedTouches && e.changedTouches[0];
        if (!t || touchStartY === null) return;

        var deltaY = touchStartY - t.clientY;
        touchStartY = null;
        if (Math.abs(deltaY) < 50 || canScroll(deltaY) || pages[page].scrollTop !== touchStartScroll) return;

        requestPage(deltaY > 0 ? 1 : -1);
    }, { passive: true });

    window.addEventListener("keydown", function (e) {
        if (e.defaultPrevented || e.ctrlKey || e.altKey || e.metaKey ||
            (e.target instanceof Element && e.target.closest("input, textarea, select, [contenteditable]"))) return;
        if (e.key === " " && e.target instanceof Element && e.target.closest("button")) return;
        var delta = 0;
        if (e.key === "ArrowDown" || e.key === "PageDown" || (e.key === " " && !e.shiftKey)) delta = 1;
        if (e.key === "ArrowUp" || e.key === "PageUp" || (e.key === " " && e.shiftKey)) delta = -1;
        if (!delta) return;
        e.preventDefault();
        if (canScroll(delta)) {
            pages[page].scrollBy(0, delta * (e.key.startsWith("Arrow") ? 40 : pages[page].clientHeight));
        } else {
            requestPage(delta);
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
    const motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    const SCRAMBLE_CHARS = ' █▓▒░╫╪╗╝╚╔║═╬▀■□◇◆▽⊿⟐⟡⧫⬡⬢⏣'.split('');

    const CLS = {
        WRAP: 'char-wrap',
        FINAL: 'final',
        SCRAMBLE: 'scramble',
        REVEALED: 'revealed'
    };

    const ATTR = {
        IDX: 'data-typerr-idx'
    };

    // 当前可见的 screen（翻页时由 love4z:pagechange 更新）。
    // 离屏的 typerr 只冻结状态、不写 DOM——否则每个已访问过的屏幕都在后台空转。
    let activeScreen = document.querySelector('.screen');

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
                    scrambleSpan.setAttribute('aria-hidden', 'true');
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

            const finalEls = [];
            const scrambleEls = [];
            container.querySelectorAll(`.${CLS.FINAL}`).forEach(el => {
                finalEls[Number(el.getAttribute(ATTR.IDX))] = el;
            });
            container.querySelectorAll(`.${CLS.SCRAMBLE}`).forEach(el => {
                scrambleEls[Number(el.getAttribute(ATTR.IDX))] = el;
            });

            if (motionQuery.matches) {
                finalEls.forEach(el => el && el.classList.add(CLS.REVEALED));
                scrambleEls.forEach(el => el && (el.style.display = 'none'));
                resolve();
                return;
            }

            const timelines = finalEls.map((finalEl, i) => ({
                finalEl,
                scrambleEl: scrambleEls[i],
                startAt: Math.random() * 4000,
                steps: 2 + Math.floor(Math.random() * 8),
                interval: 40 + Math.random() * 40,
                lastStep: 0
            }));
            const startTime = state.now();

            function tick(now) {
                let allDone = true;
                timelines.forEach(item => {
                    if (!item.finalEl || !item.scrambleEl) return;
                    const step = Math.max(0, Math.floor((now - startTime - item.startAt) / item.interval));
                    if (step < item.steps) allDone = false;
                    if (step === item.lastStep || item.lastStep >= item.steps) return;
                    item.lastStep = step;
                    if (step >= item.steps) {
                        item.scrambleEl.style.display = 'none';
                        item.finalEl.classList.add(CLS.REVEALED);
                    } else {
                        item.scrambleEl.textContent = SCRAMBLE_CHARS[Math.floor(Math.random() * SCRAMBLE_CHARS.length)];
                    }
                });
                if (allDone) resolve();
                else state.requestFrame(tick);
            }
            state.requestFrame(tick);
        });
    }

    function glitchOut(container, state) {
        return new Promise(resolve => {
            if (motionQuery.matches) {
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
            const startTime = state.now();
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

        if (motionQuery.matches) {
            container.innerHTML = phrases[0];
            return;
        }

        container.innerHTML = '';

        // 每句话停留（展示已揭示文本）的随机区间，毫秒
        const DELAY_MIN = 2000;
        const DELAY_MAX = 7000;

        const templates = phrases.map(phrase => prepareTemplate(phrase));

        let currentIndex = -1;
        let isTransitioning = false;
        const state = {
            disposed: false,
            screen: container.closest('.screen'),
            timers: new Set(),
            frameId: 0,
            frameCallback: null,
            pausedAt: null,
            pausedDuration: 0,
            now() {
                return (this.pausedAt === null ? performance.now() : this.pausedAt) - this.pausedDuration;
            },
            setTimeout(callback, delay) {
                const id = window.setTimeout(() => {
                    this.timers.delete(id);
                    if (!this.disposed) callback();
                }, delay);
                this.timers.add(id);
                return id;
            },
            requestFrame(callback) {
                this.frameCallback = callback;
                if (this.disposed || this.pausedAt !== null) return;
                this.frameId = window.requestAnimationFrame(() => {
                    this.frameId = 0;
                    this.frameCallback = null;
                    if (!this.disposed) callback(this.now());
                });
            },
            dispose() {
                this.disposed = true;
                this.timers.forEach(id => window.clearTimeout(id));
                window.cancelAnimationFrame(this.frameId);
                this.timers.clear();
                this.frameCallback = null;
                window.removeEventListener('love4z:pagechange', syncVisibility);
            }
        };

        function syncVisibility() {
            if (state.screen && state.screen !== activeScreen) {
                if (state.pausedAt === null) state.pausedAt = performance.now();
                window.cancelAnimationFrame(state.frameId);
                state.frameId = 0;
            } else {
                if (state.pausedAt !== null) {
                    state.pausedDuration += performance.now() - state.pausedAt;
                    state.pausedAt = null;
                }
                if (state.frameCallback && !state.frameId) state.requestFrame(state.frameCallback);
            }
        }
        window.addEventListener('love4z:pagechange', syncVisibility);
        syncVisibility();

        window.addEventListener('pagehide', event => {
            if (!event.persisted) state.dispose();
        });
        motionQuery.addEventListener('change', event => {
            if (!event.matches) return;
            state.dispose();
            container.innerHTML = phrases[0];
            container.style.opacity = '1';
        }, { once: true });

        function getNextIndex() {
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

                const delay = DELAY_MIN + Math.random() * (DELAY_MAX - DELAY_MIN + 1);

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
            activeScreen = screen || activeScreen;
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


/* ============================================================
   模块 5 — 相恋计时器（S4）
   把 <elapsed time 2026 1 月 16 日 21:04:32> 换成一块会走的表：
     * 起点读 #love-clock 的 data-start（2026-01-16T21:04:32+08:00）
     * 显示天 / 时 / 分 / 秒，每位数字是 src/rule34/<数字>.gif 的像素小人
     * 只有数字真的变了才换图：没变的那几位 GIF 继续播放，不会每秒重头开始
     * rAF 每帧比对"总秒数"，按 Date.now() 重算，长时间挂着也不会累积漂移；
       标签页切到后台时 rAF 自动停摆，回来当帧追平
   ============================================================ */

(function () {
    "use strict";

    var root = document.getElementById("love-clock");
    if (!root) return;

    var start = new Date(root.getAttribute("data-start") || "");
    if (isNaN(start.getTime())) return;

    var START_MS = start.getTime();
    var DIR = "src/rule34/";

    // 单位表：min = 初始数字位数，pad = 补零宽度（0 表示不补零）
    var UNITS = [
        { key: "day", label: "天", min: 1, pad: 0 },
        { key: "hour", label: "时", min: 2, pad: 2 },
        { key: "minute", label: "分", min: 2, pad: 2 },
        { key: "second", label: "秒", min: 2, pad: 2 }
    ];

    /* ---- 5a. 预热 10 张数字 GIF，首次换字不闪白 ---- */
    // 数组只为保住引用，别让图片对象被 GC 掉
    var preload = [];
    for (var i = 0; i < 10; i++) {
        var img = new Image();
        img.src = DIR + i + ".gif";
        preload.push(img);
    }

    /* ---- 5b. 搭骨架：数字位 + 单位标签 + 读屏文本 ---- */
    var slots = {};

    /**
     * 造一个数字位
     * @param {HTMLElement} row 所属的 .clock-digits
     * @returns {HTMLElement} 空 <span>，等 write() 挂背景图
     */
    function makeDigit(row) {
        var digit = document.createElement("span");
        digit.className = "clock-digit";
        row.appendChild(digit);
        return digit;
    }

    UNITS.forEach(function (unit) {
        var box = document.createElement("div");
        box.className = "clock-unit";

        var row = document.createElement("div");
        row.className = "clock-digits";
        row.setAttribute("aria-hidden", "true");

        var digits = [];
        for (var n = 0; n < unit.min; n++) digits.push(makeDigit(row));

        var label = document.createElement("span");
        label.className = "clock-unit-label";
        label.textContent = unit.label;

        box.appendChild(row);
        box.appendChild(label);
        root.appendChild(box);

        slots[unit.key] = { row: row, digits: digits, text: "" };
    });

    var readout = document.createElement("span");
    readout.className = "visually-hidden";
    root.appendChild(readout);

    /* ---- 5c. 渲染：只改真正变化的那几位 ---- */

    /**
     * 数字换图时播放翻牌弹跳
     * @param {HTMLElement} el 数字位
     */
    function pop(el) {
        el.classList.remove("is-changed");
        void el.offsetWidth;
        el.classList.add("is-changed");
    }

    /**
     * 写入某个单位的读数，按位比较，未变的位不动（GIF 动画因此不中断）
     * @param {string} key 单位 key（day / hour / minute / second）
     * @param {string} text 已格式化的数字串
     */
    function write(key, text) {
        var slot = slots[key];

        // 位数变化（例如第 1000 天）时补位或收位
        while (slot.digits.length < text.length) slot.digits.push(makeDigit(slot.row));
        while (slot.digits.length > text.length) slot.row.removeChild(slot.digits.pop());

        for (var n = 0; n < text.length; n++) {
            var ch = text.charAt(n);
            if (slot.text.charAt(n) === ch) continue;

            slot.digits[n].setAttribute("data-digit", ch);
            slot.digits[n].style.backgroundImage = 'url("' + DIR + ch + '.gif")';
            pop(slot.digits[n]);
        }

        slot.text = text;
    }

    /**
     * 左侧补零
     * @param {number} value 数值
     * @param {number} width 目标宽度，0 表示不补
     * @returns {string} 数字串
     */
    function pad(value, width) {
        var text = String(value);
        while (text.length < width) text = "0" + text;
        return text;
    }

    /**
     * 把"在一起的总秒数"拆成天 / 时 / 分 / 秒并写入 DOM
     * @param {number} totalSeconds 自起点的总秒数（负数按 0 处理）
     */
    function render(totalSeconds) {
        var total = Math.max(0, Math.floor(totalSeconds));

        var values = {
            day: Math.floor(total / 86400),
            hour: Math.floor(total / 3600) % 24,
            minute: Math.floor(total / 60) % 60,
            second: total % 60
        };

        UNITS.forEach(function (unit) {
            write(unit.key, pad(values[unit.key], unit.pad));
        });

        readout.textContent =
            values.day + " 天 " + values.hour + " 时 " + values.minute + " 分 " + values.second + " 秒";
    }

    /* ---- 5d. 走表：每帧比对总秒数，变了才重绘 ---- */
    var lastTotal = -1;
    var frameId = 0;

    function frame() {
        frameId = requestAnimationFrame(frame);

        var total = Math.floor((Date.now() - START_MS) / 1000);
        if (total === lastTotal) return;

        lastTotal = total;
        render(total);
    }

    frame();

    window.addEventListener("pagehide", function (event) {
        if (event.persisted) return;
        cancelAnimationFrame(frameId);
    });

})();
