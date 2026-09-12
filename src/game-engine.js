const DAY_MS = 24 * 60 * 60 * 1000;
const { REPEATS, nextOccurrence } = require('./reminders');

const CATALOG = Object.freeze({
  bamboo: {
    id: 'bamboo', name: '嫩竹叶', icon: '🎋', type: 'food', price: 8,
    description: '清脆的日常主食', effects: { satiety: 18, mood: 3, affection: 1, xp: 4 }
  },
  bambooShoot: {
    id: 'bambooShoot', name: '竹笋', icon: '🌱', type: 'food', price: 15,
    description: '竹宝特别喜欢的小零食', effects: { satiety: 30, mood: 6, affection: 2, xp: 6 }
  },
  apple: {
    id: 'apple', name: '红苹果', icon: '🍎', type: 'food', price: 20,
    description: '甜甜的，吃完心情更好', effects: { satiety: 16, mood: 12, affection: 3, xp: 7 }
  },
  ball: {
    id: 'ball', name: '青竹球', icon: '🎐', type: 'toy', price: 32,
    description: '陪竹宝玩一会儿', effects: { mood: 24, energy: -7, affection: 3, xp: 8 }
  },
  brush: {
    id: 'brush', name: '柔软小刷', icon: '🧹', type: 'care', price: 26,
    description: '把毛毛梳得蓬蓬的', effects: { mood: 14, affection: 5, xp: 8 }
  }
});

const DAILY_TASKS = Object.freeze({
  pet: { id: 'pet', name: '摸摸竹宝 3 次', target: 3, reward: 12 },
  feed: { id: 'feed', name: '投喂 2 次', target: 2, reward: 18 },
  walk: { id: 'walk', name: '散步 1 次', target: 1, reward: 15 },
  play: { id: 'play', name: '玩耍 1 次', target: 1, reward: 20 }
});

const clamp = (value, min = 0, max = 100) => Math.max(min, Math.min(max, value));

