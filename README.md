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
