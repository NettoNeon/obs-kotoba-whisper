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
      process(inputs) {
        const inputChannel = inputs[0][0];
        if (!inputChannel) return true;

        // そのままデータをメインスレッドに送信
        this.port.postMessage(inputChannel.buffer, [inputChannel.buffer]);
        return true;
      }
    }
    registerProcessor('microphone-processor', MicrophoneProcessor);
  `;

  // --- 定数 ---
  const SAMPLE_RATE = 16000; // AudioWorkletから送られてくるデータのサンプルレート（Hz）
  const VOICE_THRESHOLD = 0.005; // 音声と判断する閾値
  const SILENCE_THRESHOLD_FRAMES = Math.round((0.8 * SAMPLE_RATE) / 128); // 0.8秒間の無音で発話終了と判断 (128はworkletのフレームサイズ)（100フレーム）
  const MAX_AUDIO_LENGTH_S = 5; // 最大録音時間（秒）

  // --- 状態管理用の変数 ---
  let _audioBuffer = new Float32Array();
  let _isSpeaking = false;
  let _silenceCount = 0;

  // AudioWorkletNodeからのメッセージを受け取る（VAD・自動推論トリガー）
  const handleWorkletMessage = (event: MessageEvent) => {
    // The data from the worklet is an ArrayBuffer, so we create a Float32Array view
    const newData = new Float32Array(event.data);

    // 入力音声データに音声が含まれているかチェック
    const isVoiceDetected = newData.some((sample) => Math.abs(sample) > VOICE_THRESHOLD);

    if (_isSpeaking) {
      // --- 発話中の処理 ---
      // 新しいデータをバッファに追加
      const newBuffer = new Float32Array(_audioBuffer.length + newData.length);
      newBuffer.set(_audioBuffer);
      newBuffer.set(newData, _audioBuffer.length);
      _audioBuffer = newBuffer;

      if (isVoiceDetected) {
        // 音声が検出されたら無音カウントをリセット
        _silenceCount = 0;
      } else {
        // 無音フレームをカウント
        _silenceCount++;
      }

      // 無音が続いたか、最大長に達したら文字起こし実行
      if (_silenceCount > SILENCE_THRESHOLD_FRAMES || _audioBuffer.length >= MAX_AUDIO_LENGTH_S * SAMPLE_RATE) {
        if (_audioBuffer.length > SAMPLE_RATE * 0.5) {
          // 0.5秒未満の音声は無視
          AudioData.value = _audioBuffer;
        }
        // 状態をリセット
        _audioBuffer = new Float32Array();
        _isSpeaking = false;
        _silenceCount = 0;
      }
    } else {
      // --- 待機中の処理 ---
      if (isVoiceDetected) {
        // 音声が検出されたら発話開始
        _isSpeaking = true;
        _audioBuffer = new Float32Array(newData); // 新しいデータからバッファを開始
        _silenceCount = 0;
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
      _audioContext = new AudioContext({ sampleRate: SAMPLE_RATE });
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
