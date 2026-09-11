/**
 * TemporalSafe — page-level flicker/flash reducer.
 * Pure classifier/reducer/allowlist logic plus the userscript runtime.
 * No dependencies, no network calls. Runs in browser and Node (tests).
 */

export const PROFILES = { REDUCED: 'reduced', PHOTOSENSITIVE: 'photosensitive' };

/** '0.2s' → 200, '300ms' → 300, '0' → 0. Returns 0 for anything unparseable. */
export function parseDuration(str) {
  if (typeof str !== 'string') return 0;
  const m = str.trim().match(/^([\d.]+)\s*(ms|s)?$/i);
  if (!m) return 0;
  const n = parseFloat(m[1]);
  if (!Number.isFinite(n)) return 0;
  return (m[2] || '').toLowerCase() === 'ms' ? n : n * 1000;
}

/** True when a CSS animation/transition is fast and repeats (flicker risk). */
export function isFastFlashingStyle(style, floorMs = 400) {
  const animMs = parseDuration(style?.animationDuration);
  const iter = String(style?.animationIterationCount || '');
  const transMs = parseDuration(style?.transitionDuration);
  const fastAnim = animMs > 0 && animMs < floorMs && (iter === 'infinite' || (Number(iter) > 3));
  const fastTrans = transMs > 0 && transMs < floorMs;
  return fastAnim || fastTrans;
}

/** Classify one element from its tag + computed style. Pure and clock-free. */
export function classifyElement(el, style, profile = PROFILES.REDUCED) {
  const tag = (el?.tagName || '').toLowerCase();
  if (tag === 'marquee') return { risk: 'high', reason: 'marquee' };
  if (tag === 'blink') return { risk: 'high', reason: 'blink' };
  if (tag === 'video' && el?.hasAttribute?.('autoplay')) {
    return {
      risk: profile === PROFILES.PHOTOSENSITIVE ? 'high' : 'medium',
      reason: 'autoplay',
    };
  }
  if (isFastFlashingStyle(style)) {
    return { risk: profile === PROFILES.PHOTOSENSITIVE ? 'high' : 'medium', reason: 'animation' };
  }
  return null;
}

/**
 * Detect JS-driven blinking from visibility samples.
 * samples: [{ t: ms, visible: boolean }] — at least 3 transitions within 1000ms.
 */
export function detectBlink(samples) {
  const list = (samples || []).filter((s) => Number.isFinite(s?.t)).sort((a, b) => a.t - b.t);
  let transitions = 0;
  let first = null;
  for (let i = 1; i < list.length; i++) {
    if (list[i].visible !== list[i - 1].visible) {
      if (first === null) first = list[i].t;
      transitions += 1;
    }
  }
  if (transitions < 3) return false;
  const windowStart = list[list.length - 1].t - 1000;
  const recent = list.filter((s) => s.t >= windowStart);
  let recentTransitions = 0;
  for (let i = 1; i < recent.length; i++) {
    if (recent[i].visible !== recent[i - 1].visible) recentTransitions += 1;
  }
  return recentTransitions >= 3;
}

/** Sampler with an injected clock for deterministic blink detection. */
export class BlinkSampler {
  constructor(now = () => Date.now(), windowMs = 1000) {
    this.now = now;
    this.windowMs = windowMs;
    this.map = new Map();
  }

  record(el, visible) {
    const key = el;
    const samples = this.map.get(key) || [];
    const t = this.now();
    samples.push({ t, visible: Boolean(visible) });
    const cutoff = t - this.windowMs;
    while (samples.length && samples[0].t < cutoff) samples.shift();
    this.map.set(key, samples);
    return detectBlink(samples);
  }

  reset(el) {
    this.map.delete(el);
  }
}

// --- reducer ----------------------------------------------------------------

function coverElement(el, doc) {
  const cover = doc.createElement('div');
  cover.className = 'temporalsafe-cover';
  cover.setAttribute('aria-hidden', 'true');
  cover.style.cssText =
    'position:absolute;inset:0;background:rgba(10,12,16,0.85);pointer-events:none;z-index:1;';
  cover.textContent = 'Paused';
  el.appendChild(cover);
  return cover;
}

