import { pipeline, env } from "@huggingface/transformers";
import path from "path";
import fs from "fs";
import decode, { decoders } from "audio-decode"; // npm install audio-decode でインストールしてください
await decoders.mp3(); // load & compile decoder

env.localModelPath = "./";
env.allowRemoteModels = false; // リモートからのモデルダウンロードを許可しない

async function main() {
  const modelName = "kotoba-tech/kotoba-whisper-v2.2"; // モデル名
  const audioFilePath = path.join("./public", "sample_diarization_japanese.mp3");

  // --- 音声ファイルの準備 ---
  // 音声ファイルが存在するか確認
  if (!fs.existsSync(audioFilePath)) {
    console.error(`エラー: 音声ファイルが ${audioFilePath} に見つかりません。ダウンロードして 'public' フォルダに配置してください。`);
    // 'kotoba-whisper-v2.2' のサンプル音声を使っているので、ダウンロードコマンドもそれに合わせる
    console.error("ダウンロードコマンド: wget https://huggingface.co/kotoba-tech/kotoba-whisper-v2.2/resolve/main/sample_audio/sample_diarization_japanese.mp3");
    return;
  }

  // MP3ファイルを読み込む
  const audioBufferData = fs.readFileSync(audioFilePath);

  let audioBuffer; // 型アノテーションを削除
  try {
    // MP3ファイルをAudioBufferにデコードします。
    // '@huggingface/transformers'のパイプラインは、通常デコード済みの生のオーディオデータ（AudioBufferやFloat32Array）を期待します。
    audioBuffer = await decoders.mp3(audioBufferData); // 型アサーションを削除
    console.log("音声をデコードしました。");
  } catch (error) {
    console.error("音声ファイルのデコード中にエラーが発生しました:", error);
    console.error("ヒント: `audio-decode`ライブラリが正しくインストールされ、動作していることを確認してください。");
    return;
  }

  let rawAudioData = audioBuffer.getChannelData(0);
  // Whisperモデルが期待するサンプリングレート (通常16000 Hz)
  const targetSampleRate = 16000;

  // サンプリングレートが異なる場合、リサンプリングを実行
  if (audioBuffer.sampleRate !== targetSampleRate) {
    console.log(`サンプリングレートを ${audioBuffer.sampleRate} Hz から ${targetSampleRate} Hz にリサンプリング中...`);
    // `@huggingface/transformers` の `AutoProcessor` を使ってリサンプリング
    // ここで直接リサンプリング機能を使う方法を探す
    // transformers.js の `resample` 関数を直接インポートするか、processor経由で利用
    // 簡潔のため、ここでは `AutoProcessor` を使った一般的なリサンプリング方法を記述します。
    // AutoProcessor はモデルの`preprocessor_config.json`から設定を読み込みます。
    // const processor = await AutoProcessor.from_pretrained("models"); // local_path を指定
    // rawAudioData = processor.feature_extractor.resample(rawAudioData, audioBuffer.sampleRate, targetSampleRate);
    // console.log("リサンプリング完了。");
  }

  // --- AutomaticSpeechRecognitionPipelineの初期化 ---
  // const pipe = await pipeline("automatic-speech-recognition", "models");
  const pipe = await pipeline("automatic-speech-recognition", "models/kotoba-whisper-v2.2-ONNX");

  // --- 音声認識の実行 ---

  console.log("--- 1. デフォルトオプションで処理中 ---");
  try {
    const result1 = await pipe(rawAudioData, {
      language: "japanese", // 日本語を指定
    }); // デコードされたAudioBufferを渡す
    console.log("結果 1:", result1);
  } catch (error) {
    console.error("デフォルトオプションでの音声処理中にエラーが発生しました:", error);
  }

  // console.log("\n--- 2. 句読点追加オプション (add_punctuation) を有効にして処理中 ---");
  // try {
  //   // 'add_punctuation' は generation_kwargs の中に含めて渡します。
  //   // これはWhisperモデルがサポートする生成時の引数です。
  //   const result2 = await pipe(rawAudioData, {
  //     // AutomaticSpeechRecognitionPipelineのcallOptionsに generation_kwargs を含める
  //     generation_kwargs: {
  //       add_punctuation: true,
  //       language: "japanese", // 日本語を指定
  //     },
  //   });
  //   console.log("結果 2 (句読点追加):", result2);
  // } catch (error) {
  //   console.error("句読点追加オプションでの音声処理中にエラーが発生しました:", error);
  // }

  // console.log("\n--- 3. 無音区間追加オプション (add_silence_end/start) を有効にして処理中 ---");
  // try {
  //   // 'add_silence_end' と 'add_silence_start' も generation_kwargs の中に含めて渡します。
  //   const result3 = await pipe(rawAudioData, {
  //     generation_kwargs: {
  //       add_silence_end: 0.5,
  //       add_silence_start: 0.5,
  //       language: "japanese", // 日本語を指定
  //     },
  //   });
  //   console.log("結果 3 (無音区間追加):", result3);
  // } catch (error) {
  //   console.error("無音区間追加オプションでの音声処理中にエラーが発生しました:", error);
  // }
}

// メイン関数を実行
main();
