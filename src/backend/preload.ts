import { contextBridge, ipcRenderer } from "electron";

contextBridge.exposeInMainWorld("electron", {
  getModelPath: () => ipcRenderer.invoke("get-model-path"),
  loadModel: () => ipcRenderer.invoke("load-model"),
  runInference: (audioData: Float32Array) => ipcRenderer.invoke("run-inference", audioData),
  getAppMetrics: () => ipcRenderer.invoke("get-gpu-info", "appMetrics"),
  getGPUBasicInfo: () => ipcRenderer.invoke("get-gpu-info", "gpuBasic"),
  getGPUCompleteInfo: () => ipcRenderer.invoke("get-gpu-info", "gpuComplete"),
  getGPUFeatureStatus: () => ipcRenderer.invoke("get-gpu-info", "gpuFeatureStatus"),
});