function badgeElement(el, doc, text) {
  const badge = doc.createElement('span');
  badge.className = 'temporalsafe-badge';
  badge.textContent = text;
  badge.style.cssText =
    'position:absolute;top:2px;left:2px;z-index:2;background:#101214;color:#e8e6e1;' +
    'border:1px solid #d6d0c4;border-radius:4px;padding:1px 6px;font:12px system-ui,sans-serif;';
  el.appendChild(badge);
  return badge;
}

/**
 * Apply the least destructive reduction for one element.
 * Returns { undo } — never deletes content, never removes layout.
 */
export function reduceElement(el, classification, profile, doc) {
  if (!el || !classification) return null;
  const reason = classification.reason;

  if (reason === 'animation') {
    const prevPlayState = el.style.animationPlayState;
    const prevTransition = el.style.transition;
    el.style.animationPlayState = 'paused';
    el.style.transition = 'none';
    const badge = badgeElement(el, doc, 'Paused');
    return {
      undo: () => {
        el.style.animationPlayState = prevPlayState;
        el.style.transition = prevTransition;
        badge.remove();
      },
    };
  }

  if (reason === 'marquee' || reason === 'blink') {
    const prevPosition = el.style.position;
    const computed = doc.defaultView?.getComputedStyle?.(el) || {};
    if (computed.position === 'static') el.style.position = 'relative';
    const cover = coverElement(el, doc);
    const badge = badgeElement(el, doc, 'Paused');
    return {
      undo: () => {
        cover.remove();
        badge.remove();
        el.style.position = prevPosition;
      },
    };
  }

  if (reason === 'autoplay') {
    if (profile === PROFILES.PHOTOSENSITIVE && typeof el.pause === 'function') {
      const wasPaused = el.paused;
      el.pause();
      const badge = badgeElement(el, doc, 'Paused');
      return {
        undo: () => {
          badge.remove();
          if (!wasPaused && typeof el.play === 'function') el.play().catch(() => {});
        },
      };
    }
    const prevMuted = el.muted;
    el.muted = true;
    const badge = badgeElement(el, doc, 'Muted');
    return {
      undo: () => {
        badge.remove();
        el.muted = prevMuted;
      },
    };
  }

  return null;
}

// --- per-site allowlist -----------------------------------------------------

export const ALLOWLIST_KEY = 'temporalsafe-allowlist';

