const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  sendAudio: (data) => {
    ipcRenderer.send('audio-data', data);
  },
  onTranscription: (callback) => {
    ipcRenderer.on('transcription', (event, text) => {
      callback(text);
    });
  }
});
