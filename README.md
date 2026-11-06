# PLZ HUG ME HARD

A static personal site with 12 full-screen sections, keyboard/touch/wheel navigation,
a relationship clock, and decorative rain and text effects. There is no backend,
data storage, or production build. Serve this directory with any static web server.
WebGPU rain needs browser support and a secure context (HTTPS or localhost);
other desktop browsers use CSS rain.

## Navigation and accessibility

- Scroll, swipe, or use Arrow Up/Down, Page Up/Down, and Space/Shift+Space.
- Continuous wheel events and held navigation keys deliberately keep paging;
  there is no cooldown or one-page-per-gesture limit.
- Long sections scroll within the page before moving to the next section.
- Tab reveals the section containing the focused link. Paging moves focus with it.
- Without JavaScript, all sections remain in normal document flow.
- Reduced motion uses static headings, a plain hobby list, text clock digits,
  and no decorative rain or ghost messages. Turning it on stops active text effects;
  reload after turning it off to restart those effects.

The clock's start time is `data-start` on `#love-clock` in `index.html`, including
its explicit time-zone offset. Times before that date display zero elapsed time.

## Tests

Node.js 22 or newer:

```sh
npm ci
npx playwright install chromium
npm test
```

On Linux, missing browser libraries can be installed with
`npx playwright install-deps chromium` (requires system package permissions).
Playwright is a development-only dependency; deploying the site needs no Node.js.
Tests open the local HTML in Chromium. They cover navigation, scrolling, focus,
reduced motion, clock boundaries, preserved-page lifecycle events, and mocked
WebGPU pause/device-loss behavior. They do not validate real GPU hardware,
actual Back/Forward cache eligibility, or screen-reader speech output.

## Minifier (optional)

`minify_web.py` is a standalone CSS/JS/HTML minifier written with the standard
library only. The site does not need it and does not build with it; it is for
hand-minifying files before copying them somewhere.

```sh
python minify_web.py . --dry-run --verify   # report sizes and check the result
python minify_web.py . --out dist_min       # write to another directory
python minify_web.py --self-test            # built-in checks, exit 1 on failure
```

JavaScript can end a statement at a line break (automatic semicolon insertion),
so the minifier keeps the line breaks that matter: after `return`, `throw`,
`break`, `continue` and `yield`, and before a line that starts with `++` or
`--`. `--verify` only compares tokens, so it cannot see every such mistake —
run `--self-test` after changing the script, and run the site's tests after
minifying `src/main.js` by hand.
