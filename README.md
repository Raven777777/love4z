# Love4z

> **PLZ HUG ME HARD**

A static personal site with 12 full-screen sections, keyboard/touch/wheel navigation, a relationship clock, and decorative rain and text effects. No backend, data storage, or production build.

## Navigation & Accessibility

- Scroll, swipe, or use Arrow Up/Down, Page Up/Down, and Space/Shift+Space.
- Continuous wheel events and held navigation keys keep paging; there is no cooldown or one-page-per-gesture limit.
- Long sections scroll within the page before moving to the next section.
- Tab reveals the section containing the focused link. Paging moves focus with it.
- Without JavaScript, all sections remain in normal document flow.
- Reduced motion uses static headings, a plain hobby list, text clock digits, and no decorative rain or ghost messages. Turning it on stops active text effects; reload after turning it off to restart them.

## Clock

The clock start time is set by `data-start` on `#love-clock` in `index.html`, including its explicit time-zone offset. Times before that date show zero elapsed time.

## License

[MIT](LICENSE)