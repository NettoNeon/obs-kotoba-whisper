import { app, BrowserWindow, session as electronSession, ipcMain } from "electron";
import started from "electron-squirrel-startup";
// import { env, AutoTokenizer } from "@huggingface/transformers";
// Cannot read properties of undefined (reading 'get')
const { env, AutoTokenizer, AutoProcessor } = require("@huggingface/transformers");
import { InferenceSession, Tensor } from "onnxruntime-node";
import fs from "fs";
import path from "node:path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

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
    // オーディオ状況の確認
    // console.log("audioData size:", audioData.length);
    // const isAllZeros = audioData.every((val) => val === 0);
    // console.log("Is audioData all zeros?", isAllZeros);
    if (!encoderSession || !decoderSession) {
      console.error("Inference session not initialized.");
      return null;
    }
    try {
      // 1. エンコーダ推論
      // Whisperモデルは固定長の入力を期待するため、30秒（3000フレーム）にパディング/トランケーションする
      const FEATURE_SIZE = 128; // モデルが期待する特徴量サイズ (通常80)
      const expectedFrames = 3000;
      const totalExpectedValues = FEATURE_SIZE * expectedFrames;

      let processedAudioData: Float32Array;
      if (audioData.length > totalExpectedValues) {
        // 長すぎる場合は切り詰める
        processedAudioData = audioData.slice(0, totalExpectedValues);
      } else if (audioData.length < totalExpectedValues) {
        // 短い場合は0でパディングする
        processedAudioData = new Float32Array(totalExpectedValues);
        processedAudioData.set(audioData);
      } else {
        processedAudioData = audioData;
      }

      const numFrames = processedAudioData.length / FEATURE_SIZE;
      // ONNXモデルが期待する入力形状 [batch_size, feature_size, sequence_length] に合わせる
      const encoderInput = new Tensor("float32", processedAudioData, [1, FEATURE_SIZE, numFrames]);
      const encoderFeeds: Record<string, Tensor> = {};
      encoderFeeds[encoderSession.inputNames[0]] = encoderInput;
      const encoderResults = await encoderSession.run(encoderFeeds);
      // encoder_hidden_statesの出力名を取得
      const encoderOutputName = encoderSession.outputNames[0];
      const encoderHiddenStates = encoderResults[encoderOutputName];
      const decoderOutputName = decoderSession.outputNames[0];

      // 2. デコーダ推論
      // input_ids: 開始トークン（Whisperの場合50257や1など）
      // ここでは1トークンのみ仮で生成
      const startToken = 50258; // <|startoftranscript|>
      const inputIdsTensor = new Tensor("int64", BigInt64Array.from([BigInt(startToken)]), [1, 1]);
      const decoderFeeds: Record<string, Tensor> = {};
      decoderFeeds[decoderSession.inputNames[0]] = inputIdsTensor;
      decoderFeeds[decoderSession.inputNames[1]] = encoderHiddenStates;

      // 4. トークナイザーによるデコード
      env.localModelPath = path.join(app.getAppPath());
      env.allowRemoteModels = false;
      const tokenizer = await AutoTokenizer.from_pretrained("models", { local_files_only: true });

      // モデルの出力をトークンIDに変換し、テキストを生成するデコーディングループ
      const generatedTokenIds: number[] = [];

      // デコーダの入力として、スタートトークンとエンコーダの出力を設定
      const decoderInputIds = new Tensor("int64", BigInt64Array.from([BigInt(startToken)]), [1, 1]);
      const decoderHiddenStates = encoderHiddenStates;

      const decoderNextFeeds: Record<string, Tensor> = {};
      decoderNextFeeds[decoderSession.inputNames[0]] = decoderInputIds;
      decoderNextFeeds[decoderSession.inputNames[1]] = decoderHiddenStates;

      // 最大224トークンまで生成する（Whisper large-v3のmax_length）
      const maxGeneratedTokens = 224;

      for (let i = 0; i < maxGeneratedTokens; i++) {
        // デコーダを実行
        const results = await decoderSession.run(decoderNextFeeds);
        const logits = results[decoderOutputName];

        // Logitsから最大値（最も可能性の高いトークンID）を特定
        const nextTokenId = findMaxLogit(logits.data as Float32Array);

        // 予測されたトークンIDを配列に追加
        generatedTokenIds.push(nextTokenId);

        // 終了トークン（<|endoftext|>）が生成されたらループを抜ける
        if (nextTokenId === 50257) {
          // 50257はWhisperの終了トークン
          break;
        }

        // 次のデコーダ入力として、新しいトークンIDを設定
        decoderNextFeeds[decoderSession.inputNames[0]] = new Tensor("int64", BigInt64Array.from([BigInt(nextTokenId)]), [1, 1]);
      }

      // 最後に、生成されたすべてのトークンIDをデコード
      const decodedText = tokenizer.decode(generatedTokenIds, {
        skip_special_tokens: false,
      });

      // デコーダーが受け取る「最も可能性の高いトークンID」を返すヘルパー関数
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
      console.log(decodedText);

      return decodedText;
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