function localDateKey(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function createDefaultState(now = Date.now()) {
  return {
    version: 1,
    profile: {
      name: '竹宝',
      bornAt: now,
      level: 1,
      xp: 0,
      coins: 60,
      affection: 5
    },
    needs: { satiety: 82, mood: 86, energy: 78 },
    inventory: { bamboo: 3, bambooShoot: 1, apple: 1, ball: 1, brush: 1 },
    daily: {
      date: localDateKey(new Date(now)),
      progress: { pet: 0, feed: 0, walk: 0, play: 0 },
      claimed: []
    },
    totals: { interactions: 0, feeds: 0, walks: 0, purchases: 0 },
    settings: { alwaysOnTop: true, autoRoam: true, autoFeed: false, bubbles: true },
    diary: [{ at: now, type: 'hello', text: '竹宝来到了你的桌面，并带来了一筐子好心情。' }],
    memos: [],
    hydration: { enabled: true, minutes: 60, nextAt: now + 3600000 },
    lastUpdated: now
  };
}

function normalizeState(input, now = Date.now()) {
  const base = createDefaultState(now);
  if (!input || typeof input !== 'object') return base;
  const state = {
    ...base,
    version: Number(input.version) || base.version,
    profile: { ...base.profile, ...(input.profile || {}) },
    needs: { ...base.needs, ...(input.needs || {}) },
    inventory: { ...base.inventory, ...(input.inventory || {}) },
    daily: {
      ...base.daily,
      ...(input.daily || {}),
      progress: { ...base.daily.progress, ...(input.daily?.progress || {}) },
      claimed: Array.isArray(input.daily?.claimed) ? input.daily.claimed : []
    },
    totals: { ...base.totals, ...(input.totals || {}) },
    settings: { ...base.settings, ...(input.settings || {}) },
    diary: Array.isArray(input.diary) ? input.diary.slice(0, 80) : base.diary,
    memos: Array.isArray(input.memos) ? input.memos.filter(m => m && typeof m.id === 'string' && typeof m.text === 'string' && m.text.trim() && Number.isFinite(m.eventAt) && Number.isFinite(m.remindAt) && m.remindAt <= m.eventAt).slice(0, 200).map(m => ({ id: m.id, text: m.text.slice(0, 300), eventAt: m.eventAt, remindAt: m.remindAt, repeat: REPEATS.includes(m.repeat) ? m.repeat : 'none', notified: m.notified === true, awaitingAck: m.awaitingAck === true && m.completed !== true, completed: m.completed === true })) : []
  };
  const minutes = Math.max(1, Math.min(480, Math.floor(Number(input.hydration?.minutes) || 60)));
  state.hydration = { enabled: input.hydration?.enabled !== false, minutes, nextAt: Number.isFinite(input.hydration?.nextAt) ? input.hydration.nextAt : now + minutes * 60000 };
  for (const key of Object.keys(state.needs)) state.needs[key] = clamp(Number(state.needs[key]) || 0);
  for (const id of Object.keys(CATALOG)) state.inventory[id] = Math.max(0, Math.floor(Number(state.inventory[id]) || 0));
  state.profile.level = Math.max(1, Math.floor(Number(state.profile.level) || 1));
  state.profile.xp = Math.max(0, Math.floor(Number(state.profile.xp) || 0));
  state.profile.coins = Math.max(0, Math.floor(Number(state.profile.coins) || 0));
  state.profile.affection = Math.max(0, Math.floor(Number(state.profile.affection) || 0));
  return state;
}

function addDiary(state, text, type = 'event', now = Date.now()) {
  state.diary.unshift({ at: now, type, text });
  state.diary = state.diary.slice(0, 80);
}

function resetDailyIfNeeded(state, now) {
  const today = localDateKey(new Date(now));
  if (state.daily.date === today) return;
  state.daily = {
    date: today,
    progress: { pet: 0, feed: 0, walk: 0, play: 0 },
    claimed: []
  };
  addDiary(state, '新的一天开始了，今天也要和竹宝好好相处。', 'daily', now);
}

function applyElapsed(state, now = Date.now()) {
  resetDailyIfNeeded(state, now);
  const elapsed = clamp(now - Number(state.lastUpdated || now), 0, DAY_MS);
  state.needs.satiety = clamp(state.needs.satiety - elapsed / (5 * 60 * 1000));
  state.needs.energy = clamp(state.needs.energy - elapsed / (8 * 60 * 1000));
  state.needs.mood = clamp(state.needs.mood - elapsed / (12 * 60 * 1000));
  state.lastUpdated = now;
  return state;
}

function xpNeeded(level) {
  return 40 + level * 20;
}

function gainXp(state, amount, now) {
  state.profile.xp += amount;
  let leveledUp = false;
  while (state.profile.xp >= xpNeeded(state.profile.level)) {
    state.profile.xp -= xpNeeded(state.profile.level);
    state.profile.level += 1;
    state.profile.coins += 20;
    state.profile.affection += 2;
    leveledUp = true;
  }
  if (leveledUp) addDiary(state, `竹宝升到了 ${state.profile.level} 级，获得 20 枚竹币。`, 'level', now);
  return leveledUp;
}

function progressTask(state, id, amount = 1) {
  if (!DAILY_TASKS[id]) return;
  state.daily.progress[id] = Math.min(DAILY_TASKS[id].target, (state.daily.progress[id] || 0) + amount);
}

function applyEffects(state, effects, now) {
  for (const key of ['satiety', 'mood', 'energy']) {
    if (effects[key]) state.needs[key] = clamp(state.needs[key] + effects[key]);
  }
  state.profile.affection = Math.max(0, state.profile.affection + (effects.affection || 0));
  return gainXp(state, effects.xp || 0, now);
}

function result(state, reaction, changed = true) {
  return { state, reaction, changed };
}

function performCommand(current, command, payload = {}, now = Date.now()) {
  const state = applyElapsed(normalizeState(current, now), now);
  const name = state.profile.name;
  if (command === 'set-hydration') {
    const minutes = Number(payload.minutes);
    if (!Number.isInteger(minutes) || minutes < 1 || minutes > 480) return result(state, { ok: false, message: '提醒间隔请填写 1–480 分钟。' }, false);
    state.hydration = { enabled: Boolean(payload.enabled), minutes, nextAt: now + minutes * 60000 };
    return result(state, { ok: true, silent: true, message: '喝水提醒已保存。' });
  }

  if (command === 'save-memo') {
    const text = String(payload.text || '').trim();
    const eventAt = Number(payload.eventAt);
    const remindAt = Number(payload.remindAt);
    const existing = payload.id ? state.memos.find(m => m.id === payload.id) : null;
    if (payload.id && !existing) return result(state, { ok: false, message: '备忘录不存在。' }, false);
    if (!text || text.length > 300 || !Number.isFinite(eventAt) || !Number.isFinite(remindAt) || remindAt <= now || eventAt < remindAt) {
      return result(state, { ok: false, message: '请填写 1–300 字内容，提醒时间须晚于现在且不晚于事项时间。' }, false);
    }
    if (!existing && state.memos.length >= 200) return result(state, { ok: false, message: '最多保存 200 条，请先删除旧备忘录。' }, false);
    const memo = { id: existing?.id || require('crypto').randomUUID(), text, eventAt, remindAt, repeat: REPEATS.includes(payload.repeat) ? payload.repeat : 'none', notified: false, completed: false };
    if (memo.repeat === 'weekdays' && [0, 6].includes(new Date(memo.eventAt).getDay())) Object.assign(memo, nextOccurrence(memo, now));
    if (existing) state.memos[state.memos.indexOf(existing)] = memo;
    else state.memos.push(memo);
    return result(state, { ok: true, silent: true, message: '备忘录已保存。' });
  }
  if (command === 'delete-memo' || command === 'complete-memo' || command === 'stop-memo') {
    const memo = state.memos.find(m => m.id === payload.id);
    if (!memo) return result(state, { ok: false, message: '备忘录不存在。' }, false);
    if (command === 'delete-memo') state.memos = state.memos.filter(m => m !== memo);
    else if (command === 'complete-memo' && memo.repeat !== 'none') {
      Object.assign(memo, nextOccurrence(memo, now), { awaitingAck: false, notified: false, completed: false });
    } else { memo.completed = true; memo.awaitingAck = false; }
    return result(state, { ok: true, silent: true, message: command === 'delete-memo' ? '已删除。' : '已完成。' });
  }

  if (command === 'interact') {
    const type = payload.type;
    const interactions = {
      pet: { effects: { mood: 5, affection: 2, xp: 4 }, animation: 'wave', message: `${name}蹭了蹭你的手心 ♥` },
      walk: { effects: { mood: 9, energy: -8, satiety: -3, affection: 1, xp: 8 }, animation: 'walk', message: `${name}要去桌面边缘散散步。` },
      play: { effects: { mood: 15, energy: -10, satiety: -2, affection: 3, xp: 9 }, animation: 'jump', message: `再来一次！${name}玩得很开心。` },
      badminton: { effects: { mood: 18, energy: -12, satiety: -3, affection: 3, xp: 10 }, animation: 'badminton', message: `${name}打出了一记漂亮的羽毛球！` },
      soccer: { effects: { mood: 18, energy: -12, satiety: -3, affection: 3, xp: 10 }, animation: 'soccer', message: `${name}踢出了一脚好球！` },
      basketball: { effects: { mood: 18, energy: -12, satiety: -3, affection: 3, xp: 10 }, animation: 'basketball', message: `${name}投篮得分啦！` },
      weights: { effects: { mood: 18, energy: -12, satiety: -3, affection: 3, xp: 10 }, animation: 'weights', message: `${name}认真举起小哑铃！` },
      singing: { effects: { mood: 18, energy: -12, satiety: -3, affection: 3, xp: 10 }, animation: 'singing', message: `${name}为你唱了一首歌 ♪` },
      pingpong: { effects: { mood: 18, energy: -12, satiety: -3, affection: 3, xp: 10 }, animation: 'pingpong', message: `${name}挥动球拍，接住了乒乓球！` },
      overtime: { effects: { energy: -6, satiety: -2, affection: 2, xp: 8 }, animation: 'overtime', message: `${name}陪你加班，也别忘了休息呀。` },
      coffee: { effects: { mood: 8, energy: 10, affection: 1, xp: 4 }, animation: 'coffee', message: `${name}捧起咖啡喝了一口，满足地笑了 ☕` },
      rest: { effects: { energy: 24, mood: 3, xp: 3 }, animation: 'sit', message: `${name}坐下来打个小盹。` },
      inspect: { effects: { mood: 4, xp: 4 }, animation: 'inspect', message: `${name}正在认真观察新叶子。` }
    };
    const spec = interactions[type];
    if (!spec) return result(state, { ok: false, message: '未知的互动。' }, false);
    applyEffects(state, spec.effects, now);
    state.totals.interactions += 1;
    if (type === 'walk') state.totals.walks += 1;
    progressTask(state, ['badminton', 'soccer', 'basketball', 'weights', 'singing', 'pingpong'].includes(type) ? 'play' : type);
    addDiary(state, spec.message, type, now);
    return result(state, { ok: true, animation: spec.animation, message: spec.message });
  }

  if (command === 'use-item') {
    const item = CATALOG[payload.id];
    if (!item) return result(state, { ok: false, message: '这件物品不存在。' }, false);
    if ((state.inventory[item.id] || 0) < 1) return result(state, { ok: false, message: `背包里没有${item.name}了。` }, false);
    state.inventory[item.id] -= 1;
    applyEffects(state, item.effects, now);
    const isFood = item.type === 'food';
    if (isFood) {
      state.totals.feeds += 1;
      progressTask(state, 'feed');
    } else {
      progressTask(state, 'play');
    }
    const message = isFood ? `${name}吃掉了${item.name}，一脸满足。` : `${name}用${item.name}玩了一会儿。`;
    addDiary(state, message, isFood ? 'feed' : 'play', now);
    return result(state, { ok: true, animation: isFood ? 'eat' : item.type === 'toy' ? 'jump' : 'wave', message });
  }

  if (command === 'buy-item') {
    const item = CATALOG[payload.id];
    const quantity = clamp(Math.floor(Number(payload.quantity) || 1), 1, 20);
    if (!item) return result(state, { ok: false, message: '商店里没有这件物品。' }, false);
    const cost = item.price * quantity;
    if (state.profile.coins < cost) return result(state, { ok: false, message: '竹币不够，多陪竹宝玩玩吧。' }, false);
    state.profile.coins -= cost;
    state.inventory[item.id] = (state.inventory[item.id] || 0) + quantity;
    state.totals.purchases += quantity;
    const message = `买下 ${quantity} 份${item.name}，花费 ${cost} 枚竹币。`;
    addDiary(state, message, 'shop', now);
    return result(state, { ok: true, animation: 'wave', message });
  }

  if (command === 'claim-task') {
    const task = DAILY_TASKS[payload.id];
    if (!task) return result(state, { ok: false, message: '任务不存在。' }, false);
    if ((state.daily.progress[task.id] || 0) < task.target) return result(state, { ok: false, message: '任务还没有完成。' }, false);
    if (state.daily.claimed.includes(task.id)) return result(state, { ok: false, message: '奖励已经领取过了。' }, false);
    state.daily.claimed.push(task.id);
    state.profile.coins += task.reward;
    gainXp(state, 5, now);
    const message = `任务完成：${task.name}，获得 ${task.reward} 枚竹币。`;
    addDiary(state, message, 'task', now);
    return result(state, { ok: true, animation: 'jump', message });
  }

  if (command === 'set-setting') {
    if (!Object.prototype.hasOwnProperty.call(state.settings, payload.key)) {
      return result(state, { ok: false, message: '未知设置。' }, false);
    }
    state.settings[payload.key] = Boolean(payload.value);
    return result(state, { ok: true, message: '设置已保存。', silent: true });
  }

  if (command === 'rename') {
    const nextName = String(payload.name || '').trim().slice(0, 12);
    if (!nextName) return result(state, { ok: false, message: '名字不能为空。' }, false);
    const oldName = state.profile.name;
    state.profile.name = nextName;
    const message = `${oldName}现在叫${nextName}了。`;
    addDiary(state, message, 'profile', now);
    return result(state, { ok: true, animation: 'wave', message });
  }

  return result(state, { ok: false, message: '未知指令。' }, false);
}

function publicSnapshot(state) {
  return {
    ...state,
    catalog: CATALOG,
    tasks: DAILY_TASKS,
    derived: {
      xpNeeded: xpNeeded(state.profile.level),
      status: state.needs.satiety < 22 ? '饿了' : state.needs.energy < 20 ? '困了' : state.needs.mood < 25 ? '想你陪陪' : '状态很好'
    }
  };
}

module.exports = {
  CATALOG,
  DAILY_TASKS,
  applyElapsed,
  createDefaultState,
  normalizeState,
  performCommand,
  publicSnapshot,
  xpNeeded
};


