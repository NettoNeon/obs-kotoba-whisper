export {}; // これがないとモジュールと認識されません

interface ElectronAPI {
  getModelPath: () => Promise<string>;
  loadModel: () => Promise<boolean>;
  runInference: (audioData: Float32Array) => Promise<string>;
  getAppMetrics: () => Promise<any>;
  getGPUBasicInfo: () => Promise<any>;
  getGPUCompleteInfo: () => Promise<any>;
  getGPUFeatureStatus: () => Promise<any>;
}

declare global {
  interface Window {
    electron: ElectronAPI;
  }
}
