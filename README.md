# TemporalSafe

**Freeze page-level flicker and flash for photosensitive, migraine, and vestibular users.**

Autoplaying video, blinking text, marquees, and fast CSS animations are common on the modern web. For photosensitive, migraine, or vestibular users, that motion can trigger symptoms or make a page unusable.

TemporalSafe detects and freezes those elements, then pauses or mutes them per element. Each frozen item shows a "Paused" badge and a "Show" undo.

**Status:** live at [markkirby125.github.io/temporalsafe/](https://markkirby125.github.io/temporalsafe/) — demo page and userscript build.

> TemporalSafe is a comfort aid, not a medical device and not a diagnosis.

## Features

- **Per-element freeze** — pauses or mutes blinking text, marquees, fast CSS animations, and autoplaying video.
- **Visible pause badge** — every frozen element gets a "Paused" indicator.
- **Per-element undo** — click "Show" to re-enable a single element.
- **Two profiles:**
  - `Reduced` — default; honors `prefers-reduced-motion`.
  - `Photosensitive` — opt-in; also freezes fast blinking text/cursors and pauses autoplay.
- **Best-effort canvas protection** — attempts to freeze `requestAnimationFrame` loops without breaking the app.
- **Cross-origin iframe labeling** — iframes are labeled but not modified.

## Scope (honest)

- Reduces **page content** motion only. It does **not** affect display PWM or OS flicker.
- Does **not** affect cross-origin iframes (labeled only).
- Canvas / `requestAnimationFrame` animation is **best-effort** — never breaks the app.

## Quick start

### Userscript

Build the script, then install `temporalsafe.user.js` in Tampermonkey (or equivalent):

```bash
npm run build   # emits temporalsafe.user.js + temporalsafe.bookmarklet.js
```

### Bookmarklet

On the demo page, press **Copy bookmarklet**, save it as a browser bookmark, then click it on any page.

## Develop

```bash
npm test        # node --test tests/*.test.mjs
npm run build   # emits temporalsafe.user.js + temporalsafe.bookmarklet.js
```

## Contributing

Open an issue or submit a pull request. If you add a new animation class to the detector, include a test case.

## License

MIT License. See [LICENSE](LICENSE) for details.

## Part of the Vision Apps toolkit

TemporalSafe is one of four accessibility tools in the [Vision Apps](https://github.com/markkirby125/vision-apps) kit.
