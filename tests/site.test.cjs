const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { pathToFileURL } = require('node:url');
const path = require('node:path');
const { chromium } = require('playwright');

const site = pathToFileURL(path.join(__dirname, '..', 'index.html')).href;
let browser;
before(async () => { browser = await chromium.launch(); });
after(async () => { await browser?.close(); });

async function open(t, options = {}, setup) {
    const page = await browser.newPage({ viewport: { width: 1280, height: 900 }, ...options });
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    t.after(async () => {
        await page.close();
        assert.deepEqual(errors, [], 'no uncaught browser errors');
    });
    if (options.javaScriptEnabled !== false) {
        await page.clock.install({ time: new Date('2026-01-18T00:07:36+08:00') });
        await page.addInitScript(() => {
            Object.defineProperty(navigator, 'gpu', { value: undefined, configurable: true });
            window.changes = [];
            window.addEventListener('love4z:pagechange', event => window.changes.push(event.detail.page));
        });
    }
    if (setup) await setup(page);
    await page.goto(site);
    return page;
}

async function current(page) {
    return page.evaluate(() => window.changes.at(-1));
}

async function next(page) {
    await page.clock.runFor(900);
    await page.keyboard.press('PageDown');
}

async function motion(page, reducedMotion) {
    await page.evaluate(() => {
        window.motionChanged = new Promise(resolve => {
            matchMedia('(prefers-reduced-motion: reduce)').addEventListener('change', () => resolve(), { once: true });
        });
    });
    await page.emulateMedia({ reducedMotion });
    await page.evaluate(() => window.motionChanged);
}

test('consecutive wheel events page without throttling; horizontal motion and zoom do not navigate', async t => {
    const page = await open(t);
    await page.evaluate(() => {
        for (let i = 0; i < 3; i++) window.dispatchEvent(new WheelEvent('wheel', { deltaY: 5 }));
    });
    assert.equal(await current(page), 3);
    await page.evaluate(() => {
        window.dispatchEvent(new WheelEvent('wheel', { deltaX: 20 }));
        window.dispatchEvent(new WheelEvent('wheel', { deltaY: 20, ctrlKey: true }));
        window.dispatchEvent(new WheelEvent('wheel'));
    });
    assert.equal(await current(page), 3);
    await page.evaluate(() => window.dispatchEvent(new WheelEvent('wheel', { deltaY: -20 })));
    assert.equal(await current(page), 2);
});

test('rapid key presses and held navigation keys keep paging without a cooldown', async t => {
    const page = await open(t);
    for (const key of ['ArrowDown', 'PageDown', 'Space']) {
        await page.keyboard.down(key);
        await page.keyboard.down(key);
        await page.keyboard.up(key);
    }
    assert.equal(await current(page), 6);
    for (const key of ['ArrowUp', 'PageUp', 'Space']) {
        if (key === 'Space') await page.keyboard.down('Shift');
        await page.keyboard.down(key);
        await page.keyboard.down(key);
        await page.keyboard.up(key);
    }
    await page.keyboard.up('Shift');
    assert.equal(await current(page), 0);
});

test('short screens scroll content before paging, with no clipped top', async t => {
    const page = await open(t, { viewport: { width: 390, height: 600 }, reducedMotion: 'reduce' });
    await next(page);
    await next(page);
    await page.clock.runFor(900);
    const screen = page.locator('.screen').nth(2);
    assert.ok(await screen.evaluate(el => el.scrollHeight > el.clientHeight));
    assert.ok(await screen.evaluate(el => el.firstElementChild.getBoundingClientRect().top >= el.getBoundingClientRect().top - 1));
    await page.keyboard.press('PageDown');
    assert.equal(await current(page), 2);
    assert.ok(await screen.evaluate(el => el.scrollTop > 0));
    assert.ok(await screen.evaluate(el => el.firstElementChild.getBoundingClientRect().bottom <= el.getBoundingClientRect().bottom + 1));
    await next(page);
    assert.equal(await current(page), 3);
});

