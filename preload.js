const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  copyImageToClipboard: (dataUrl) => {
    return ipcRenderer.invoke('copy-image', dataUrl);
  },
  openExternal: (url) => {
    ipcRenderer.send('open-external', url);
  }
});
