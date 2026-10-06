console.log("HELLO FROM MAIN.JS: ", __dirname);
const { app, BrowserWindow, ipcMain, shell } = require('electron');
const path = require('path');
const fs = require('fs');
const serverApp = require('./server');

let mainWindow;

function createWindow() {

  mainWindow = new BrowserWindow({
    width: 1400,
    height: 860,
    minWidth: 1000,
    minHeight: 680,
    title: "Atta Homeopathic Clinic",
    icon: path.join(__dirname, 'assets', 'icon.ico'),
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js')
    }
  });

  const PORT = process.env.PORT || 0;

  // Wait for the SQLite database to open successfully before launching the HTTP listener
  serverApp.dbPromise.then(() => {
    const listener = serverApp.listen(PORT, '127.0.0.1', () => {
      const actualPort = listener.address().port;
      console.log(`[Electron] Background Express server listening on http://127.0.0.1:${actualPort}`);
      
      // Force clear Chromium cache to ensure the latest UI changes are always loaded
      mainWindow.webContents.session.clearCache().then(() => {
        mainWindow.loadURL(`http://127.0.0.1:${actualPort}/index.html?v=${Date.now()}`);
      }).catch(err => {
        console.error("Cache clear error:", err);
        mainWindow.loadURL(`http://127.0.0.1:${actualPort}/index.html?v=${Date.now()}`);
      });
    }).on('error', (err) => {
      console.error('[Electron] Server error:', err);
    });

    mainWindow.webContents.setWindowOpenHandler(({ url }) => {
      if (url.startsWith('https://wa.me/') || url.startsWith('https://web.whatsapp.com/')) {
        shell.openExternal(url);
        return { action: 'deny' };
      }
      return { action: 'allow' };
    });

    ipcMain.on('open-external', (event, url) => {
      shell.openExternal(url);
    });

    ipcMain.handle('copy-image', (event, dataUrl) => {
      try {
        const { clipboard, nativeImage } = require('electron');
        const image = nativeImage.createFromDataURL(dataUrl);
        if (image.isEmpty()) return false;
        clipboard.clear();
        clipboard.writeImage(image);
        return true;
      } catch (err) {
        console.error('Failed to copy image in main process:', err);
        return false;
      }
    });

    // Close listener when window closes
    mainWindow.on('closed', () => {
      mainWindow = null;
      listener.close();
    });
  }).catch(err => {
    console.error("[Electron] Failed to open SQLite database:", err);
    app.quit();
  });
}

// Disable hardware acceleration to bypass GPU compatibility issues on some Windows setups/VMs
app.disableHardwareAcceleration();

app.on('ready', createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (mainWindow === null) {
    createWindow();
  }
});