test('orbiting decorations do not create false content scrolling', async t => {
    const page = await open(t, { viewport: { width: 390, height: 600 } });
    await next(page);
    const screen = page.locator('.screen').nth(1);
    for (let i = 0; i < 20; i++) {
        await page.clock.runFor(500);
        assert.ok(await screen.evaluate(el => el.scrollHeight <= el.clientHeight + 1));
    }
    await page.keyboard.press('PageDown');
    assert.equal(await current(page), 2);
});

test('Tab reveals an offscreen link and keyboard paging moves focus to the visible screen', async t => {
    const page = await open(t, { reducedMotion: 'reduce' });
    const link = page.locator('a');
    await page.keyboard.press('Tab');
    assert.equal(await link.evaluate(el => el === document.activeElement), true);
    assert.equal(await current(page), 10);
    await page.clock.runFor(900);
    assert.ok(await link.evaluate(el => { const r = el.getBoundingClientRect(); return r.top >= 0 && r.bottom <= innerHeight; }));
    await page.keyboard.press('PageDown');
    assert.equal(await current(page), 11);
    assert.equal(await page.locator('.screen').nth(11).evaluate(el => el === document.activeElement), true);
});

test('multitouch and cancelled swipes do not navigate; a single swipe does', async t => {
    const page = await open(t);
    await page.evaluate(() => {
        const touch = (id, y) => new Touch({ identifier: id, target: document.body, clientY: y });
        window.dispatchEvent(new TouchEvent('touchstart', { touches: [touch(1, 300)] }));
        window.dispatchEvent(new TouchEvent('touchstart', { touches: [touch(1, 300), touch(2, 310)] }));
        window.dispatchEvent(new TouchEvent('touchend', { changedTouches: [touch(1, 100)] }));
        window.dispatchEvent(new TouchEvent('touchstart', { touches: [touch(1, 300)] }));
        window.dispatchEvent(new TouchEvent('touchcancel'));
        window.dispatchEvent(new TouchEvent('touchend', { changedTouches: [touch(1, 100)] }));
    });
    assert.equal(await current(page), 0);
    await page.evaluate(() => {
        const touch = y => new Touch({ identifier: 1, target: document.body, clientY: y });
        window.dispatchEvent(new TouchEvent('touchstart', { touches: [touch(300)] }));
        window.dispatchEvent(new TouchEvent('touchend', { changedTouches: [touch(100)] }));
    });
    assert.equal(await current(page), 1);
});

test('cached page hides preserve clock and typewriter; final unload still cleans up', async t => {
    const page = await open(t);
    const readout = page.locator('#love-clock .visually-hidden');
    const original = await readout.textContent();
    await page.evaluate(() => {
        for (let i = 0; i < 2; i++) {
            window.dispatchEvent(new PageTransitionEvent('pagehide', { persisted: true }));
            window.dispatchEvent(new PageTransitionEvent('pageshow', { persisted: true }));
        }
    });
    await page.clock.runFor(6000);
    assert.notEqual(await readout.textContent(), original);
    assert.ok(await page.locator('.screen').first().locator('.final.revealed').count() > 0);
    await page.evaluate(() => window.dispatchEvent(new PageTransitionEvent('pagehide', { persisted: false })));
    const stopped = await readout.textContent();
    await page.clock.runFor(2000);
    assert.equal(await readout.textContent(), stopped);
});

test('reduced motion shows stable text, non-overlapping hobbies and plain clock digits', async t => {
    const page = await open(t, { viewport: { width: 320, height: 568 }, reducedMotion: 'reduce' });
    const heading = page.locator('.typerr').first();
    const original = await heading.innerHTML();
    await page.clock.runFor(20000);
    assert.equal(await heading.innerHTML(), original);
    assert.equal(await heading.locator('.char-wrap').count(), 0);
    const styles = await page.locator('.word-cloud span').evaluateAll(els => els.map(el => ({ position: getComputedStyle(el).position, transform: getComputedStyle(el).transform })));
    assert.ok(styles.every(style => style.position === 'static' && style.transform === 'none'));
    const overlaps = await page.locator('.word-cloud span').evaluateAll(els => {
        const rects = els.map(el => el.getBoundingClientRect());
        return rects.some((a, i) => rects.slice(i + 1).some(b => a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top));
    });
    assert.equal(overlaps, false);
    assert.ok(await page.locator('.clock-digit').evaluateAll(els => els.every(el => getComputedStyle(el).backgroundImage === 'none' && getComputedStyle(el, '::before').content.includes(el.dataset.digit))));
    assert.equal(await page.locator('#ghost').evaluate(el => getComputedStyle(el).display), 'none');
});

