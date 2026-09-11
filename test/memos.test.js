const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { createDefaultState, normalizeState, performCommand } = require('../src/game-engine');
const { GameStore } = require('../src/game-store');

test('new activities match badminton rewards and cannot manually trigger reminder', () => {
  for (const type of ['soccer', 'basketball', 'weights', 'singing']) {
    const r = performCommand(createDefaultState(1000), 'interact', { type }, 1000);
    assert.equal(r.reaction.animation, type);
    assert.equal(r.state.daily.progress.play, 1);
    assert.equal(r.state.needs.energy, 66);
  }
  assert.equal(performCommand(createDefaultState(), 'interact', { type: 'reminder' }).reaction.ok, false);
});

test('memo validates content and time ordering and migrates old saves', () => {
  assert.deepEqual(normalizeState({}).memos, []);
  for (const payload of [{ text: '', eventAt: 4000, remindAt: 3000 }, { text: 'a', eventAt: 2000, remindAt: 3000 }, { text: 'a', eventAt: 4000, remindAt: 500 }, { text: 'a', eventAt: NaN, remindAt: 3000 }]) {
    assert.equal(performCommand(createDefaultState(1000), 'save-memo', payload, 1000).reaction.ok, false);
  }
});

test('due reminders survive restart, drain in order once, and respect edits/completion/deletion', t => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'zhubao-memo-test-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  const file = path.join(dir, 'save.json');
  let store = new GameStore(file, 1000);
  for (const text of ['first', 'second', 'complete', 'delete', 'edit']) store.dispatch('save-memo', { text, eventAt: 5000, remindAt: 3000 }, 1000);
  const [first, second, complete, del, edit] = store.state.memos;
  store.dispatch('complete-memo', { id: complete.id }, 1100);
  store.dispatch('delete-memo', { id: del.id }, 1100);
  store.dispatch('save-memo', { ...edit, remindAt: 4500 }, 1100);
  assert.equal(store.takeDueMemo(2999), null);
  store = new GameStore(file, 4000);
  assert.equal(store.takeDueMemo(4000).message, first.text);
  store = new GameStore(file, 4000);
  assert.equal(store.takeDueMemo(4000).message, first.text);
  store.dispatch('complete-memo', { id: first.id }, 4000);
  assert.equal(store.takeDueMemo(4000).message, second.text);
  store.dispatch('complete-memo', { id: second.id }, 4000);
  assert.equal(store.takeDueMemo(4000), null);
  assert.equal(store.takeDueMemo(4500).animation, 'reminder');
  assert.equal(store.takeDueMemo(9000).memoId, edit.id);
  store.dispatch('complete-memo', { id: edit.id }, 9000);
  assert.equal(store.takeDueMemo(9000), null);
});
