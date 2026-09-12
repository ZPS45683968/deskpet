const fs = require('fs');
const path = require('path');
const { applyElapsed, createDefaultState, normalizeState, performCommand, publicSnapshot } = require('./game-engine');

class GameStore {
  constructor(filePath, now = Date.now()) {
    this.filePath = filePath;
    this.state = this.load(now);
  }

  load(now = Date.now()) {
    try {
      const parsed = JSON.parse(fs.readFileSync(this.filePath, 'utf8'));
      return applyElapsed(normalizeState(parsed, now), now);
    } catch {
      return createDefaultState(now);
    }
  }

  save() {
    fs.mkdirSync(path.dirname(this.filePath), { recursive: true });
    const temporaryPath = `${this.filePath}.tmp`;
    fs.writeFileSync(temporaryPath, JSON.stringify(this.state, null, 2), 'utf8');
    fs.renameSync(temporaryPath, this.filePath);
  }

  snapshot(now = Date.now()) {
    applyElapsed(this.state, now);
    return publicSnapshot(this.state);
  }

  dispatch(command, payload, now = Date.now()) {
    const outcome = performCommand(this.state, command, payload, now);
    this.state = outcome.state;
    if (outcome.changed) this.save();
    return { ...outcome, state: publicSnapshot(this.state) };
  }

  replace(nextState, now = Date.now()) {
    this.state = applyElapsed(normalizeState(nextState, now), now);
    this.save();
    return publicSnapshot(this.state);
  }

  tick(now = Date.now()) {
    applyElapsed(this.state, now);
    let reaction = null;
    if (this.state.settings.autoFeed && this.state.needs.satiety < 24 && this.state.inventory.bamboo > 0) {
      const outcome = performCommand(this.state, 'use-item', { id: 'bamboo' }, now);
      this.state = outcome.state;
      reaction = outcome.reaction;
    }
    this.save();
    return { state: publicSnapshot(this.state), reaction };
  }

  takeDueMemo(now = Date.now()) {
    const memo = this.state.memos.find(m => !m.completed && m.awaitingAck) || this.state.memos.filter(m => !m.completed && !m.notified && m.remindAt <= now).sort((a, b) => a.remindAt - b.remindAt)[0];
    if (!memo) return null;
    if (!memo.awaitingAck) {
      memo.notified = true;
      memo.awaitingAck = true;
      this.save();
    }
    return { ok: true, animation: 'reminder', reminder: true, memoId: memo.id, message: memo.text };
  }

  takeWaterReminder(now = Date.now()) {
    const water = this.state.hydration;
    if (!water.enabled || now < water.nextAt || this.state.memos.some(m => m.awaitingAck && !m.completed)) return null;
    water.nextAt = now + water.minutes * 60000;
    this.save();
    return { ok: true, animation: 'wave', water: true, message: '喝口水，休息一下吧 💧' };
  }
}

module.exports = { GameStore };
