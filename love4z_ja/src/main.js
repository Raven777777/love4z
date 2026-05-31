(function () {
    "use strict";

    var FPS_MONITOR = {
        updateInterval: 500,
        warnThreshold: 5
    };

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


(function () {
    "use strict";

    var RAIN = {
        container: document.getElementById("rain"),
        chars: "ｱｲｳｴｵｶｷｸｹｺｻｼｽｾｿﾀﾁﾂﾃﾅﾆﾇﾈﾉﾊﾋﾌﾍﾎﾏﾐﾑﾒﾓﾔﾕﾖﾗﾘﾙﾚﾛﾜﾝ",
        count: 100,
        sizeMin: 20,
        sizeMax: 40,
        durMin: 2,
        durMax: 5
    };

    function rand(min, max) {
        return Math.random() * (max - min) + min;
    }

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


(function () {
    "use strict";

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
            "#NULL?55: SCHRODINGER\u0027S STATE COLLAPSED",
            "#WARN?01: GLITCH IN THE SPINE",
            "#XPN?0x0: CONSCIOUSNESS OVERFLOW"
        ],
        interval: 5000,
        fadeBefore: 4500,
        posMin: 10,
        posMax: 90
    };

    var lastIndex = -1;

    function updateGhost() {
        var el = GHOST.el;
        var msgs = GHOST.msgs;
        var newIndex;

        do {
            newIndex = (Math.random() * msgs.length) | 0;
        } while (newIndex === lastIndex);

        lastIndex = newIndex;
        el.textContent = msgs[newIndex];

        el.style.cssText =
            "top: " + (GHOST.posMin + Math.random() * (GHOST.posMax - GHOST.posMin)) + "%;" +
            "left: " + (GHOST.posMin + Math.random() * (GHOST.posMax - GHOST.posMin)) + "%;" +
            "opacity: 1";

        setTimeout(function () {
            el.style.opacity = "0";
        }, GHOST.interval - GHOST.fadeBefore);
    }

    updateGhost();
    setInterval(updateGhost, GHOST.interval);

})();


(function () {
    "use strict";

    var page = 0;
    var pages = document.getElementsByClassName("screen");
    var wrapper = document.getElementById("pages");
    var total = pages.length;

    var lastScrollTime = 0;
    var SCROLL_DELAY = 800;

    function playRubberBand(el) {
        el.classList.remove("rubberBand");
        void el.offsetWidth;
        el.classList.add("rubberBand");

        el.addEventListener("animationend", function handler() {
            el.classList.remove("rubberBand");
            el.removeEventListener("animationend", handler);
        });
    }

    function goPage(n) {
        var target = Math.max(0, Math.min(total - 1, n));

        if (target !== page) {
            page = target;
            wrapper.style.transform = "translateY(-" + (page * 100) + "vh)";
            playRubberBand(pages[page]);
        }
    }

    window.addEventListener("wheel", function (e) {
        var now = Date.now();
        if (now - lastScrollTime < SCROLL_DELAY) return;
        lastScrollTime = now;
        goPage(page + (e.deltaY > 0 ? 1 : -1));
    });

    var touchStartY = 0;

    window.addEventListener("touchstart", function (e) {
        touchStartY = e.touches[0].clientY;
    });

    window.addEventListener("touchend", function (e) {
        var deltaY = e.changedTouches[0].clientY - touchStartY;
        var now = Date.now();
        if (Math.abs(deltaY) < 50 || now - lastScrollTime < SCROLL_DELAY) return;
        lastScrollTime = now;
        goPage(page + (deltaY < 0 ? 1 : -1));
    });

    window.addEventListener("keydown", function (e) {
        if (e.key === "ArrowDown" || e.key === "PageDown" || e.key === " ") {
            e.preventDefault();
            goPage(page + 1);
        }
        if (e.key === "ArrowUp" || e.key === "PageUp") {
            e.preventDefault();
            goPage(page - 1);
        }
    });

    window.addEventListener("load", function () {
        if (pages[0]) {
            playRubberBand(pages[0]);
        }
    });

})();


(function () {
    const SCRAMBLE_CHARS = " █▓▒░╫╪╗╝╚╔║═╬▀■□◇◆▽⊿⟐⟡⧫⬡⬢⏣".split("");

    const CLS = {
        WRAP: "char-wrap",
        FINAL: "final",
        SCRAMBLE: "scramble",
        REVEALED: "revealed"
    };

    const ATTR = {
        IDX: "data-typerr-idx",
        INTERVAL: "data-interval",
        RANDOM: "data-random"
    };

    function prepareTemplate(phraseText) {
        const tempContainer = document.createElement("div");
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
                    if (ch === " " || ch === "\n" || ch === "\r" || ch === "\t") {
                        fragment.appendChild(document.createTextNode(ch));
                        continue;
                    }

                    const idx = globalIndexRef.count++;
                    const span = document.createElement("span");
                    span.className = CLS.WRAP;

                    const finalSpan = document.createElement("span");
                    finalSpan.className = CLS.FINAL;
                    finalSpan.setAttribute(ATTR.IDX, idx);
                    finalSpan.textContent = ch;

                    const scrambleSpan = document.createElement("span");
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

    function typeIn(container, totalChars) {
        return new Promise(resolve => {
            if (totalChars === 0) { resolve(); return; }

            const promises = [];
            const finalEls = Array.from(container.querySelectorAll("." + CLS.FINAL));
            const scrambleEls = Array.from(container.querySelectorAll("." + CLS.SCRAMBLE));

            for (let i = 0; i < totalChars; i++) {
                promises.push(new Promise(res => {
                    const finalEl = finalEls.find(el => el.getAttribute(ATTR.IDX) == i);
                    const scrambleEl = scrambleEls.find(el => el.getAttribute(ATTR.IDX) == i);

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
                                scrambleEl.style.display = "none";
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

    function glitchOut(container) {
        return new Promise(resolve => {
            const charWraps = Array.from(container.querySelectorAll("." + CLS.WRAP));

            if (charWraps.length === 0) {
                container.style.opacity = "0";
                setTimeout(resolve, 200);
                return;
            }

            const timelines = charWraps.map((wrap) => ({ el: wrap, startAt: Math.random() * 1000 }));
            const startTime = performance.now();
            const charDuration = 250;

            function tick(now) {
                const elapsed = now - startTime;
                let allDone = true;

                timelines.forEach(({ el, startAt }) => {
                    const charElapsed = elapsed - startAt;
                    if (charElapsed < 0) { allDone = false; return; }

                    const progress = Math.min(charElapsed / charDuration, 1);
                    const finalEl = el.querySelector("." + CLS.FINAL);
                    const scrambleEl = el.querySelector("." + CLS.SCRAMBLE);

                    if (progress < 1) {
                        allDone = false;
                        const opacity = 1 - progress;
                        if (finalEl) finalEl.style.opacity = opacity;

                        if (scrambleEl) {
                            if (Math.random() > 0.5) {
                                scrambleEl.style.display = "";
                                scrambleEl.textContent = SCRAMBLE_CHARS[Math.floor(Math.random() * SCRAMBLE_CHARS.length)];
                                scrambleEl.style.opacity = opacity * 0.35;
                                if (finalEl) finalEl.style.opacity = opacity * 0.7;
                            } else {
                                scrambleEl.style.display = "none";
                            }
                        }
                    } else {
                        if (finalEl) finalEl.style.opacity = 0;
                        if (scrambleEl) scrambleEl.style.display = "none";
                    }
                });

                if (allDone) {
                    container.style.opacity = "0";
                    resolve();
                } else {
                    requestAnimationFrame(tick);
                }
            }
            requestAnimationFrame(tick);
        });
    }

    function initTyperr(container) {
        const itemElements = Array.from(container.querySelectorAll("item"));
        let phrases = [];

        if (itemElements.length > 0) {
            phrases = itemElements.map(el => el.innerHTML.trim());
        } else {
            const rawText = container.innerHTML.trim();
            phrases = rawText.split("&&").map(p => p.trim()).filter(p => p.length > 0);
        }

        if (phrases.length === 0) return;

        container.innerHTML = "";

        const rawInterval = container.getAttribute(ATTR.INTERVAL) || "2000 - 7000";
        let minInterval = 4000;
        let maxInterval = 4000;
        let isFixedTime = true;

        if (rawInterval.includes("-") || rawInterval.includes(",")) {
            const parts = rawInterval.split(/[-,]/);
            minInterval = parseInt(parts[0]) || 2000;
            maxInterval = parseInt(parts[1]) || 6000;
            isFixedTime = false;
        } else {
            const val = parseInt(rawInterval);
            if (!isNaN(val)) {
                minInterval = maxInterval = val;
            }
        }

        const isRandom = container.getAttribute(ATTR.RANDOM) === "true";
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
            container.style.opacity = "1";

            await typeIn(container, currentTemplate.totalChars);
            isTransitioning = false;
        }

        if (phrases.length === 1) {
            showNext();
        } else {
            async function loop() {
                await showNext();

                let delay = isFixedTime ? minInterval : (minInterval + Math.random() * (maxInterval - minInterval + 1));

                setTimeout(async () => {
                    await glitchOut(container);
                    setTimeout(loop, 400);
                }, delay);
            }
            loop();
        }
    }

    document.addEventListener("DOMContentLoaded", () => {
        const targets = document.querySelectorAll(".typerr");

        const observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    const target = entry.target;
                    if (!target.dataset.typerrInitialized) {
                        initTyperr(target);
                        target.dataset.typerrInitialized = "true";
                    }
                    observer.unobserve(target);
                }
            });
        }, { threshold: 0.5 });

        targets.forEach(target => observer.observe(target));
    });
})();
