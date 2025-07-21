import { app, BrowserWindow, session as electronSession, ipcMain } from "electron";
import started from "electron-squirrel-startup";
const { env, AutoTokenizer, AutoProcessor } = require("@huggingface/transformers");
import { InferenceSession, Tensor } from "onnxruntime-node";
import fs from "fs";
import path from "node:path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let encoderSession: InferenceSession | null = null;
let decoderSession: InferenceSession | null = null;
let tokenizer: any = null;
let processor: any = null;

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
  function getModelPaths() {
    const modelDir = path.join(app.getAppPath(), "models");
    const files: string[] = fs.readdirSync(modelDir);
    const encoderFile = files.find((file: string) => file.includes("encoder") && file.endsWith(".onnx"));
    const decoderFile = files.find((file: string) => file.includes("decoder") && file.endsWith(".onnx"));
    return {
      encoder: encoderFile ? path.join(modelDir, encoderFile) : null,
      decoder: decoderFile ? path.join(modelDir, decoderFile) : null,
    };
  }

  ipcMain.handle("get-model-path", () => {
    const paths = getModelPaths();
    return paths.encoder;
  });

  // モデルとプロセッサーを一度だけ読み込むように変更
  ipcMain.handle("load-model", async () => {
    const { encoder, decoder } = getModelPaths();
    if (!encoder || !decoder) {
      console.error("ONNX encoder/decoder model not found.");
      return false;
    }
    try {
      encoderSession = await InferenceSession.create(encoder);
      decoderSession = await InferenceSession.create(decoder);

      env.localModelPath = path.join(app.getAppPath());
      env.allowRemoteModels = false;
      processor = await AutoProcessor.from_pretrained("models", { local_files_only: true });
      tokenizer = await AutoTokenizer.from_pretrained("models", { local_files_only: true });

      console.log("ONNX models and transformers loaded successfully.");
      return true;
    } catch (error) {
      console.error("Failed to load models:", error);
      return false;
    }
  });

  // 既に読み込まれたモデルとプロセッサーを使用
  ipcMain.handle("run-inference", async (event, audioData) => {
    if (!encoderSession || !decoderSession || !processor || !tokenizer) {
      console.error("Inference components not initialized.");
      return null;
    }
    try {
      // 1. 生の音声波形データを前処理して、モデルの入力形式に変換
      const audioDataTyped = new Float32Array(audioData);

      // ★★★ この2行を追加 ★★★
      console.log(`main.ts: 受信した音声データの長さ: ${audioDataTyped.length}`);
      let maxAmplitude = 0;
      for (let i = 0; i < audioDataTyped.length; i++) {
        const absValue = Math.abs(audioDataTyped[i]);
        if (absValue > maxAmplitude) {
          maxAmplitude = absValue;
        }
      }
      console.log(`main.ts: 受信した音声データの最大振幅: ${maxAmplitude}`);

      const { input_features } = await processor(audioDataTyped, {
        sampling_rate: 16000,
        return_tensors: "np",
      });

      // 2. エンコーダ推論 - input_featuresはすでにTensorなのでそのまま使用
      const encoderInput = input_features;
      const encoderFeeds: Record<string, Tensor> = {};
      encoderFeeds[encoderSession.inputNames[0]] = encoderInput;
      const encoderResults = await encoderSession.run(encoderFeeds);
      const encoderOutputName = encoderSession.outputNames[0];
      const encoderHiddenStates = encoderResults[encoderOutputName];

      const decoderOutputName = decoderSession.outputNames[0];

      // 3. デコーダ推論の準備
      const startToken = 50258;
      const languageToken = 50290; // <|ja|>
      const inputIdsTensor = new Tensor("int64", BigInt64Array.from([BigInt(startToken), BigInt(languageToken)]), [1, 2]);
      const decoderFeeds: Record<string, Tensor> = {};
      decoderFeeds[decoderSession.inputNames[0]] = inputIdsTensor;
      decoderFeeds[decoderSession.inputNames[1]] = encoderHiddenStates;

      // 4. グリーディサーチによるテキスト生成ループ
      const generatedTokenIds: number[] = [];
      const maxGeneratedTokens = 224;

      let currentInputIds = inputIdsTensor;

      for (let i = 0; i < maxGeneratedTokens; i++) {
        decoderFeeds[decoderSession.inputNames[0]] = currentInputIds;
        const results = await decoderSession.run(decoderFeeds);
        const logits = results[decoderOutputName];

        const nextTokenId = findMaxLogit(logits.data as Float32Array);

        generatedTokenIds.push(nextTokenId);

        if (nextTokenId === 50257) {
          break;
        }

        currentInputIds = new Tensor("int64", BigInt64Array.from([BigInt(nextTokenId)]), [1, 1]);
      }

      const decodedText = tokenizer.decode(generatedTokenIds, {
        skip_special_tokens: true,
      });

      function findMaxLogit(logits: Float32Array): number {
        let maxLogit = -Infinity;
        let maxIndex = 0;
        for (let i = 0; i < logits.length; i++) {
          if (logits[i] > maxLogit) {
            maxLogit = logits[i];
            maxIndex = i;
          }
        }
        return maxIndex;
      }

      return decodedText;
    } catch (error) {
      console.error("Failed to run inference:", error);
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
