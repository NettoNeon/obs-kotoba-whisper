// This file is required by the index.html file and will
// be executed in the renderer process for that window.
// All of the Node.js APIs are available in this process.

const startButton = document.getElementById('startButton');
const stopButton = document.getElementById('stopButton');
const statusDiv = document.getElementById('status');
const transcriptionDiv = document.getElementById('transcription');

let mediaRecorder;
let audioChunks = [];

startButton.addEventListener('click', async () => {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    statusDiv.textContent = 'ステータス: 録音中...';
    startButton.disabled = true;
    stopButton.disabled = false;

    mediaRecorder = new MediaRecorder(stream);
    mediaRecorder.ondataavailable = (event) => {
      audioChunks.push(event.data);
    };

    mediaRecorder.onstop = () => {
      const audioBlob = new Blob(audioChunks, { type: 'audio/webm' });
      const reader = new FileReader();
      reader.onload = () => {
        const buffer = Buffer.from(reader.result);
        // メインプロセスへ音声データを送信
        console.log('Sending audio data to main process...');
        window.api.sendAudio(buffer);
      };
      reader.readAsArrayBuffer(audioBlob);
      audioChunks = [];
    };

    mediaRecorder.start();

  } catch (error) {
    console.error('Error accessing microphone:', error);
    statusDiv.textContent = 'エラー: マイクにアクセスできません。';
  }
});

stopButton.addEventListener('click', () => {
  if (mediaRecorder && mediaRecorder.state === 'recording') {
    mediaRecorder.stop();
    statusDiv.textContent = 'ステータス: 停止';
    startButton.disabled = false;
    stopButton.disabled = true;
  }
});

// メインプロセスからの文字起こし結果を受信
window.api.onTranscription((text) => {
  transcriptionDiv.innerHTML = `<p>${text}</p>`;
});
