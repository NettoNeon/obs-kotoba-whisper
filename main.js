const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');

const createWindow = () => {
  const win = new BrowserWindow({
    width: 800,
    height: 600,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js')
    }
  });

  win.loadFile('index.html');
};

app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

ipcMain.on('audio-data', (event, data) => {
  console.log('Received audio data from renderer process');
  // ここでONNXモデルによる文字起こし処理を呼び出す (未実装)
  const transcription = 'これはテスト用の文字起こし結果です。'; // ダミーデータ
  event.sender.send('transcription', transcription);
});
