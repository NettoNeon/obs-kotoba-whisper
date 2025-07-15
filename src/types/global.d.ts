export {}; // これがないとモジュールと認識されません

interface ElectronAPI {
  getModelPath: () => Promise<string>;
}

declare global {
  interface Window {
    electron: ElectronAPI;
  }
}
