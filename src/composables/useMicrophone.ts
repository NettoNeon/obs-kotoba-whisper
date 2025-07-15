import { ref, watch } from "vue";

export function useMicrophone() {
  const Stream = ref<MediaStream | null>(null);
  const IsRecording = ref(false);
  const ERROR = ref<string | null>(null);
  const AudioData = ref<Float32Array | null>(null);

  let _audioContext: AudioContext | null = null;
  let _processor: ScriptProcessorNode | null = null;
  let _source: MediaStreamAudioSourceNode | null = null;

  const processAudio = (event: AudioProcessingEvent) => {
    const inputData = event.inputBuffer.getChannelData(0);
    // データをコピーして保持する
    AudioData.value = new Float32Array(inputData);
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

  watch(Stream, (newStream) => {
    if (newStream) {
      _audioContext = new AudioContext();
      _processor = _audioContext.createScriptProcessor(4096, 1, 1);
      _source = _audioContext.createMediaStreamSource(newStream);
      _source.connect(_processor);
      _processor.connect(_audioContext.destination);
      _processor.onaudioprocess = processAudio;
    } else {
      if (_source) {
        _source.disconnect();
        _source = null;
      }
      if (_processor) {
        _processor.disconnect();
        _processor.onaudioprocess = null;
        _processor = null;
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
