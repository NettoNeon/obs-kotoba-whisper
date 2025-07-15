import { contextBridge, ipcRenderer } from "electron";

contextBridge.exposeInMainWorld("electron", {
  getModelPath: () => ipcRenderer.invoke("get-model-path"),
});