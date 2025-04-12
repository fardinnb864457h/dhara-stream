const { app, BrowserWindow, session, ipcMain } = require('electron');
const fs = require('fs');
const path = require('path');

function createWindow() {
  const mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
    },
    icon: __dirname + '/icon.ico'
  });

  // Remove menu bar for smaller UI footprint
  mainWindow.setMenuBarVisibility(false);
  mainWindow.loadFile('index.html');

  // Handle IPC requests to update headers - essential for streaming
  ipcMain.on('set-headers', (event, { userAgent, cookie }) => {
    // Set new headers
    session.defaultSession.webRequest.onBeforeSendHeaders((details, callback) => {
      details.requestHeaders['User-Agent'] = userAgent;
      details.requestHeaders['Cookie'] = cookie;
      callback({ cancel: false, requestHeaders: details.requestHeaders });
    });

    event.reply('headers-set');
  });
  
  // Handle local file reading requests
  ipcMain.on('read-local-file', (event, { filePath }) => {
    try {
      // Resolve the path if it's not absolute
      const resolvedPath = path.isAbsolute(filePath) 
        ? filePath 
        : path.join(__dirname, filePath);
      
      const content = fs.readFileSync(resolvedPath, 'utf8');
      event.reply('local-file-content', { content });
    } catch (error) {
      event.reply('local-file-content', { error: error.message });
    }
  });
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  app.quit();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});