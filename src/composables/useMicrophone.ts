import { ref, watch } from "vue";

export function useMicrophone() {
  const Stream = ref<MediaStream | null>(null);
  const IsRecording = ref(false);
  const ERROR = ref<string | null>(null);
  const AudioData = ref<Float32Array | null>(null);

  let _audioContext: AudioContext | null = null;
  let _workletNode: AudioWorkletNode | null = null;
  let _source: MediaStreamAudioSourceNode | null = null;

  // AudioWorkletProcessorのコードを文字列で定義
  const workletProcessorCode = `
    class MicrophoneProcessor extends AudioWorkletProcessor {
      process(inputs, outputs, parameters) {
        const input = inputs[0];
        if (input && input[0]) {
          // Float32Arrayをメインスレッドに送信
          this.port.postMessage(input[0]);
        }
        return true;
      }
    }
    registerProcessor('microphone-processor', MicrophoneProcessor);
  `;

  // --- 定数 ---
  const SAMPLE_RATE = 16000; // AudioWorkletから送られてくるデータのサンプルレート（Hz）
  const INTERVAL = 1; // 1回の処理で蓄積する音声の長さ（秒）
  const EXPECTED_AUDIO_LENGTH = 30 * SAMPLE_RATE; // 音声認識モデルが期待するデータの長さ（例：30秒）
  const VOICE_THRESHOLD = 0.005; // 音声と判断する閾値

  // --- グローバル変数（バッファリング用）---
  let audioBuffer: Float32Array = new Float32Array();
  let lastSilencePosition = 0;

  // AudioWorkletNodeからのメッセージを受け取る（バッファリング・VAD・自動推論トリガー）
  const handleWorkletMessage = (event: MessageEvent) => {
    const newData = event.data as Float32Array;

    // 1. 新しいデータを既存のバッファに追加
    const newBuffer = new Float32Array(audioBuffer.length + newData.length);
    newBuffer.set(audioBuffer);
    newBuffer.set(newData, audioBuffer.length);
    audioBuffer = newBuffer;

    // バッファが期待する長さになったら処理
    if (audioBuffer.length >= EXPECTED_AUDIO_LENGTH) {
      // 2. 音声区間を検出（簡易的な音量ベースのVAD）
      let silenceDetected = false;
      let silenceIndex = -1;
      const checkRange = Math.min(audioBuffer.length, 3 * SAMPLE_RATE);
      for (let i = audioBuffer.length - checkRange; i < audioBuffer.length; i++) {
        if (Math.abs(audioBuffer[i]) < VOICE_THRESHOLD) {
          silenceIndex = i;
          silenceDetected = true;
          break;
        }
      }
      // 3. 無音区間が見つかったら、そこまでを切り出して送信
      if (silenceDetected) {
        const audioToProcess = audioBuffer.slice(0, silenceIndex);
        if (audioToProcess.length > 0) {
          AudioData.value = new Float32Array(audioToProcess); // 推論用にセット
          // 推論トリガーはAudioDataのwatch側で行う（useWhisper連携）
        }
        audioBuffer = audioBuffer.slice(silenceIndex);
        lastSilencePosition = 0;
      } else {
        // 無音区間が見つからない場合、バッファを切り詰める
        const trimLength = 5 * SAMPLE_RATE;
        if (audioBuffer.length > EXPECTED_AUDIO_LENGTH + trimLength) {
          audioBuffer = audioBuffer.slice(audioBuffer.length - EXPECTED_AUDIO_LENGTH);
        }
      }
    }
  };

  const getMicrophone = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      Stream.value = stream;
      IsRecording.value = true;
      ERROR.value = null;
    } catch (err) {
      if (err instanceof Error) {
        ERROR.value = err.message;
      } else {
        ERROR.value = "An unknown error occurred.";
      }
      IsRecording.value = false;
    }
  };

  const stopMicrophone = () => {
    if (Stream.value) {
      Stream.value.getTracks().forEach((track) => track.stop());
      Stream.value = null;
      IsRecording.value = false;
    }
  };

  watch(Stream, async (newStream) => {
    if (newStream) {
      _audioContext = new AudioContext();
      // AudioWorkletProcessorを動的に追加
      const blob = new Blob([workletProcessorCode], { type: "application/javascript" });
      const url = URL.createObjectURL(blob);
      await _audioContext.audioWorklet.addModule(url);
      _source = _audioContext.createMediaStreamSource(newStream);
      _workletNode = new AudioWorkletNode(_audioContext, "microphone-processor");
      _workletNode.port.onmessage = handleWorkletMessage;
      _source.connect(_workletNode);
    } else {
      if (_source) {
        _source.disconnect();
        _source = null;
      }
      if (_workletNode) {
        _workletNode.port.onmessage = null;
        _workletNode.disconnect();
        _workletNode = null;
      }
      if (_audioContext) {
        _audioContext.close();
        _audioContext = null;
      }
    }
  });

  return {
    stream: Stream,
    isRecording: IsRecording,
    error: ERROR,
    audioData: AudioData,
    getMicrophone,
    stopMicrophone,
  };
}
