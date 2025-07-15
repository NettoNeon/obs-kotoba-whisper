import { app, BrowserWindow, session, ipcMain } from "electron";
import path from "node:path";
import started from "electron-squirrel-startup";

// Handle creating/removing shortcuts on Windows when installing/uninstalling.
if (started) {
  app.quit();
}

const createWindow = () => {
  // Create the browser window.
  const mainWindow = new BrowserWindow({
    width: 800,
    height: 600,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
    },
  });

  // and load the index.html of the app.
  if (MAIN_WINDOW_VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(MAIN_WINDOW_VITE_DEV_SERVER_URL);
  } else {
    mainWindow.loadFile(path.join(__dirname, `../renderer/${MAIN_WINDOW_VITE_NAME}/index.html`));
  }

  // Open the DevTools.
  mainWindow.webContents.openDevTools();

  // https://www.electronjs.org/docs/latest/tutorial/security#7-define-a-content-security-policy
  session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
    callback({
      responseHeaders: {
        ...details.responseHeaders,
        "Content-Security-Policy": "default-src 'self'; style-src 'self'",
      },
    });
  });
};

app.whenReady().then(() => {
  ipcMain.handle("get-model-path", () => {
    // modelsフォルダ内の最初の.onnxファイルをモデルパスとして返す
    // 適切なモデル選択ロジックに置き換えてください
    const modelDir = path.join(app.getAppPath(), "models");
    const fs = require("fs");
    const files = fs.readdirSync(modelDir);
    const onnxFile = files.find((file: string) => file.endsWith(".onnx"));
    if (onnxFile) {
      return path.join(modelDir, onnxFile);
    }
    return null;
  });

  createWindow();

  // for mac
  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

// for mac
app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});
