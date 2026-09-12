const { app, BrowserWindow, dialog, globalShortcut, ipcMain, Menu, Tray, screen } = require('electron');
const fs = require('fs');
const path = require('path');
const { GameStore } = require('./game-store');

let petWindow;
let panelWindow;
let tray;
let gameStore;
let gameTimer;
let memoTimer;
let activeMemoId = null;
let quitting = false;

// Pet cell (192x208) plus 120px of headroom above the pet for speech bubbles (see .speech in styles.css).
const WINDOW_SIZE = { width: 192, height: 328 };
const SMOKE_TEST = process.argv.includes('--smoke-test');

function configurePortableStorage() {
  const executableDir = process.env.PORTABLE_EXECUTABLE_DIR;
  if (!executableDir) return;

  const dataDir = path.join(path.resolve(executableDir), 'data');
  const runtimePaths = {
    userData: dataDir,
    sessionData: path.join(dataDir, 'session'),
    logs: path.join(dataDir, 'logs'),
    crashDumps: path.join(dataDir, 'crashes'),
    temp: path.join(dataDir, 'temp')
  };

  for (const runtimePath of Object.values(runtimePaths)) {
    fs.mkdirSync(runtimePath, { recursive: true });
  }
  for (const [name, runtimePath] of Object.entries(runtimePaths)) {
    app.setPath(name, runtimePath);
  }
}

if (SMOKE_TEST) app.disableHardwareAcceleration();

if (process.env.PORTABLE_EXECUTABLE_DIR) {
  configurePortableStorage();
} else if (SMOKE_TEST) {
  app.setPath('userData', path.join(app.getPath('temp'), `zhubao-smoke-${process.pid}`));
}
const gotSingleInstanceLock = app.requestSingleInstanceLock();

if (!gotSingleInstanceLock) app.quit();

function safeSend(window, channel, payload) {
  if (window && !window.isDestroyed() && !window.webContents.isDestroyed()) {
    window.webContents.send(channel, payload);
  }
}

function broadcastState(snapshot = gameStore.snapshot()) {
  safeSend(petWindow, 'game-state', snapshot);
  safeSend(panelWindow, 'game-state', snapshot);
}

function sendReaction(reaction) {
  if (!reaction || reaction.silent) return;
  safeSend(petWindow, 'pet-reaction', reaction);
  safeSend(panelWindow, 'pet-reaction', reaction);
}

function updateWindowSettings(snapshot) {
  if (petWindow && !petWindow.isDestroyed()) {
    petWindow.setAlwaysOnTop(snapshot.settings.alwaysOnTop, snapshot.settings.alwaysOnTop ? 'floating' : 'normal');
  }
  rebuildTrayMenu(snapshot);
}

function runGameCommand(command, payload = {}) {
  const outcome = gameStore.dispatch(command, payload);
  updateWindowSettings(outcome.state);
  broadcastState(outcome.state);
  sendReaction(outcome.reaction);
  return outcome;
}

