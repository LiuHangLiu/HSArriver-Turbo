import test from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_FILTERS, NAV_ITEMS, PAGE_FEATURES, classifyLog } from '../src/contract.mjs';

test('client exposes exactly the eight approved top-level menus', () => {
  assert.deepEqual(NAV_ITEMS.map((item) => item[0]), [
    'overview', 'control', 'surrender', 'rank', 'human', 'delays', 'calibration', 'diagnostics',
  ]);
  assert.equal(new Set(NAV_ITEMS.map((item) => item[2])).size, 8);
});

test('each menu has an explicit feature owner', () => {
  assert.equal(Object.keys(PAGE_FEATURES).length, 8);
  for (const key of NAV_ITEMS.map((item) => item[0])) {
    assert.ok(PAGE_FEATURES[key]?.length > 0, `missing feature owner for ${key}`);
  }
});

test('log filters default to all categories for the desktop diagnostics panel', () => {
  assert.deepEqual(Object.keys(DEFAULT_FILTERS).sort(), ['cdp', 'debug', 'operation', 'power', 'recommendation']);
  assert.ok(Object.values(DEFAULT_FILTERS).every(Boolean));
});

test('log classifier keeps CDP, Power.log, debug, recommendation and operation separate', () => {
  assert.equal(classifyLog({ level: 'INFO', msg: 'CDP connected' }), 'cdp');
  assert.equal(classifyLog({ level: 'INFO', msg: 'Power.log updated' }), 'power');
  assert.equal(classifyLog({ level: 'DEBUG', msg: 'trace' }), 'debug');
  assert.equal(classifyLog({ level: 'INFO', msg: '推荐 play_minion' }), 'recommendation');
  assert.equal(classifyLog({ level: 'INFO', msg: '启动盒子' }), 'operation');
});
