import subprocess
import sys
from pathlib import Path
import argparse

def convert_to_onnx(model_name: str, output_path: str):
    """
    Hugging Faceモデルをoptimum-cli経由でONNX形式に変換します。

    Args:
        model_name (str): 変換したいHugging Faceモデルの名前（例: "kotoba-tech/kotoba-whisper-v2.2"）。
        output_path (str): ONNXモデルの保存先ディレクトリ。
    """
    print(f"ONNXモデルの出力ディレクトリを作成します: {output_path}")
    Path(output_path).mkdir(parents=True, exist_ok=True)

    print(f"Hugging Faceモデル {model_name} をoptimum-cli経由でONNX形式に変換します...")

    # optimum-cli export onnx コマンドを構築
    # --task 引数で音声認識モデルであることを明示的に指定します
    # Whisperモデルの場合、`automatic-speech-recognition`が一般的なタスク名です。
    command = [
        "optimum-cli",
        "export",
        "onnx",
        "--model",
        model_name,
        output_path,
        "--task",
        "automatic-speech-recognition" # Whisperモデルのタスクを指定
    ]

    print(f"実行コマンド: {' '.join(command)}")

    try:
        # サブプロセスとしてコマンドを実行
        # check=True は、コマンドが非ゼロの終了コードを返した場合にCalledProcessErrorを発生させます
        subprocess.run(command, check=True, capture_output=True, text=True)
        print(f"ONNXモデルが {output_path} に正常に保存されました。")
        print("--- optimum-cli 出力 ---")
        # subprocess.runの出力は、コマンドが成功しても表示されないため、ここでは表示しない
        # もし詳細な出力が必要な場合は、capture_output=False にするか、stdout/stderr を表示するロジックを追加
        print("------------------------")

    except subprocess.CalledProcessError as e:
        print(f"ONNX変換中にエラーが発生しました: {e}")
        print(f"標準出力: {e.stdout}")
        print(f"標準エラー: {e.stderr}")
        sys.exit(1) # スクリプトをエラー終了
    except FileNotFoundError:
        print("エラー: 'optimum-cli' コマンドが見つかりません。")
        print("requirements.txtに'optimum[exporters]'が正しくインストールされているか確認してください。")
        sys.exit(1) # スクリプトをエラー終了
    
    print("ONNXモデルの変換が完了しました。")

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Convert a Hugging Face model to ONNX format using optimum-cli.")
    parser.add_argument("--model_name", type=str, required=True, help="Name of the Hugging Face model to convert.")
    parser.add_argument("--output_path", type=str, default="./onnx_model", help="Directory to save the ONNX model.")
    args = parser.parse_args()

    convert_to_onnx(args.model_name, args.output_path)