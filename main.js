import { app, BrowserWindow } from "electron/main";
import path from "path";
import { fileURLToPath } from "url";
import { ipcMain } from "electron";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// vueで書き直し

// #region Windowの操作

const createWindow = () => {
  const win = new BrowserWindow({
    width: 800,
    height: 600,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      nodeIntegration: false,
      contextIsolation: true,
    },
  });

  win.loadFile("index.html");
};

app.whenReady().then(() => {
  createWindow();

  // for macOS
  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

// app exit
app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

// #endregion

let globalState = {
  MicPermission: false,
};

// マイクアクセスのリクエストを表示する
ipcMain.handle("ask:mic-permission", async () => {
  // macOSの場合のみ有効。Windowsでは常にtrueを返します。
  // Windowsでのマイクアクセスは、OSの設定に依存します。
  if (process.platform === "darwin") {
    // macOSの場合
    return await systemPreferences.askForMediaAccess("microphone");
  } else {
    // macOS以外（Windows, Linuxなど）
    // macOS以外のOSでは、通常は常にtrueを返すか、
    // またはマイクが利用可能かどうかの追加チェックが必要になる場合があります。
    // ElectronのsystemPreferences.askForMediaAccessは主にmacOS向けです。
    console.warn("askForMediaAccess('microphone') is primarily for macOS. Returning true for other platforms.");
    return true;
  }
});

ipcMain.on("audio-data", (event, audioData) => {
  // TODO: Implement audio processing and ONNX inference here in later steps
  // For now, just log the received audio data
  console.log("Received audio data from renderer process. Length:", audioData.length);
});