/** storage: { getItem, setItem } — localStorage in the browser, stub in tests. */
export function loadAllowlist(storage) {
  try {
    const raw = storage?.getItem?.(ALLOWLIST_KEY);
    const list = raw ? JSON.parse(raw) : [];
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
}

function saveAllowlist(storage, list) {
  try {
    storage?.setItem?.(ALLOWLIST_KEY, JSON.stringify(list));
  } catch {
    /* storage may be unavailable; allowlist just won't persist */
  }
}

export function isHostAllowed(host, storage) {
  return loadAllowlist(storage).includes(host);
}

export function addHostAllowed(host, storage) {
  const list = loadAllowlist(storage);
  if (!list.includes(host)) {
    list.push(host);
    saveAllowlist(storage, list);
  }
}

export function removeHostAllowed(host, storage) {
  saveAllowlist(
    storage,
    loadAllowlist(storage).filter((h) => h !== host),
  );
}

export function currentHost(doc) {
  return doc?.location?.hostname || 'localhost';
}

// --- floating panel (DOM-only, no user data interpolation) -----------------

const PANEL_ID = 'temporalsafe-panel';

function panelEl(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

export function createPanel({ host, allowlisted, onProfileChange, onScan, onOff, onAllowlistToggle }) {
  const root = panelEl('div', 'temporalsafe-panel');
  root.id = PANEL_ID;
  root.setAttribute('role', 'group');
  root.setAttribute('aria-label', 'TemporalSafe controls');

  const title = panelEl('div', 'temporalsafe-title');
  title.appendChild(panelEl('strong', null, 'TemporalSafe'));
  title.appendChild(
    panelEl(
      'span',
      'temporalsafe-note',
      'Reduces page-content motion only — not display PWM, not cross-origin iframes.',
    ),
  );
  root.appendChild(title);

  const fieldset = document.createElement('fieldset');
  const legend = panelEl('legend', null, 'Profile');
  fieldset.appendChild(legend);

  const reducedLabel = document.createElement('label');
  const reducedRadio = document.createElement('input');
  reducedRadio.type = 'radio';
  reducedRadio.name = 'temporalsafe-profile';
  reducedRadio.value = PROFILES.REDUCED;
  reducedRadio.checked = true;
  reducedLabel.append(reducedRadio, document.createTextNode(' Reduced (gentle, default)'));
  fieldset.appendChild(reducedLabel);

  const photoLabel = document.createElement('label');
  const photoRadio = document.createElement('input');
  photoRadio.type = 'radio';
  photoRadio.name = 'temporalsafe-profile';
  photoRadio.value = PROFILES.PHOTOSENSITIVE;
  photoLabel.append(photoRadio, document.createTextNode(' Photosensitive (opt-in, stricter)'));
  fieldset.appendChild(photoLabel);
  root.appendChild(fieldset);

  const allowLabel = document.createElement('label');
  const allowCheckbox = document.createElement('input');
  allowCheckbox.type = 'checkbox';
  allowCheckbox.checked = Boolean(allowlisted);
  allowLabel.append(allowCheckbox, document.createTextNode(` Always allow on ${host}`));
  root.appendChild(allowLabel);

  const actions = panelEl('div', 'temporalsafe-actions');
  const scanBtn = document.createElement('button');
  scanBtn.type = 'button';
  scanBtn.textContent = 'Scan again';
  const offBtn = document.createElement('button');
  offBtn.type = 'button';
  offBtn.textContent = 'Off';
  actions.append(scanBtn, offBtn);
  root.appendChild(actions);

  const status = panelEl('p', 'temporalsafe-status', 'Scanning…');
  status.setAttribute('role', 'status');
  status.setAttribute('aria-live', 'polite');
  root.appendChild(status);

  const details = document.createElement('details');
  const summary = panelEl('summary', null, 'About TemporalSafe');
  details.appendChild(summary);
  details.appendChild(
    panelEl(
      'p',
      null,
      'Pauses flashing elements per element, always with a "Paused" badge and a per-element ' +
        '"Show" undo. Never deletes content or removes layout. Does not affect cross-origin ' +
        'iframes; canvas/rAF-loop animation is best-effort.',
    ),
  );
  root.appendChild(details);

  const setStatus = (text) => {
    status.textContent = text;
  };

  reducedRadio.addEventListener('change', () => reducedRadio.checked && onProfileChange?.(PROFILES.REDUCED));
  photoRadio.addEventListener('change', () => photoRadio.checked && onProfileChange?.(PROFILES.PHOTOSENSITIVE));
  scanBtn.addEventListener('click', () => onScan?.());
  offBtn.addEventListener('click', () => onOff?.());
  allowCheckbox.addEventListener('change', () => onAllowlistToggle?.(allowCheckbox.checked));

  root.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      onOff?.();
    }
  });

  return { root, setStatus, getProfile: () => (photoRadio.checked ? PROFILES.PHOTOSENSITIVE : PROFILES.REDUCED) };
}

