import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  PROFILES,
  reduceElement,
  loadAllowlist,
  addHostAllowed,
  removeHostAllowed,
  isHostAllowed,
} from '../temporalsafe.js';

function makeEl(tag) {
  const el = {
    tagName: tag.toUpperCase(),
    style: {},
    children: [],
    paused: false,
    muted: false,
    playCalls: 0,
    pauseCalls: 0,
    attributes: {},
    appendChild(child) {
      this.children.push(child);
      return child;
    },
    remove() {
      this.removed = true;
    },
    setAttribute(name, value) {
      this.attributes[name] = String(value);
    },
    pause() {
      this.pauseCalls += 1;
      this.paused = true;
    },
    play() {
      this.playCalls += 1;
      return Promise.resolve();
    },
  };
  return el;
}

function makeDoc() {
  return {
    createElement: (tag) => makeEl(tag),
    defaultView: {
      getComputedStyle: () => ({ position: 'static' }),
    },
  };
}

test('reduceElement pauses fast animations and undo restores', () => {
  const el = makeEl('div');
  el.style.animationPlayState = 'running';
  el.style.transition = 'all 0.2s';
  const { undo } = reduceElement(el, { reason: 'animation' }, PROFILES.REDUCED, makeDoc());
  assert.equal(el.style.animationPlayState, 'paused');
  assert.equal(el.style.transition, 'none');
  assert.equal(el.children.length, 1); // badge
  undo();
  assert.equal(el.style.animationPlayState, 'running');
  assert.equal(el.style.transition, 'all 0.2s');
});

test('reduceElement covers marquee/blink without deleting content', () => {
  const el = makeEl('marquee');
  const { undo } = reduceElement(el, { reason: 'marquee' }, PROFILES.REDUCED, makeDoc());
  assert.equal(el.style.position, 'relative');
  assert.ok(el.children.some((c) => c.className === 'temporalsafe-cover'));
  assert.ok(el.children.some((c) => c.className === 'temporalsafe-badge'));
  undo();
  assert.equal(el.style.position, undefined);
});

test('reduceElement mutes autoplay video in Reduced, pauses in Photosensitive', () => {
  const doc = makeDoc();
  const reduced = makeEl('video');
  const r = reduceElement(reduced, { reason: 'autoplay' }, PROFILES.REDUCED, doc);
  assert.equal(reduced.muted, true);
  r.undo();
  assert.equal(reduced.muted, false);

  const photosensitive = makeEl('video');
  const p = reduceElement(photosensitive, { reason: 'autoplay' }, PROFILES.PHOTOSENSITIVE, doc);
  assert.equal(photosensitive.pauseCalls, 1);
  p.undo();
  assert.equal(photosensitive.playCalls, 1);
});

function memStorage(initial = {}) {
  const data = { ...initial };
  return {
    getItem: (k) => (k in data ? data[k] : null),
    setItem: (k, v) => {
      data[k] = String(v);
    },
  };
}

test('allowlist persists per hostname', () => {
  const storage = memStorage();
  assert.equal(isHostAllowed('example.com', storage), false);
  addHostAllowed('example.com', storage);
  assert.equal(isHostAllowed('example.com', storage), true);
  assert.deepEqual(loadAllowlist(storage), ['example.com']);
  removeHostAllowed('example.com', storage);
  assert.equal(isHostAllowed('example.com', storage), false);
});
