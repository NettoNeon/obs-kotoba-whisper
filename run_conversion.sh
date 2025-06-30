#!/bin/bash

# 変換したいHugging Faceモデルの名前
MODEL_NAME="kotoba-tech/kotoba-whisper-v2.2" 

# ONNXモデルの出力ディレクトリ
OUTPUT_DIR="/app/onnx_model"

echo "Hugging Faceモデル ${MODEL_NAME} をONNX形式に変換します..."
python convert_to_onnx.py --model_name "${MODEL_NAME}" --output_path "${OUTPUT_DIR}"

if [ $? -eq 0 ]; then
    echo "ONNX変換が正常に完了しました。"
    echo "ONNXモデルは ${OUTPUT_DIR} に出力されています。"
    # 必要であれば、ここでONNXモデルのバリデーションやONNX Runtimeでの簡単な推論テストを追加できます
    # ONNX Runtimeで音声認識の推論を行うコードは、通常の分類モデルよりも複雑になります。
    # PythonでONNX Runtimeを使ってWhisperモデルをロードし、推論を行う例を参考にしてください。
else
    echo "ONNX変換中にエラーが発生しました。"
    exit 1
fi