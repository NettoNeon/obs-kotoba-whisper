import { ref } from "vue";

type ModelLoadStatus = "loading" | "loaded" | "error" | "unloaded";

export const useWhisper = () => {
  const modelStatus = ref<ModelLoadStatus>("unloaded");
  const transcript = ref("");

  const loadModel = async () => {
    try {
      modelStatus.value = "loading";
      const result = await window.electron.loadModel();
      if (result) {
        modelStatus.value = "loaded";
        console.log("ONNX model loaded successfully via main process.");
      } else {
        modelStatus.value = "error";
        console.error("Failed to load ONNX model via main process.");
      }
    } catch (error) {
      modelStatus.value = "error";
      console.error("Error calling loadModel:", error);
    }
  };

  const runInference = async (audioData: Float32Array) => {
    if (modelStatus.value !== "loaded") {
      console.warn("Model not loaded, skipping inference.");
      return;
    }
    try {
      const result = await window.electron.runInference(audioData);
      transcript.value = result;
    } catch (error) {
      console.error("Error during inference:", error);
    }
  };

  return {
    modelStatus,
    loadModel,
    runInference,
    transcript,
  };
};
