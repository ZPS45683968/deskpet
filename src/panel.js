const content = document.querySelector('#content');
const tabs = document.querySelector('#tabs');
const toast = document.querySelector('#toast');
const petName = document.querySelector('#pet-name');
const levelBadge = document.querySelector('#level-badge');
const coinCount = document.querySelector('#coin-count');
const petStatus = document.querySelector('#pet-status');

let state;
let activeTab = 'home';
let toastTimer;
let memoDraft = { id: '', text: '', eventAt: '', remindAt: '' };
let reminderTimeManual = false;
const repeatLabels = { none: '不重复', daily: '每天', weekdays: '工作日', weekly: '每周' };
const localInput = value => { const d = new Date(value); return new Date(value - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16); };

const escapeHtml = (value) => String(value)
  .replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')
  .replaceAll('"', '&quot;').replaceAll("'", '&#039;');
const percent = (value) => Math.max(0, Math.min(100, Math.round(value)));

function showToast(message) {
  if (!message) return;
  clearTimeout(toastTimer);
  toast.textContent = message;
  toast.classList.add('visible');
  toastTimer = setTimeout(() => toast.classList.remove('visible'), 2600);
}

function header() {
  petName.textContent = state.profile.name;
  levelBadge.textContent = `Lv.${state.profile.level}`;
  coinCount.textContent = state.profile.coins;
  petStatus.textContent = `${state.derived.status}  ·  好感 ${state.profile.affection}`;
}

function bar(label, icon, value, className) {
  const rounded = percent(value);
  return `<div class="need"><div class="need-head"><span>${icon} ${label}</span><strong>${rounded}</strong></div><div class="bar ${className}"><i style="width:${rounded}%"></i></div></div>`;
}

function renderHome() {
  const xpPercent = percent(state.profile.xp / state.derived.xpNeeded * 100);
  const tip = state.needs.satiety < 30
    ? '竹宝的肚子在叽啦，去背包里喂点竹叶吧。'
    : state.needs.energy < 30
      ? '竹宝有点困，让它坐下休息一会儿。'
      : '今天的竹宝精神不错，摸摸、散步和玩耍都会增加好感。';
  return `
    <div class="section-title"><h2>今天过得怎么样？</h2><p>数值会随时间缓慢变化</p></div>
    <div class="needs">
      ${bar('饱食', '🎋', state.needs.satiety, 'satiety')}
      ${bar('心情', '♥', state.needs.mood, 'mood')}
      ${bar('精力', '⚡', state.needs.energy, 'energy')}
    </div>
    <div class="card card-pad">
      <div class="xp-row"><span>成长经验</span><strong>${state.profile.xp} / ${state.derived.xpNeeded}</strong></div>
      <div class="bar xp"><i style="width:${xpPercent}%"></i></div>
    </div>
    <div class="section-title"><h2>陪陪竹宝</h2><p>行为会记入今日任务</p></div>
    <div class="actions card card-pad">
      <button class="action-button" data-command="interact" data-type="pet"><span>🤚</span>摸摸</button>
      <button class="action-button" data-command="use-item" data-id="bamboo"><span>🎋</span>喂食</button>
      <button class="action-button" data-command="interact" data-type="walk"><span>🚶</span>散步</button>
      <button class="action-button" data-command="interact" data-type="play"><span>🎐</span>玩耍</button>
      <button class="action-button" data-command="interact" data-type="badminton"><span>🏸</span>羽毛球</button>
      ${[['soccer', '⚽', '足球'], ['basketball', '🏀', '篮球'], ['weights', '🏋', '举哑铃'], ['singing', '🎤', '唱歌'], ['pingpong', '🏓', '乒乓球'], ['overtime', '💻', '加班'], ['coffee', '☕', '喝咖啡']].map(([type, icon, label]) => `<button class="action-button" data-command="interact" data-type="${type}"><span>${icon}</span>${label}</button>`).join('')}
      <button class="action-button" data-command="interact" data-type="rest"><span>😴</span>休息</button>
    </div>
    <div class="tip"><div class="tip-icon">🌿</div><div>${tip}</div></div>`;
}