function injectPanelStyles(doc) {
  const style = doc.createElement('style');
  style.textContent = `
    #${PANEL_ID} {
      position: fixed; right: 12px; top: 12px; z-index: 2147483647;
      width: min(340px, calc(100vw - 24px));
      background: #101214; color: #e8e6e1; border: 2px solid #d6d0c4;
      border-radius: 8px; padding: 12px; font: 15px/1.45 system-ui, sans-serif;
    }
    #${PANEL_ID} fieldset { border: 0; margin: 8px 0; padding: 0; }
    #${PANEL_ID} label { display: block; margin: 8px 0; min-height: 44px; }
    #${PANEL_ID} button { min-height: 44px; min-width: 44px; margin: 4px 8px 4px 0; padding: 8px 12px; }
    #${PANEL_ID} .temporalsafe-note { display: block; font-size: 13px; opacity: 0.85; }
    #${PANEL_ID} :focus-visible { outline: 2px solid #ffd24a; outline-offset: 2px; }
    .temporalsafe-cover { position: absolute; inset: 0; background: rgba(10,12,16,0.85);
      pointer-events: none; z-index: 1; font: 12px system-ui, sans-serif; color: #e8e6e1; }
    .temporalsafe-badge { position: absolute; top: 2px; left: 2px; z-index: 2;
      background: #101214; color: #e8e6e1; border: 1px solid #d6d0c4; border-radius: 4px;
      padding: 1px 6px; font: 12px system-ui, sans-serif; }
  `;
  (doc.head || doc.documentElement).appendChild(style);
  return style;
}

/**
 * Userscript runtime. Observes the document with a 500ms debounce and reduces
 * classified elements. Returns { off }.
 */
export function startTemporalSafe(options = {}) {
  const doc = options.doc || document;
  const win = doc.defaultView || window;
  const storage = options.storage || (typeof localStorage !== 'undefined' ? localStorage : null);
  const host = options.host || currentHost(doc);
  if (isHostAllowed(host, storage)) return { off: () => {}, allowed: true };

  if (win.__temporalSafe) {
    win.__temporalSafe.off();
    return win.__temporalSafe;
  }

  const style = injectPanelStyles(doc);
  const cspBlocked = !style.sheet;
  if (cspBlocked) {
    const pre = doc.createElement('pre');
    pre.setAttribute('role', 'alert');
    pre.textContent =
      'TemporalSafe: this site blocks injected styles, so reductions cannot be applied here.';
    (doc.body || doc.documentElement).appendChild(pre);
    return { off: () => pre.remove(), allowed: false };
  }

  let profile = options.profile || PROFILES.REDUCED;
  const state = { reductions: new Map(), observer: null, off: null, allowed: false };
  win.__temporalSafe = state;

  const panel = createPanel({
    host,
    allowlisted: false,
    onProfileChange: (p) => {
      profile = p;
      scan();
    },
    onScan: scan,
    onOff: off,
    onAllowlistToggle: (checked) => {
      if (checked) {
        addHostAllowed(host, storage);
        off();
      }
    },
  });
  (doc.body || doc.documentElement).appendChild(panel.root);

  function scan() {
    const all = Array.from(doc.querySelectorAll('*')).slice(0, 2000);
    let paused = 0;
    for (const el of all) {
      if (state.reductions.has(el)) continue;
      let style = {};
      try {
        style = win.getComputedStyle?.(el) || {};
      } catch {
        /* cross-origin or detached node */
      }
      const cls = classifyElement(el, style, profile);
      if (!cls) continue;
      const reduced = reduceElement(el, cls, profile, doc);
      if (reduced) {
        state.reductions.set(el, reduced);
        paused += 1;
      }
    }
    panel.setStatus(
      paused > 0
        ? `Paused ${paused} flashing element${paused === 1 ? '' : 's'}.`
        : 'No flashing elements detected.',
    );
  }

  function off() {
    if (state.observer) state.observer.disconnect();
    for (const reduction of state.reductions.values()) {
      try {
        reduction.undo();
      } catch {
        /* ignore */
      }
    }
    state.reductions.clear();
    document.getElementById?.(PANEL_ID)?.remove();
    win.__temporalSafe = null;
  }

  scan();

  let debounce;
  state.observer = win.MutationObserver
    ? new win.MutationObserver(() => {
        clearTimeout(debounce);
        debounce = setTimeout(scan, 500);
      })
    : null;
  state.observer?.observe?.(doc.documentElement, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ['style', 'class'],
  });

  state.off = off;
  return { off, allowed: false };
}

