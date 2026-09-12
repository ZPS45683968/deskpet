const { contextBridge, ipcRenderer } = require('electron');

function subscribe(channel, callback) {
  const listener = (_event, payload) => callback(payload);
  ipcRenderer.on(channel, listener);
  return () => ipcRenderer.removeListener(channel, listener);
}

contextBridge.exposeInMainWorld('zhubaoDesktop', {
  getWindowBounds: () => ipcRenderer.invoke('get-window-bounds'),
  getWorkArea: () => ipcRenderer.invoke('get-work-area'),
  moveWindow: (position) => ipcRenderer.send('move-window', position),
  setMousePassthrough: (ignore) => ipcRenderer.send('set-mouse-passthrough', ignore),
  showMenu: () => ipcRenderer.send('show-pet-menu'),
  openPanel: (tab = 'home') => ipcRenderer.send('open-panel', tab),
  getState: () => ipcRenderer.invoke('get-game-state'),
  command: (command, payload = {}) => ipcRenderer.invoke('game-command', command, payload),
  backupSave: () => ipcRenderer.invoke('backup-save'),
  restoreSave: () => ipcRenderer.invoke('restore-save'),
  onReaction: (callback) => subscribe('pet-reaction', callback),
  onState: (callback) => subscribe('game-state', callback),
  onPanelTab: (callback) => subscribe('panel-tab', callback)
});
