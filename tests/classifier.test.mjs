import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  PROFILES,
  parseDuration,
  isFastFlashingStyle,
  classifyElement,
  detectBlink,
  BlinkSampler,
} from '../temporalsafe.js';

test('parseDuration handles s and ms forms', () => {
  assert.equal(parseDuration('0.2s'), 200);
  assert.equal(parseDuration('300ms'), 300);
  assert.equal(parseDuration('1s'), 1000);
  assert.equal(parseDuration('0'), 0);
  assert.equal(parseDuration('nope'), 0);
  assert.equal(parseDuration('2s, 0.2s'), 200);
  assert.equal(parseDuration('0s, 300ms'), 300);
});

test('isFastFlashingStyle flags fast repeating animations and transitions', () => {
  assert.equal(
    isFastFlashingStyle({ animationDuration: '0.2s', animationIterationCount: 'infinite' }),
    true,
  );
  assert.equal(isFastFlashingStyle({ animationDuration: '2s', animationIterationCount: 'infinite' }), false);
  assert.equal(isFastFlashingStyle({ animationDuration: '0.2s', animationIterationCount: '2' }), false);
  assert.equal(isFastFlashingStyle({ transitionDuration: '0.1s' }), true);
  assert.equal(isFastFlashingStyle({}), false);
});

function el(tag, attrs = {}, style = {}) {
  return {
    tagName: tag.toUpperCase(),
    style,
    hasAttribute: (name) => name in attrs,
  };
}

test('classifyElement detects marquee, blink, autoplay, and fast styles', () => {
  assert.equal(classifyElement(el('marquee'), {}).reason, 'marquee');
  assert.equal(classifyElement(el('blink'), {}).reason, 'blink');
  assert.equal(
    classifyElement(el('video', { autoplay: '' }), {}, PROFILES.REDUCED).reason,
    'autoplay',
  );
  assert.equal(
    classifyElement(el('video', { autoplay: '' }), {}, PROFILES.PHOTOSENSITIVE).risk,
    'high',
  );
  assert.equal(
    classifyElement(el('div'), { animationDuration: '0.2s', animationIterationCount: 'infinite' }).reason,
    'animation',
  );
  assert.equal(classifyElement(el('div'), {}), null);
});

test('detectBlink needs 3 transitions inside 1000ms', () => {
  const blink = [
    { t: 0, visible: true },
    { t: 200, visible: false },
    { t: 400, visible: true },
    { t: 600, visible: false },
    { t: 800, visible: true },
  ];
  assert.equal(detectBlink(blink), true);

  const slow = [
    { t: 0, visible: true },
    { t: 600, visible: false },
    { t: 1200, visible: true },
    { t: 1800, visible: false },
  ];
  assert.equal(detectBlink(slow), false);

  const few = [
    { t: 0, visible: true },
    { t: 200, visible: false },
    { t: 400, visible: true },
  ];
  assert.equal(detectBlink(few), false);
});

test('BlinkSampler uses the injected clock', () => {
  let now = 0;
  const sampler = new BlinkSampler(() => now);
  const node = {};
  let result = false;
  for (const visible of [true, false, true, false, true]) {
    now += 200;
    result = sampler.record(node, visible);
  }
  assert.equal(result, true);
  sampler.reset(node);
  now += 5000;
  assert.equal(sampler.record(node, true), false);
});
