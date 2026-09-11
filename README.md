# TemporalSafe

**Freeze page-level flicker and flash for photosensitive, migraine, and vestibular users.**

Autoplaying video, blinking text, marquees, and fast CSS animations are common on the modern web. For photosensitive, migraine, or vestibular users, that motion can trigger symptoms or make a page unusable.

TemporalSafe detects and freezes those elements, then pauses or mutes them per element. Each frozen item shows a "Paused" badge and a "Show" undo.

## What does TemporalSafe freeze?

TemporalSafe targets moving or flashing page elements that can trigger symptoms in **photosensitive**, **migraine**, or **vestibular** users: autoplaying video, blinking text, marquees, fast CSS animations, and aggressive `requestAnimationFrame` loops. It freezes each element individually and adds a visible "Paused" badge, so the rest of the page remains usable.

**Status:** live at [markkirby125.github.io/temporalsafe/](https://markkirby125.github.io/temporalsafe/) — demo page and userscript build.

*Updated: 2026-09-11*

> TemporalSafe is a comfort aid, not a medical device and not a diagnosis.

## What gets frozen and how

- **Per-element freeze** — pauses or mutes blinking text, marquees, fast CSS animations, and autoplaying video.
- **Visible pause badge** — every frozen element gets a "Paused" indicator.
- **Per-element undo** — click "Show" to re-enable a single element.
- **Two profiles:**
  - `Reduced` — default; honors `prefers-reduced-motion`.
  - `Photosensitive` — opt-in; also freezes fast blinking text/cursors and pauses autoplay.
- **Best-effort canvas protection** — attempts to freeze `requestAnimationFrame` loops without breaking the app.
- **Cross-origin iframe labeling** — iframes are labeled but not modified.

## When should I use the Photosensitive profile?

Use the default `Reduced` profile if you only need to honor the browser's `prefers-reduced-motion` preference. Switch to the `Photosensitive` profile if flashing text, cursors, or autoplaying media trigger symptoms. The Photosensitive profile is opt-in because it freezes more aggressively, including elements that a standard reduced-motion request might leave running.

## Scope (honest)

- Reduces **page content** motion only. It does **not** affect display PWM or OS flicker.
- Does **not** affect cross-origin iframes (labeled only).
- Canvas / `requestAnimationFrame` animation is **best-effort** — never breaks the app.

## How do I install TemporalSafe?

### Userscript

Build the script, then install `temporalsafe.user.js` in Tampermonkey (or equivalent):

```bash
npm run build   # emits temporalsafe.user.js + temporalsafe.bookmarklet.js
```

### Bookmarklet

On the demo page, press **Copy bookmarklet**, save it as a browser bookmark, then click it on any page.

## How do I develop TemporalSafe?

```bash
npm test        # node --test tests/*.test.mjs
npm run build   # emits temporalsafe.user.js + temporalsafe.bookmarklet.js
```

## Contributing

Open an issue or submit a pull request. If you add a new animation class to the detector, include a test case.

## License

MIT License. See [LICENSE](LICENSE) for details.

## Sources

- [W3C. Understanding SC 2.2.2: Pause, Stop, Hide (WCAG 2.2, Level A).](https://www.w3.org/WAI/WCAG22/Understanding/pause-stop-hide.html)
- [MDN. prefers-reduced-motion CSS media feature.](https://developer.mozilla.org/en-US/docs/Web/CSS/@media/prefers-reduced-motion)

## Part of the Vision Apps toolkit

TemporalSafe is the motion-freezing piece of the four-tool [Vision Apps](https://github.com/markkirby125/vision-apps) accessibility kit.

| Project | What it does |
| --- | --- |
| [ChromaCalm](https://github.com/markkirby125/chromacalm) | Zero-install spectral notch filtering for photophobia, migraine and screen halation. |
| [SoftContrast](https://github.com/markkirby125/softcontrast) | Anti-halation reading palettes built on APCA and OKLCH. |
| [terminal-a11y](https://github.com/markkirby125/terminal-a11y) | Screen-reader, photophobia, braille and sensory-budget modes for the command line. |
| [FocusBeacon](https://github.com/markkirby125/focusbeacon) | High-contrast dual-contour focus ring and cursor radar for tunnel vision. |
| [GlareMap](https://github.com/markkirby125/glaremap) | Targeted brightness softening for photophobia and migraine. |
| **TemporalSafe** *(this repo)* | Freeze page-level flicker and flash for photosensitive, migraine, and vestibular users.
