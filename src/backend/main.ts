import { app, BrowserWindow, session as electronSession, ipcMain } from "electron";
import path from "node:path";
import started from "electron-squirrel-startup";

import { InferenceSession, Tensor } from "onnxruntime-node";
const FEATURE_SIZE = 80; // モデルが期待する特徴量サイズ (通常80)

let encoderSession: InferenceSession | null = null;
let decoderSession: InferenceSession | null = null;

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
        "Content-Security-Policy": "default-src 'self'; style-src 'self'; script-src 'self' blob:;",
      },
    });
  });
};

app.whenReady().then(() => {
  // get-model-pathのロジックを関数化

  function getModelPaths() {
    const modelDir = path.join(app.getAppPath(), "models");
    const fs = require("fs");
    const files: string[] = fs.readdirSync(modelDir);
    const encoderFile = files.find((file: string) => file.includes("encoder") && file.endsWith(".onnx"));
    const decoderFile = files.find((file: string) => file.includes("decoder") && file.endsWith(".onnx"));
    return {
      encoder: encoderFile ? path.join(modelDir, encoderFile) : null,
      decoder: decoderFile ? path.join(modelDir, decoderFile) : null,
    };
  }

  ipcMain.handle("get-model-path", () => {
    // 便宜的にエンコーダモデルのパスを返す
    const paths = getModelPaths();
    return paths.encoder;
  });

  ipcMain.handle("load-model", async () => {
    const { encoder, decoder } = getModelPaths();
    if (!encoder || !decoder) {
      console.error("ONNX encoder/decoder model not found.");
      return false;
    }
    try {
      encoderSession = await InferenceSession.create(encoder);
      decoderSession = await InferenceSession.create(decoder);
      console.log("ONNX encoder/decoder models loaded successfully.");
      return true;
    } catch (error) {
      console.error("Failed to load ONNX models:", error);
      return false;
    }
  });

  ipcMain.handle("run-inference", async (event, audioData) => {
    if (!encoderSession || !decoderSession) {
      console.error("Inference session not initialized.");
      return null;
    }
    try {
      // 1. エンコーダ推論
      // audioData.length は [フレーム数 * FEATURE_SIZE] である必要がある
      if (!audioData || audioData.length % FEATURE_SIZE !== 0) {
        console.error("audioData length is not a multiple of FEATURE_SIZE (80). Skipping inference.");
        return null;
      }
      const numFrames = audioData.length / FEATURE_SIZE;
      const encoderInput = new Tensor("float32", audioData, [1, numFrames, FEATURE_SIZE]);
      const encoderFeeds: Record<string, Tensor> = {};
      encoderFeeds[encoderSession.inputNames[0]] = encoderInput;
      const encoderResults = await encoderSession.run(encoderFeeds);
      // encoder_hidden_statesの出力名を取得
      const encoderOutputName = encoderSession.outputNames[0];
      const encoderHiddenStates = encoderResults[encoderOutputName];

      // 2. デコーダ推論
      // input_ids: 開始トークン（Whisperの場合50257や1など）
      // ここでは1トークンのみ仮で生成
      const startToken = 50257; // Whisperのデフォルト開始トークン（モデルによって異なる場合あり）
      const inputIdsTensor = new Tensor("int64", BigInt64Array.from([BigInt(startToken)]), [1, 1]);
      const decoderFeeds: Record<string, Tensor> = {};
      decoderFeeds[decoderSession.inputNames[0]] = inputIdsTensor;
      decoderFeeds[decoderSession.inputNames[1]] = encoderHiddenStates;
      const decoderResults = await decoderSession.run(decoderFeeds);
      const decoderOutputName = decoderSession.outputNames[0];
      const outputTensor = decoderResults[decoderOutputName];
      // 出力テンソル（トークンID列）を文字列で返す
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
