import { app, BrowserWindow, session as electronSession, ipcMain } from "electron";
import started from "electron-squirrel-startup";
const { env, pipeline } = require("@huggingface/transformers");
import path from "node:path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let whisperPipeline: any = null;

if (started) {
  app.quit();
}

const createWindow = () => {
  const mainWindow = new BrowserWindow({
    width: 800,
    height: 600,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
    },
  });

  if (MAIN_WINDOW_VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(MAIN_WINDOW_VITE_DEV_SERVER_URL);
  } else {
    mainWindow.loadFile(path.join(__dirname, `../renderer/${MAIN_WINDOW_VITE_NAME}/index.html`));
  }

  mainWindow.webContents.openDevTools();

  electronSession.defaultSession.webRequest.onHeadersReceived((details, callback) => {
    callback({
      responseHeaders: {
        ...details.responseHeaders,
        "Content-Security-Policy": "default-src 'self'; style-src 'self'; script-src 'self' blob:;",
      },
    });
  });
};

app.whenReady().then(() => {
  ipcMain.handle("load-model", async () => {
    try {
      console.log("Loading model via pipeline...");
      env.localModelPath = path.join(app.getAppPath());
      env.allowRemoteModels = false;

      whisperPipeline = await pipeline("automatic-speech-recognition", "models/kotoba-whisper-v2.2-ONNX", { device: "dml" });

      console.log("Pipeline loaded successfully.");
      return true;
    } catch (error) {
      console.error("Failed to load pipeline:", error);
      return false;
    }
  });

  ipcMain.handle("run-inference", async (event, audioData) => {
    if (!whisperPipeline) {
      console.error("Pipeline not initialized.");
      return null;
    }
    try {
      const audioDataTyped = new Float32Array(audioData);
      const audioLengthInSeconds = audioDataTyped.length / 16000;

      if (audioLengthInSeconds < 0.5) {
        console.log(`Audio too short (${audioLengthInSeconds.toFixed(2)}s). Skipping.`);
        return null;
      }

      console.log(`Running inference on audio of ${audioLengthInSeconds.toFixed(2)}s`);

      const result = await whisperPipeline(audioDataTyped, {
        language: "japanese",
        max_new_tokens: 200,
      });

      console.log("Pipeline result:", result);
      return result.text;
    } catch (error) {
      console.error("Failed to run pipeline:", error);
      return null;
    }
  });

  createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

app.on("gpu-info-update", () => {
  console.log("GPU Information has been Updated");
});

// @ts-expect-error Electron型定義に存在しないイベント
app.on("gpu-process-crashed", (event, killed) => {
  // このイベントは存在しますが、型定義が未対応なだけです。
  console.log("GPU Process has crashed");
  console.log(event);
  console.log("Whether GPU Process was killed - ", killed);
});

// GPU情報を取得して返すIPCハンドラーを定義
ipcMain.handle("get-gpu-info", async (event, type) => {
  try {
    if (type === "appMetrics") {
      return app.getAppMetrics();
    } else if (type === "gpuBasic") {
      return await app.getGPUInfo("basic");
    } else if (type === "gpuComplete") {
      return await app.getGPUInfo("complete");
    } else if (type === "gpuFeatureStatus") {
      return app.getGPUFeatureStatus();
    }
    return null; // 不明なタイプの場合
  } catch (error) {
    console.error(`Failed to get GPU info for type ${type}:`, error);
    throw error; // エラーをフロントエンドに通知
  }
});
