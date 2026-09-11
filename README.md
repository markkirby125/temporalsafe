# TemporalSafe

Page-level flicker and flash reducer for photosensitive, migraine, and vestibular users.
**Comfort aid — not a medical device and not a diagnosis.**

> Status: **live** (2026-09-11) at https://markkirby125.github.io/temporalsafe/ — demo page and userscript build.

TemporalSafe detects and freezes page-level flicker/flash — blinking text, marquees,
fast CSS animations, and autoplaying video — and pauses or mutes them per element,
always with a "Paused" badge and a per-element "Show" undo.

## Scope (honest)

- Reduces **page content** motion only. It does **not** affect display PWM or OS flicker.
- Does **not** affect cross-origin iframes (labeled only).
- Canvas / `requestAnimationFrame` animation is **best-effort** — never breaks the app.

## Use

- **Userscript:** build with `npm run build`, install `temporalsafe.user.js` in Tampermonkey.
- **Bookmarklet:** on the demo page, press "Copy bookmarklet", create a bookmark, click it on any page.
- **Profiles:** `Reduced` (default, honors `prefers-reduced-motion`) and `Photosensitive`
  (opt-in — also freezes fast blinking text/cursors and pauses autoplay).

## Develop

```bash
npm test        # node --test tests/*.test.mjs
npm run build   # emits temporalsafe.user.js + temporalsafe.bookmarklet.js
```

## License

MIT
