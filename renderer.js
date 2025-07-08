
const startButton = document.getElementById("startButton");
const stopButton = document.getElementById("stopButton");
const statusDiv = document.getElementById("status");
const transcriptionDiv = document.getElementById("transcription");

let mediaStream = null;
let audioContext = null;
let scriptProcessor = null;
let mediaStreamSource = null;

const SAMPLE_RATE = 16000; // Whisperモデルが要求するサンプリングレート

startButton.addEventListener("click", async () => {
  try {
    statusDiv.textContent = "ステータス: マイクアクセスを要求中...";
    startButton.disabled = true;
    stopButton.disabled = false;

    mediaStream = await navigator.mediaDevices.getUserMedia({ audio: true });
    audioContext = new (window.AudioContext || window.webkitAudioContext)();

    // マイクのサンプリングレートを取得
    const inputSampleRate = audioContext.sampleRate;
    statusDiv.textContent = `ステータス: マイク入力 (${inputSampleRate}Hz) を処理中...`;

    mediaStreamSource = audioContext.createMediaStreamSource(mediaStream);

    // ScriptProcessorNodeは非推奨だが、簡単なリサンプリングとバッファリングのために使用
    // バッファサイズは2のべき乗 (256, 512, 1024, 2048, 4096, 8192, 16384)
    // ここでは4096を使用
    scriptProcessor = audioContext.createScriptProcessor(4096, 1, 1);

    scriptProcessor.onaudioprocess = (event) => {
      const inputBuffer = event.inputBuffer.getChannelData(0); // モノラルデータ

      // リサンプリング処理
      const resampledBuffer = resampleAudio(inputBuffer, inputSampleRate, SAMPLE_RATE);

      // メインプロセスに音声データを送信
      // window.electronAPI.sendAudioData は preload.js で公開されることを想定
      if (window.electronAPI && window.electronAPI.sendAudioData) {
        window.electronAPI.sendAudioData(resampledBuffer);
      } else {
        console.warn("window.electronAPI.sendAudioData is not available.");
      }
    };

    mediaStreamSource.connect(scriptProcessor);
    scriptProcessor.connect(audioContext.destination);

    statusDiv.textContent = "ステータス: 録音中...";
    transcriptionDiv.innerHTML = "<p>音声入力待機中...</p>";

  } catch (error) {
    console.error("マイクアクセスエラー:", error);
    statusDiv.textContent = `ステータス: エラー - ${error.message}`;
    startButton.disabled = false;
    stopButton.disabled = true;
  }
});

stopButton.addEventListener("click", () => {
  if (mediaStream) {
    mediaStream.getTracks().forEach(track => track.stop());
    mediaStream = null;
  }
  if (audioContext) {
    audioContext.close();
    audioContext = null;
  }
  if (scriptProcessor) {
    scriptProcessor.disconnect();
    scriptProcessor = null;
  }
  if (mediaStreamSource) {
    mediaStreamSource.disconnect();
    mediaStreamSource = null;
  }

  startButton.disabled = false;
  stopButton.disabled = true;
  statusDiv.textContent = "ステータス: 停止中";
  transcriptionDiv.innerHTML = "<p>ここに文字起こし結果が表示されます...</p>";
});

// 音声リサンプリング関数
function resampleAudio(audioBuffer, originalSampleRate, targetSampleRate) {
  if (originalSampleRate === targetSampleRate) {
    return audioBuffer;
  }

  const oldLength = audioBuffer.length;
  const newLength = Math.round(oldLength * (targetSampleRate / originalSampleRate));
  const resampledBuffer = new Float32Array(newLength);

  const ratio = originalSampleRate / targetSampleRate;
  for (let i = 0; i < newLength; i++) {
    const oldIndex = i * ratio;
    const floor = Math.floor(oldIndex);
    const ceil = Math.ceil(oldIndex);
    const frac = oldIndex - floor;

    const val1 = audioBuffer[floor];
    const val2 = audioBuffer[ceil] !== undefined ? audioBuffer[ceil] : val1; // 範囲外の場合の処理

    resampledBuffer[i] = val1 * (1 - frac) + val2 * frac;
  }
  return resampledBuffer;
}

// メインプロセスからの文字起こし結果を受信 (preload.js で公開されることを想定)
if (window.electronAPI && window.electronAPI.receiveTranscription) {
  window.electronAPI.receiveTranscription((text) => {
    transcriptionDiv.textContent = text;
  });
}
