import { contextBridge, ipcRenderer } from "electron";

contextBridge.exposeInMainWorld("electron", {
  getModelPath: () => ipcRenderer.invoke("get-model-path"),
  loadModel: () => ipcRenderer.invoke("load-model"),
  runInference: (audioData: Float32Array) => ipcRenderer.invoke("run-inference", audioData),
});
