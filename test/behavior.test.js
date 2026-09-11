const test = require('node:test');
const assert = require('node:assert/strict');
const { chooseBehavior } = require('../src/behavior');
const { createDefaultState, performCommand } = require('../src/game-engine');

test('overtime frequency rises at local 18:00 and resets at midnight', () => {
  function count(hour, minute = 0) {
    const date = new Date(2026, 8, 11, hour, minute);
    let overtime = 0;
    for (let i = 0; i < 480; i++) {
      if (chooseBehavior(date, () => (i + .5) / 480) === 'overtime') overtime++;
    }
    return overtime;
  }
  assert.equal(count(17, 59), 40);
  assert.equal(count(18), 150);
  assert.equal(count(23, 59), 150);
  assert.equal(count(0), 40);
});

test('pingpong participates in play task; overtime is a separate interaction', () => {
  const now = Date.now();
  const pingpong = performCommand(createDefaultState(now), 'interact', { type: 'pingpong' }, now);
  assert.equal(pingpong.reaction.animation, 'pingpong');
  assert.equal(pingpong.state.daily.progress.play, 1);
  assert.equal(pingpong.state.needs.energy, 66);
  const overtime = performCommand(createDefaultState(now), 'interact', { type: 'overtime' }, now);
  assert.equal(overtime.reaction.animation, 'overtime');
  assert.equal(overtime.state.daily.progress.play, 0);
  assert.equal(overtime.state.totals.interactions, 1);
});
