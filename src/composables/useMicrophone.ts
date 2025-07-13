import { ref } from "vue";

export function useMicrophone() {
  const Stream = ref<MediaStream | null>(null);
  const IsRecording = ref(false);
  const ERROR = ref<string | null>(null);

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

  return {
    stream: Stream,
    isRecording: IsRecording,
    error: ERROR,
    getMicrophone,
    stopMicrophone,
  };
}