test('enabling reduced motion stops typewriter changes and hides rain immediately', async t => {
    const page = await open(t);
    assert.equal(await page.locator('#rain').getAttribute('aria-hidden'), 'true');
    assert.equal(await page.locator('.scramble:not([aria-hidden="true"])').count(), 0);
    await motion(page, 'reduce');
    await page.clock.runFor(100);
    const original = await page.locator('.typerr').first().innerHTML();
    await page.clock.runFor(20000);
    assert.equal(await page.locator('.typerr').first().innerHTML(), original);
    assert.equal(await page.locator('#rain').evaluate(el => getComputedStyle(el).display), 'none');
});

test('offscreen typewriters stop scheduled animation work and resume on re-entry', async t => {
    const page = await open(t, {}, async page => {
        await page.addInitScript(() => {
            let seed = 42;
            Math.random = () => ((seed = (1664525 * seed + 1013904223) >>> 0) / 4294967296);
            window.backgroundCallbacks = 0;
            const interval = window.setInterval;
            window.setInterval = (callback, delay) => interval(() => { window.backgroundCallbacks++; callback(); }, delay);
            const frame = window.requestAnimationFrame;
            window.requestAnimationFrame = callback => frame(now => { window.backgroundCallbacks++; callback(now); });
        });
    });
    await next(page);
    await page.clock.runFor(2000);
    const frozen = await page.locator('.typerr').first().innerHTML();
    const before = await page.evaluate(() => window.backgroundCallbacks);
    await page.clock.runFor(1000);
    const callbacks = await page.evaluate(() => window.backgroundCallbacks);
    assert.ok(callbacks - before <= 65, 'only the clock schedules frames; no offscreen character work');
    assert.equal(await page.locator('.typerr').first().innerHTML(), frozen);
    await page.keyboard.press('PageUp');
    await page.clock.runFor(4000);
    assert.ok(await page.locator('.typerr').first().locator('.final.revealed').count() > 0);
});

test('WebGPU rain pauses on reduced motion, resumes, and falls back after device loss', async t => {
    const page = await open(t, {}, async page => {
        await page.addInitScript(() => {
            window.gpuDraws = 0;
            const pass = { setPipeline() {}, setBindGroup() {}, setVertexBuffer() {}, draw() {}, end() {} };
            const device = {
                lost: new Promise(resolve => { window.loseGpu = resolve; }),
                queue: { copyExternalImageToTexture() {}, writeBuffer() {}, submit() { window.gpuDraws++; } },
                createTexture: () => ({ createView() {} }),
                createSampler() {}, createBuffer() {}, createShaderModule() {},
                createRenderPipeline: () => ({ getBindGroupLayout() {} }),
                createBindGroup() {},
                createCommandEncoder: () => ({ beginRenderPass: () => pass, finish() {} })
            };
            Object.defineProperty(navigator, 'gpu', { configurable: true, value: {
                requestAdapter: async () => ({ requestDevice: async () => device }),
                getPreferredCanvasFormat: () => 'rgba8unorm'
            } });
            const getContext = HTMLCanvasElement.prototype.getContext;
            HTMLCanvasElement.prototype.getContext = function (type, ...args) {
                return type === 'webgpu' ? { configure() {}, getCurrentTexture: () => ({ createView() {} }) } : getContext.call(this, type, ...args);
            };
        });
    });
    await page.clock.runFor(100);
    assert.ok(await page.evaluate(() => window.gpuDraws > 0));
    await motion(page, 'reduce');
    await page.clock.runFor(100);
    const paused = await page.evaluate(() => window.gpuDraws);
    await page.clock.runFor(1000);
    assert.equal(await page.evaluate(() => window.gpuDraws), paused);
    await motion(page, 'no-preference');
    await page.clock.runFor(100);
    assert.ok(await page.evaluate(() => window.gpuDraws) > paused);
    await page.evaluate(() => window.loseGpu({ reason: 'unknown' }));
    assert.equal(await page.locator('#rain').evaluate(el => el.tagName), 'DIV');
    assert.equal(await page.locator('#rain').getAttribute('aria-hidden'), 'true');
    assert.equal(await page.locator('#rain span').count(), 100);
});

