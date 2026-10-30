const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('hsarriver', {
  window: {
    control: (action) => ipcRenderer.invoke('window:control', action),
    isMaximized: () => ipcRenderer.invoke('window:is-maximized'),
  },
  engine: {
    status: () => ipcRenderer.invoke('engine:status'),
    logs: (seq) => ipcRenderer.invoke('engine:logs', seq),
    request: (path, method = 'GET', body) => ipcRenderer.invoke('engine:request', { path, method, body }),
  },
  runtime: {
    saveConfig: (payload) => ipcRenderer.invoke('runtime:save-config', payload),
    startBox: (payload) => ipcRenderer.invoke('runtime:start-box', payload),
    pickDirectory: () => ipcRenderer.invoke('runtime:pick-directory'),
  },
});