function renderBag() {
  const items = Object.values(state.catalog).filter((item) => (state.inventory[item.id] || 0) > 0);
  return `<div class="section-title"><h2>竹宝的背包</h2><p>共 ${items.reduce((sum, item) => sum + state.inventory[item.id], 0)} 件物品</p></div>
    <div class="item-grid">${items.map((item) => `
      <article class="item"><div class="item-icon">${item.icon}</div><h3>${escapeHtml(item.name)}</h3><p>${escapeHtml(item.description)}</p>
      <div class="item-footer"><span class="quantity">拥有 ×${state.inventory[item.id]}</span><button class="small-button" data-command="use-item" data-id="${item.id}">使用</button></div></article>`).join('')}</div>
    ${items.length ? '' : '<div class="empty">背包空空的，去商店看看吧。</div>'}`;
}

function renderShop() {
  return `<div class="section-title"><h2>青竹小铺</h2><p>竹币 ${state.profile.coins}</p></div>
    <div class="item-grid">${Object.values(state.catalog).map((item) => `
      <article class="item"><div class="item-icon">${item.icon}</div><h3>${escapeHtml(item.name)}</h3><p>${escapeHtml(item.description)}</p>
      <div class="item-footer"><span class="price">🎍 ${item.price}</span><button class="small-button" data-command="buy-item" data-id="${item.id}" ${state.profile.coins < item.price ? 'disabled' : ''}>购买</button></div></article>`).join('')}</div>`;
}

function renderTasks() {
  const tasks = Object.values(state.tasks);
  const complete = tasks.filter((task) => state.daily.claimed.includes(task.id)).length;
  return `<div class="section-title"><h2>今日任务</h2><p>${complete} / ${tasks.length} 已领取</p></div>
    <div class="card">${tasks.map((task) => {
      const progress = Math.min(task.target, state.daily.progress[task.id] || 0);
      const claimed = state.daily.claimed.includes(task.id);
      const ready = progress >= task.target;
      return `<div class="task"><div><h3>${escapeHtml(task.name)}</h3><div class="task-meta"><div class="bar"><i style="width:${percent(progress / task.target * 100)}%"></i></div><span>${progress}/${task.target}</span><span class="reward">🎍 ${task.reward}</span></div></div>
      <button class="small-button" data-command="claim-task" data-id="${task.id}" ${!ready || claimed ? 'disabled' : ''}>${claimed ? '已领取' : ready ? '领取' : '进行中'}</button></div>`;
    }).join('')}</div>`;
}

