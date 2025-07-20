import { app, BrowserWindow, session as electronSession, ipcMain } from "electron";
import path from "node:path";
import started from "electron-squirrel-startup";
import { InferenceSession, Tensor } from "onnxruntime-node";

let session: InferenceSession | null = null;

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
  electronSession.defaultSession.webRequest.onHeadersReceived((details, callback) => {
    callback({
      responseHeaders: {
        ...details.responseHeaders,
        "Content-Security-Policy": "default-src 'self'; style-src 'self'",
      },
    });
  });
};

app.whenReady().then(() => {
  // get-model-pathのロジックを関数化
  function getModelPath() {
    const modelDir = path.join(app.getAppPath(), "models");
    const fs = require("fs");
    const files: string[] = fs.readdirSync(modelDir);
    const onnxFile = files.find((file: string) => file.endsWith(".onnx"));
    if (onnxFile) {
      return path.join(modelDir, onnxFile);
    }
    return null;
  }

  ipcMain.handle("get-model-path", () => {
    return getModelPath();
  });

  ipcMain.handle("load-model", async () => {
    const modelPath = getModelPath();
    if (!modelPath) {
      console.error("ONNX model not found.");
      return false;
    }
    try {
      session = await InferenceSession.create(modelPath);
      console.log("ONNX model loaded successfully.");
      return true;
    } catch (error) {
      console.error("Failed to load ONNX model:", error);
      return false;
    }
  });

  ipcMain.handle("run-inference", async (event, audioData) => {
    if (!session) {
      console.error("Inference session not initialized.");
      return null;
    }
    try {
      const inputTensor = new Tensor("float32", audioData, [1, audioData.length]);
      const feeds = { [session.inputNames[0]]: inputTensor };
      const results = await session.run(feeds);
      const outputTensor = results[session.outputNames[0]];
      // ここでは、簡単に出力テンソルのデータを文字列として返します。
      // 実際のアプリケーションでは、Whisperの出力（トークンID）をデコードして、
      // 意味のあるテキストに変換する処理が必要です。
      return outputTensor.data.toString();
    } catch (error) {
      console.error("Failed to run inference:", error);
      return null;
    }
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
