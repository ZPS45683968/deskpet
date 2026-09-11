const test = require('node:test');
const assert = require('node:assert/strict');
const { applyElapsed, createDefaultState, performCommand, xpNeeded } = require('../src/game-engine');

test('feeding consumes inventory and improves satiety', () => {
  const now = new Date('2026-09-09T08:00:00Z').getTime();
  const state = createDefaultState(now);
  state.needs.satiety = 40;
  const outcome = performCommand(state, 'use-item', { id: 'bamboo' }, now);
  assert.equal(outcome.reaction.ok, true);
  assert.equal(outcome.state.inventory.bamboo, 2);
  assert.equal(outcome.state.needs.satiety, 58);
  assert.equal(outcome.state.daily.progress.feed, 1);
});

test('shop rejects purchases without enough coins', () => {
  const now = Date.now();
  const state = createDefaultState(now);
  state.profile.coins = 0;
  const outcome = performCommand(state, 'buy-item', { id: 'apple' }, now);
  assert.equal(outcome.reaction.ok, false);
  assert.equal(outcome.changed, false);
  assert.equal(outcome.state.inventory.apple, 1);
});

test('completed daily task can only be claimed once', () => {
  const now = Date.now();
  let state = createDefaultState(now);
  for (let index = 0; index < 3; index += 1) state = performCommand(state, 'interact', { type: 'pet' }, now).state;
  const first = performCommand(state, 'claim-task', { id: 'pet' }, now);
  const second = performCommand(first.state, 'claim-task', { id: 'pet' }, now);
  assert.equal(first.reaction.ok, true);
  assert.equal(second.reaction.ok, false);
  assert.equal(second.state.profile.coins, first.state.profile.coins);
});

test('experience advances level and carries remaining xp', () => {
  const now = Date.now();
  const state = createDefaultState(now);
  state.profile.xp = xpNeeded(1) - 2;
  const outcome = performCommand(state, 'interact', { type: 'pet' }, now);
  assert.equal(outcome.state.profile.level, 2);
  assert.equal(outcome.state.profile.xp, 2);
});

test('elapsed time gradually decays needs', () => {
  const now = Date.now();
  const state = createDefaultState(now);
  applyElapsed(state, now + 10 * 60 * 1000);
  assert.equal(Math.round(state.needs.satiety), 80);
  assert.equal(Math.round(state.needs.energy), 77);
});

test('daily progress resets on a new local day', () => {
  const now = new Date(2026, 8, 9, 23, 55).getTime();
  const state = createDefaultState(now);
  state.daily.progress.pet = 3;
  applyElapsed(state, now + 10 * 60 * 1000);
  assert.equal(state.daily.progress.pet, 0);
});

test('badminton is a full interaction and advances the play task', () => {
  const now = Date.now();
  const state = createDefaultState(now);
  const outcome = performCommand(state, 'interact', { type: 'badminton' }, now);
  assert.equal(outcome.reaction.animation, 'badminton');
  assert.equal(outcome.state.daily.progress.play, 1);
  assert.equal(outcome.state.needs.mood, 100);
  assert.equal(outcome.state.needs.energy, 66);
});