function renderDiary() {
  return `<div class="section-title"><h2>竹宝日记</h2><p>保留最近 80 条记忆</p></div>
    <div class="card card-pad">${state.diary.map((entry) => {
      const date = new Date(entry.at);
      return `<article class="diary-entry"><time>${date.toLocaleString('zh-CN', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</time><p>${escapeHtml(entry.text)}</p></article>`;
    }).join('')}</div>`;
}

function renderMemos() {
  const rows = [...state.memos].sort((a, b) => a.completed - b.completed || a.remindAt - b.remindAt);
  const ended = m => m.completed || (m.notified && !m.awaitingAck);
  const section = (title, items, finished = false) => `<section class="memo-group ${finished ? 'memo-ended' : 'memo-pending'}"><div class="section-title"><h2>${title}</h2><p>${items.length} 条</p></div>${items.map(m => `<article class="card card-pad memo-entry"><p>${escapeHtml(m.text)}</p><div class="memo-repeat">${repeatLabels[m.repeat] || '不重复'}</div><time>事项：${new Date(m.eventAt).toLocaleString('zh-CN')}<br>提醒：${new Date(m.remindAt).toLocaleString('zh-CN')}</time><div class="button-row"><strong class="memo-status">${finished ? '✓ 已结束' : m.awaitingAck ? '🔔 提醒中 · 等待确认' : '◷ 待提醒'}</strong><button class="secondary" data-edit-memo="${escapeHtml(m.id)}">${finished ? '重新安排' : '编辑'}</button>${finished ? '' : `<button class="small-button" data-command="complete-memo" data-id="${escapeHtml(m.id)}">${m.awaitingAck ? '结束提醒' : '完成'}</button>`}${!finished && m.repeat !== 'none' ? `<button class="secondary" data-command="stop-memo" data-id="${escapeHtml(m.id)}">停止重复</button>` : ''}<button class="secondary" data-command="delete-memo" data-id="${escapeHtml(m.id)}">删除</button></div></article>`).join('') || '<div class="empty">暂无备忘</div>'}</section>`;
  return `<div class="memo-hero"><span>YOUR LITTLE ASSISTANT</span><h2>把小事交给竹宝</h2><p>记下计划，留心每一个重要时刻。</p></div>
    <details class="memo-composer" ${!rows.length || memoDraft.id || memoDraft.text ? 'open' : ''}><summary>＋ ${memoDraft.id ? '编辑备忘' : '新增备忘'}</summary><form id="memo-form" class="card card-pad memo-form">
      <div class="section-title"><h2>${memoDraft.id ? '编辑计划' : '新建计划'}</h2><p>提前 5 分钟提醒</p></div>
      <label>备忘内容<textarea name="text" required maxlength="300" placeholder="例如：提交周报、参加例会…">${escapeHtml(memoDraft.text)}</textarea></label>
      <label>事项时间<input name="eventAt" type="datetime-local" required value="${escapeHtml(memoDraft.eventAt)}"></label>
      <label>提醒时间（默认提前 5 分钟，可修改）<input name="remindAt" type="datetime-local" required value="${escapeHtml(memoDraft.remindAt)}"></label>
      <label>重复<select name="repeat">${Object.entries(repeatLabels).map(([value, label]) => `<option value="${value}" ${(memoDraft.repeat || 'none') === value ? 'selected' : ''}>${label}</option>`).join('')}</select></label>
      <div class="button-row"><button class="small-button" type="submit">${memoDraft.id ? '保存修改' : '添加备忘'}</button>${memoDraft.id ? '<button class="secondary" type="button" id="cancel-memo">取消修改</button>' : ''}</div>
      <details class="memo-help"><summary>提醒与重复规则</summary>请保持桌宠运行，错过的提醒下次启动补上。点击结束后，重复计划自动安排下一次；工作日指周一至周五，每周按所选事项的星期重复。</details>
    </form></details>
    ${rows.some(m => !ended(m) && m.awaitingAck) ? section('正在提醒', rows.filter(m => !ended(m) && m.awaitingAck)) : ''}
    ${section('待提醒', rows.filter(m => !ended(m) && !m.awaitingAck))}
    ${section('已结束', rows.filter(ended).reverse(), true)}`;
}

function setting(key, title, description) {
  return `<div class="setting-row"><div><h3>${title}</h3><p>${description}</p></div><label class="switch"><input type="checkbox" data-setting="${key}" ${state.settings[key] ? 'checked' : ''}><span></span></label></div>`;
}

function renderSettings() {
  return `<div class="section-title"><h2>陪伴设置</h2><p>自动保存</p></div>
    <div class="card">
      ${setting('alwaysOnTop', '始终置顶', '让竹宝一直留在窗口上方')}
      ${setting('autoRoam', '自由活动', '自主播放动作，18:00 后更常加班')}
      ${setting('autoFeed', '自动投喂', '饱食过低时自动吃背包中的竹叶')}
      ${setting('bubbles', '对话气泡', '在桌面上显示竹宝的反应')}
    </div>
    <div class="section-title"><h2>💧 喝水提醒</h2><p>默认每小时一次</p></div>
    <form id="water-form" class="card card-pad memo-form"><label class="water-toggle"><input name="enabled" type="checkbox" ${state.hydration.enabled ? 'checked' : ''}>开启喝水提醒</label><label>间隔（分钟）<input name="minutes" type="number" min="1" max="480" required value="${state.hydration.minutes}"></label><button class="small-button" type="submit">保存提醒设置</button><p class="memo-help">运行期间按间隔提醒，备忘录提醒结束后再提示喝水。</p></form>
    <div class="section-title"><h2>名字</h2></div>
    <div class="card"><div class="name-form"><input id="name-input" maxlength="12" value="${escapeHtml(state.profile.name)}" aria-label="宠物名字"><button class="small-button" id="save-name">保存</button></div></div>
    <div class="section-title"><h2>存档</h2><p>可跨版本保留</p></div>
    <div class="card"><div class="button-row"><button class="secondary" id="backup-save">导出备份</button><button class="secondary" id="restore-save">导入存档</button></div></div>
    <div class="card about"><strong>竹宝·熊猫桌宠</strong><br>点击桌宠可以摸摸，拖动可以移动，右键打开快捷菜单。<br>快捷键 Ctrl + Alt + P 打开竹宝的小屋。</div>`;
}

function render() {
  if (!state) return;
  header();
  const renderers = { home: renderHome, bag: renderBag, shop: renderShop, tasks: renderTasks, diary: renderDiary, memos: renderMemos, settings: renderSettings };
  content.innerHTML = renderers[activeTab]();
  tabs.querySelectorAll('[data-tab]').forEach((button) => button.classList.toggle('active', button.dataset.tab === activeTab));
}

async function command(name, payload) {
  const outcome = await window.zhubaoDesktop.command(name, payload);
  state = outcome.state;
  render();
  showToast(outcome.reaction.message);
}

tabs.addEventListener('click', (event) => {
  const button = event.target.closest('[data-tab]');
  if (!button) return;
  activeTab = button.dataset.tab;
  render();
});

content.addEventListener('click', async (event) => {
  const editMemo = event.target.closest('[data-edit-memo]');
  if (editMemo) {
    const memo = state.memos.find(m => m.id === editMemo.dataset.editMemo);
    memoDraft = { id: memo.id, text: memo.text, eventAt: localInput(memo.eventAt), remindAt: localInput(memo.remindAt), repeat: memo.repeat };
    reminderTimeManual = memo.eventAt - memo.remindAt !== 5 * 60000;
    render(); return;
  }
  if (event.target.closest('#cancel-memo')) { memoDraft = { id: '', text: '', eventAt: '', remindAt: '' }; reminderTimeManual = false; render(); return; }
  const button = event.target.closest('[data-command]');
  if (button && !button.disabled) {
    const name = button.dataset.command;
    const payload = name === 'interact' ? { type: button.dataset.type } : { id: button.dataset.id };
    await command(name, payload);
    return;
  }
  if (event.target.closest('#save-name')) {
    await command('rename', { name: document.querySelector('#name-input').value });
    return;
  }
  if (event.target.closest('#backup-save')) {
    const result = await window.zhubaoDesktop.backupSave();
    if (!result.canceled) showToast(result.ok ? '存档备份成功。' : '备份失败。');
    return;
  }
  if (event.target.closest('#restore-save')) {
    const result = await window.zhubaoDesktop.restoreSave();
    if (!result.canceled) showToast(result.ok ? '存档已恢复。' : result.message);
  }
});

content.addEventListener('change', async (event) => {
  if (!event.target.matches('[data-setting]')) return;
  await command('set-setting', { key: event.target.dataset.setting, value: event.target.checked });
});

content.addEventListener('input', event => {
  if (!event.target.closest('#memo-form')) return;
  memoDraft[event.target.name] = event.target.value;
  if (event.target.name === 'remindAt') reminderTimeManual = Boolean(event.target.value);
  if (event.target.name === 'eventAt' && !reminderTimeManual) {
    const at = new Date(event.target.value).getTime();
    memoDraft.remindAt = Number.isFinite(at) ? localInput(at - 5 * 60000) : '';
    document.querySelector('[name="remindAt"]').value = memoDraft.remindAt;
  }
});
content.addEventListener('submit', async event => {
  if (event.target.id === 'water-form') {
    event.preventDefault();
    await command('set-hydration', { enabled: event.target.elements.enabled.checked, minutes: Number(event.target.elements.minutes.value) });
    return;
  }
  if (event.target.id !== 'memo-form') return;
  event.preventDefault();
  const outcome = await window.zhubaoDesktop.command('save-memo', { id: memoDraft.id || undefined, text: memoDraft.text, eventAt: new Date(memoDraft.eventAt).getTime(), remindAt: new Date(memoDraft.remindAt).getTime(), repeat: memoDraft.repeat || 'none' });
  if (outcome.reaction.ok) { memoDraft = { id: '', text: '', eventAt: '', remindAt: '' }; reminderTimeManual = false; }
  state = outcome.state; render(); showToast(outcome.reaction.message);
});
window.zhubaoDesktop.onState((nextState) => {
  state = nextState;
  if (document.activeElement?.closest('#memo-form, #water-form')) { header(); return; }
  render();
});
window.zhubaoDesktop.onReaction((reaction) => showToast(reaction.message));
window.zhubaoDesktop.onPanelTab((tab) => {
  if (['home', 'bag', 'shop', 'tasks', 'diary', 'memos', 'settings'].includes(tab)) {
    activeTab = tab;
    render();
  }
});

window.zhubaoDesktop.getState().then((initialState) => { state = initialState; render(); });