test('clock handles day/hour/minute rollover, future dates and expanding day digits', async t => {
    const page = await open(t, { reducedMotion: 'reduce' });
    const readout = page.locator('#love-clock .visually-hidden');
    assert.equal(await readout.textContent(), '1 天 3 时 3 分 4 秒');
    // 时钟每秒整点醒来，所以改系统时间后等 1 秒再读
    await page.clock.setSystemTime(new Date('2026-01-18T21:04:30+08:00'));
    await page.clock.runFor(1000);
    assert.equal(await readout.textContent(), '1 天 23 时 59 分 59 秒');
    await page.clock.runFor(1000);
    assert.equal(await readout.textContent(), '2 天 0 时 0 分 0 秒');
    await page.clock.setSystemTime(new Date('2026-01-01T00:00:00+08:00'));
    await page.clock.runFor(1000);
    assert.equal(await readout.textContent(), '0 天 0 时 0 分 0 秒');
    await page.clock.setSystemTime(new Date(new Date('2026-01-16T21:04:32+08:00').getTime() + 1000 * 86400000 - 1000));
    await page.clock.runFor(1000);
    assert.equal(await readout.textContent(), '1000 天 0 时 0 分 0 秒');
    assert.equal(await page.locator('.clock-digits').first().locator('.clock-digit').count(), 4);
});

test('clock touches only the digits that changed, so unchanged GIFs keep playing', async t => {
    const page = await open(t);
    const tens = () => page.locator('#love-clock .clock-digits').nth(3).locator('.clock-digit').nth(0);
    const ones = () => page.locator('#love-clock .clock-digits').nth(3).locator('.clock-digit').nth(1);
    await page.evaluate(() => {
        const [tensEl, onesEl] = document.querySelectorAll('#love-clock .clock-digits')[3].children;
        window.changedAttrs = { tens: [], ones: [] };
        new MutationObserver(records => window.changedAttrs.tens.push(...records)).observe(tensEl, { attributes: true });
        new MutationObserver(records => window.changedAttrs.ones.push(...records)).observe(onesEl, { attributes: true });
    });
    await page.clock.runFor(1000);
    assert.equal(await tens().getAttribute('data-digit'), '0');
    assert.equal(await ones().getAttribute('data-digit'), '5');
    assert.equal(await page.evaluate(() => window.changedAttrs.tens.length), 0, 'unchanged tens digit is not touched');
    assert.ok(await page.evaluate(() => window.changedAttrs.ones.length) > 0, 'changed ones digit is updated');
});

test('without JavaScript, short sections grow and never overlap or clip content', async t => {
    const page = await open(t, { javaScriptEnabled: false, viewport: { width: 320, height: 568 }, reducedMotion: 'reduce' });
    await page.locator('img').evaluateAll(els => Promise.all(els.map(el => el.decode())));
    assert.ok(await page.locator('.screen').evaluateAll(els => els.every(el => el.clientHeight >= el.querySelector('.page-content').offsetHeight)));
    assert.ok(await page.locator('.screen').evaluateAll(els => els.every((el, i) => !i || el.getBoundingClientRect().top >= els[i - 1].getBoundingClientRect().bottom - 1)));
});
