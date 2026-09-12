const test = require('node:test');
const assert = require('node:assert/strict');
const { chooseBehavior } = require('../src/behavior');
const { createDefaultState, performCommand } = require('../src/game-engine');

test('overtime frequency rises at local 18:00 and resets at midnight', () => {
  function count(hour, minute = 0) {
    const date = new Date(2026, 8, 11, hour, minute);
    let overtime = 0;
    for (let i = 0; i < 221; i++) {
      if (chooseBehavior(date, () => (i + .5) / 221) === 'overtime') overtime++;
    }
    return overtime;
  }
  assert.equal(count(17, 59), 17);
  assert.equal(count(18), 65);
  assert.equal(count(23, 59), 65);
  assert.equal(count(0), 17);
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
  const coffee = performCommand(createDefaultState(now), 'interact', { type: 'coffee' }, now);
  assert.equal(coffee.reaction.animation, 'coffee');
  assert.equal(coffee.state.needs.energy, 88);
  assert.equal(coffee.state.daily.progress.play, 0);
});