async function createPetWindow() {
  const workArea = screen.getPrimaryDisplay().workArea;
  petWindow = new BrowserWindow({
    ...WINDOW_SIZE,
    x: workArea.x + workArea.width - WINDOW_SIZE.width - 28,
    y: workArea.y + workArea.height - WINDOW_SIZE.height,
    show: !SMOKE_TEST,
    transparent: true,
    frame: false,
    resizable: false,
    skipTaskbar: true,
    alwaysOnTop: gameStore.snapshot().settings.alwaysOnTop,
    hasShadow: false,
    focusable: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  if (gameStore.snapshot().settings.alwaysOnTop) petWindow.setAlwaysOnTop(true, 'floating');
  await petWindow.loadFile(path.join(__dirname, 'index.html'));
  petWindow.on('close', (event) => {
    if (!quitting) {
      event.preventDefault();
      petWindow.hide();
    }
  });
}

async function createPanelWindow() {
  if (panelWindow && !panelWindow.isDestroyed()) return panelWindow;
  panelWindow = new BrowserWindow({
    width: 460,
    height: 760,
    minWidth: 400,
    minHeight: 620,
    show: false,
    title: '竹宝的小屋',
    backgroundColor: '#f4f1e8',
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });
  await panelWindow.loadFile(path.join(__dirname, 'panel.html'));
  panelWindow.on('close', (event) => {
    if (!quitting) {
      event.preventDefault();
      panelWindow.hide();
    }
  });
  return panelWindow;
}

async function showPanel(tab = 'home') {
  const window = await createPanelWindow();
  const petBounds = petWindow?.getBounds();
  if (petBounds && !window.isVisible()) {
    const area = screen.getDisplayMatching(petBounds).workArea;
    const panelBounds = window.getBounds();
    const x = Math.max(area.x, Math.min(petBounds.x - panelBounds.width - 18, area.x + area.width - panelBounds.width));
    const y = Math.max(area.y, Math.min(petBounds.y + WINDOW_SIZE.height - panelBounds.height, area.y + area.height - panelBounds.height));
    window.setPosition(x, y, false);
  }
  window.show();
  window.focus();
  safeSend(window, 'panel-tab', tab);
}

function rebuildTrayMenu(snapshot = gameStore?.snapshot()) {
  if (!tray || !snapshot) return;
  tray.setContextMenu(Menu.buildFromTemplate([
    { label: `🐼 ${snapshot.profile.name}的小屋`, click: () => showPanel('home') },
    { label: `Lv.${snapshot.profile.level}  ·  🎍 ${snapshot.profile.coins} 竹币`, enabled: false },
    { type: 'separator' },
    { label: '🤚 摸摸', click: () => runGameCommand('interact', { type: 'pet' }) },
    { label: '🎋 喂嫩竹叶', click: () => runGameCommand('use-item', { id: 'bamboo' }) },
    { label: '🚶 散步', click: () => runGameCommand('interact', { type: 'walk' }) },
    { label: '🎐 玩耍', click: () => runGameCommand('interact', { type: 'play' }) },
    { label: '🏸 打羽毛球', click: () => runGameCommand('interact', { type: 'badminton' }) },
    ...[['soccer', '⚽ 踢足球'], ['basketball', '🏀 打篮球'], ['weights', '🏋 举哑铃'], ['singing', '🎤 唱歌'], ['pingpong', '🏓 打乒乓球'], ['overtime', '💻 加班'], ['coffee', '☕ 喝咖啡']].map(([type, label]) => ({ label, click: () => runGameCommand('interact', { type }) })),
    { label: '😴 休息', click: () => runGameCommand('interact', { type: 'rest' }) },
    { type: 'separator' },
    { label: '🎒 背包与商店', click: () => showPanel('bag') },
    { label: '✅ 今日任务', click: () => showPanel('tasks') },
    { label: '⏰ 备忘录', click: () => showPanel('memos') },
    { type: 'separator' },
    {
      label: '自由散步', type: 'checkbox', checked: snapshot.settings.autoRoam,
      click: (item) => runGameCommand('set-setting', { key: 'autoRoam', value: item.checked })
    },
    {
      label: '始终置顶', type: 'checkbox', checked: snapshot.settings.alwaysOnTop,
      click: (item) => runGameCommand('set-setting', { key: 'alwaysOnTop', value: item.checked })
    },
    { label: '隐藏竹宝', click: () => petWindow.hide() },
    { label: '退出', click: () => { quitting = true; app.quit(); } }
  ]));
}

function createTray() {
  tray = new Tray(path.join(__dirname, '..', 'app-assets', 'tray.png'));
  tray.setToolTip('竹宝·熊猫桌宠');
  rebuildTrayMenu();
  tray.on('click', () => {
    if (petWindow.isVisible()) showPanel('home');
    else petWindow.show();
  });
  tray.on('double-click', () => showPanel('home'));
}

function registerIpc() {
  ipcMain.handle('get-window-bounds', () => petWindow.getBounds());
  ipcMain.handle('get-work-area', () => screen.getDisplayMatching(petWindow.getBounds()).workArea);
  ipcMain.on('move-window', (_event, { x, y }) => {
    const area = screen.getDisplayMatching(petWindow.getBounds()).workArea;
    const nextX = Math.max(area.x, Math.min(Math.round(x), area.x + area.width - WINDOW_SIZE.width));
    const nextY = Math.max(area.y, Math.min(Math.round(y), area.y + area.height - WINDOW_SIZE.height));
    petWindow.setPosition(nextX, nextY, false);
  });
  ipcMain.on('set-mouse-passthrough', (_event, ignore) => {
    if (petWindow && !petWindow.isDestroyed()) petWindow.setIgnoreMouseEvents(ignore, { forward: true });
  });
  ipcMain.on('show-pet-menu', () => tray?.popUpContextMenu());
  ipcMain.on('open-panel', (_event, tab) => showPanel(tab));
  ipcMain.handle('get-game-state', () => gameStore.snapshot());
  ipcMain.handle('game-command', (_event, command, payload) => runGameCommand(command, payload));
  ipcMain.handle('backup-save', async () => {
    const selected = await dialog.showSaveDialog(panelWindow || petWindow, {
      title: '备份竹宝存档',
      defaultPath: `zhubao-save-${new Date().toISOString().slice(0, 10)}.json`,
      filters: [{ name: 'JSON', extensions: ['json'] }]
    });
    if (selected.canceled || !selected.filePath) return { ok: false, canceled: true };
    fs.writeFileSync(selected.filePath, JSON.stringify(gameStore.snapshot(), null, 2), 'utf8');
    return { ok: true, path: selected.filePath };
  });
  ipcMain.handle('restore-save', async () => {
    const selected = await dialog.showOpenDialog(panelWindow || petWindow, {
      title: '恢复竹宝存档', properties: ['openFile'], filters: [{ name: 'JSON', extensions: ['json'] }]
    });
    if (selected.canceled || !selected.filePaths[0]) return { ok: false, canceled: true };
    try {
      const restored = JSON.parse(fs.readFileSync(selected.filePaths[0], 'utf8'));
      const snapshot = gameStore.replace(restored);
      updateWindowSettings(snapshot);
      broadcastState(snapshot);
      sendReaction({ ok: true, animation: 'wave', message: '存档已恢复，竹宝又回来啦。' });
      return { ok: true };
    } catch {
      return { ok: false, message: '这个存档无法读取。' };
    }
  });
}

app.on('second-instance', () => {
  if (petWindow) petWindow.show();
  showPanel('home');
});

app.whenReady().then(async () => {
  if (!gotSingleInstanceLock) return;
  gameStore = new GameStore(path.join(app.getPath('userData'), 'zhubao-save-v1.json'));
  registerIpc();
  await createPetWindow();

  if (SMOKE_TEST) {
    await createPanelWindow();
    await new Promise((resolve) => setTimeout(resolve, 450));
    const petCapture = await petWindow.webContents.capturePage();
    const panelCapture = await panelWindow.webContents.capturePage();
    await petWindow.webContents.executeJavaScript("window.zhubaoDesktop.command('interact', { type: 'badminton' })");
    await new Promise((resolve) => setTimeout(resolve, 850));
    const badmintonCapture = await petWindow.webContents.capturePage();
    for (const type of ['soccer', 'basketball', 'weights', 'singing', 'pingpong', 'overtime', 'coffee']) {
      await petWindow.webContents.executeJavaScript(`window.zhubaoDesktop.command('interact', { type: '${type}' })`);
      await new Promise(resolve => setTimeout(resolve, 100));
      const loaded = await petWindow.webContents.executeJavaScript(`new Promise(resolve => { const image = new Image(); image.onload = () => resolve(image.naturalWidth === 1536 && image.naturalHeight === 208 && document.querySelector('#sprite').style.backgroundImage.includes('${type}.webp')); image.onerror = () => resolve(false); image.src = '../app-assets/${type}.webp'; })`);
      if (!loaded) throw new Error(`Action failed: ${type}`);
      if (['pingpong', 'overtime', 'coffee'].includes(type)) {
        petWindow.showInactive();
        await new Promise(resolve => setTimeout(resolve, 250));
        fs.writeFileSync(path.join(app.getPath('temp'), `zhubao-${type}-smoke.png`), (await petWindow.webContents.capturePage()).toPNG());
      }
    }
    safeSend(panelWindow, 'panel-tab', 'memos');
    await new Promise(resolve => setTimeout(resolve, 100));
    await panelWindow.webContents.executeJavaScript(`(() => {
      const form = document.querySelector('#memo-form');
      form.elements.eventAt.value = localInput(Date.now() + 600000);
      form.elements.eventAt.dispatchEvent(new Event('input', { bubbles: true }));
      if (new Date(form.elements.eventAt.value) - new Date(form.elements.remindAt.value) !== 300000) throw new Error('Default reminder must be five minutes earlier');
      const custom = localInput(Date.now() + 180000);
      form.elements.remindAt.value = custom;
      form.elements.remindAt.dispatchEvent(new Event('input', { bubbles: true }));
      form.elements.eventAt.value = localInput(Date.now() + 900000);
      form.elements.eventAt.dispatchEvent(new Event('input', { bubbles: true }));
      if (form.elements.remindAt.value !== custom) throw new Error('Custom reminder time was overwritten');
      for (const [name, value] of Object.entries({ text: '喝水 <提醒> & 休息', eventAt: localInput(Date.now() + 600000), remindAt: localInput(Date.now() + 120000) })) {
        form.elements[name].value = value;
        form.elements[name].dispatchEvent(new Event('input', { bubbles: true }));
      }
      form.requestSubmit();
    })()`);
    await new Promise(resolve => setTimeout(resolve, 150));
    if (gameStore.state.memos.length !== 1) throw new Error('Memo form did not save');
    const reminder = gameStore.takeDueMemo(Date.now() + 180000);
    if (!reminder?.reminder) throw new Error('Reminder did not become due');
    broadcastState();
    sendReaction(reminder);
    await new Promise(resolve => setTimeout(resolve, 350));
    const visibleReminder = await petWindow.webContents.executeJavaScript("document.querySelector('#speech').textContent.startsWith('喝水 <提醒> & 休息') && document.querySelector('#speech').classList.contains('memo-speech') && document.querySelector('#sprite').style.backgroundImage.includes('reminder.webp')");
    if (!visibleReminder) throw new Error('Reminder render failed');
    petWindow.showInactive();
    panelWindow.showInactive();
    await new Promise(resolve => setTimeout(resolve, 350));
    fs.writeFileSync(path.join(app.getPath('temp'), 'zhubao-memo-panel-smoke.png'), (await panelWindow.webContents.capturePage()).toPNG());
    fs.writeFileSync(path.join(app.getPath('temp'), 'zhubao-reminder-smoke.png'), (await petWindow.webContents.capturePage()).toPNG());
    await new Promise(resolve => setTimeout(resolve, 16000));
    const persistent = await petWindow.webContents.executeJavaScript("document.querySelector('#speech').classList.contains('visible') && animationName === 'reminder' && Boolean(activeMemoId)");
    if (!persistent) throw new Error('Reminder stopped without acknowledgement');
    await petWindow.webContents.executeJavaScript("document.querySelector('.dismiss-memo').click()");
    await new Promise(resolve => setTimeout(resolve, 200));
    if (!gameStore.state.memos[0].completed || gameStore.state.memos[0].awaitingAck) throw new Error('Acknowledgement not saved');
    const dismissed = await petWindow.webContents.executeJavaScript("!document.querySelector('#speech').classList.contains('visible') && !activeMemoId && animationName !== 'reminder'");
    if (!dismissed) throw new Error('Reminder did not stop on click');
    const grouped = await panelWindow.webContents.executeJavaScript("document.querySelector('.memo-ended .memo-entry')?.textContent.includes('喝水 <提醒> & 休息') && !document.querySelector('.memo-pending .memo-entry')");
    if (!grouped) throw new Error('Completed memo was not moved to ended section');
    const future = Date.now() + 86400000;
    runGameCommand('save-memo', { text: '整理工作日报', eventAt: future, remindAt: future-300000, repeat: 'weekdays' });
    await new Promise(resolve => setTimeout(resolve, 150));
    fs.writeFileSync(path.join(app.getPath('temp'), 'zhubao-memos-redesign.png'), (await panelWindow.webContents.capturePage()).toPNG());
    safeSend(panelWindow, 'panel-tab', 'settings');
    await new Promise(resolve => setTimeout(resolve, 100));
    await panelWindow.webContents.executeJavaScript(`(() => { const form = document.querySelector('#water-form'); form.elements.minutes.value = '30'; form.requestSubmit(); })()`);
    await new Promise(resolve => setTimeout(resolve, 100));
    if (gameStore.state.hydration.minutes !== 30) throw new Error('Water configuration failed');
    sendReaction(gameStore.takeWaterReminder(Date.now() + 1800001));
    await new Promise(resolve => setTimeout(resolve, 100));
    if (!await petWindow.webContents.executeJavaScript("document.querySelector('#speech').textContent.includes('喝口水')")) throw new Error('Water bubble failed');
    await petWindow.webContents.executeJavaScript("speech.classList.remove('visible'); satiety = 29; lastHungerAt = 0; checkHunger()");
    if (!await petWindow.webContents.executeJavaScript("document.querySelector('#speech').textContent === '要饿坏了，要饿坏了'")) throw new Error('Hunger bubble failed');
    const checkedTabs = await panelWindow.webContents.executeJavaScript(`
      [...document.querySelectorAll('[data-tab]')].map((button) => {
        button.click();
        return button.dataset.tab + ':' + (document.querySelector('#content').textContent.trim().length > 10 ? 'ok' : 'empty');
      }).join(',')
    `);
    const petCapturePath = path.join(app.getPath('temp'), 'zhubao-pet-smoke.png');
    const panelCapturePath = path.join(app.getPath('temp'), 'zhubao-panel-smoke.png');
    const badmintonCapturePath = path.join(app.getPath('temp'), 'zhubao-badminton-smoke.png');
    fs.writeFileSync(petCapturePath, petCapture.toPNG());
    fs.writeFileSync(panelCapturePath, panelCapture.toPNG());
    fs.writeFileSync(badmintonCapturePath, badmintonCapture.toPNG());
    console.log(`ZHUBAO_SMOKE_OK tabs=${checkedTabs} pet=${petCapturePath} badminton=${badmintonCapturePath} panel=${panelCapturePath}`);
    quitting = true;
    app.quit();
    return;
  }

  createTray();
  memoTimer = setInterval(() => {
    const reaction = gameStore.takeDueMemo();
    if (!reaction) {
      activeMemoId = null;
      const water = gameStore.takeWaterReminder();
      if (water) { petWindow.showInactive(); broadcastState(); sendReaction(water); }
      return;
    }
    if (activeMemoId === reaction.memoId) return;
    activeMemoId = reaction.memoId;
    petWindow.showInactive();
    broadcastState();
    sendReaction(reaction);
  }, 1000);
  globalShortcut.register('CommandOrControl+Alt+P', () => showPanel('home'));
  gameTimer = setInterval(() => {
    const outcome = gameStore.tick();
    broadcastState(outcome.state);
    sendReaction(outcome.reaction);
  }, 60 * 1000);
  app.on('activate', () => petWindow.show());
});

app.on('window-all-closed', () => {});

app.on('before-quit', () => {
  quitting = true;
  clearInterval(gameTimer);
  clearInterval(memoTimer);
  globalShortcut.unregisterAll();
  gameStore?.save();
});


