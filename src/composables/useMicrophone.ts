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

  // AudioWorkletNodeからのメッセージを受け取る
  const handleWorkletMessage = (event: MessageEvent) => {
    const inputData = event.data;
    if (inputData instanceof Float32Array) {
      AudioData.value = new Float32Array(inputData);
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
      // destinationに繋がなくてもOK（録音のみなら）
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
