export {}; // これがないとモジュールと認識されません

interface ElectronAPI {
  getModelPath: () => Promise<string>;
  loadModel: () => Promise<boolean>;
  runInference: (audioData: Float32Array) => Promise<string>;
}

declare global {
  interface Window {
    electron: ElectronAPI;
  }
}
