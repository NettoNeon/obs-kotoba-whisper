import { ref } from "vue";
import { InferenceSession } from "onnxruntime-web";

type ModelLoadStatus = "loading" | "loaded" | "error";

export const useWhisper = () => {
  const modelStatus = ref<ModelLoadStatus>("loading");
  const session = ref<InferenceSession | null>(null);

  const loadModel = async (modelPath: string) => {
    try {
      modelStatus.value = "loading";
      const newSession = await InferenceSession.create(modelPath);
      session.value = newSession;
      modelStatus.value = "loaded";
      console.log("ONNX model loaded successfully.");
    } catch (error) {
      modelStatus.value = "error";
      console.error("Failed to load ONNX model:", error);
    }
  };

  return {
    modelStatus,
    loadModel,
    session,
  };
};
