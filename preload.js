import { contextBridge, ipcRenderer } from "electron";

document.getElementById("mic-permission").addEventListener("click", requestMicrophoneAccess);

async function requestMicrophoneAccess() {
  try {
    const granted = await ipcRenderer.invoke("ask:mic-permission");
    if (granted) {
      console.log("マイクアクセスが許可されました。");
      // マイクを使用した処理を開始できます
      // 例: navigator.mediaDevices.getUserMedia({ audio: true })
    } else {
      console.log("マイクアクセスが拒否されました。");
      // ユーザーに許可を促すメッセージを表示するなど
    }
  } catch (error) {
    console.error("マイクアクセス要求中にエラーが発生しました:", error);
  }
}

contextBridge.exposeInMainWorld("electronAPI", {
  sendAudioData: (audioData) => ipcRenderer.send("audio-data", audioData),
  receiveTranscription: (callback) => ipcRenderer.on("transcription-result", (event, text) => callback(text)),
});
