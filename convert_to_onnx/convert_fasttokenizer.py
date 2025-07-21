import sys
from pathlib import Path
from transformers import AutoTokenizer

def save_tokenizer(model_name: str, output_path: str):
    """
    Hugging Faceモデルのトークナイザーをファストトークナイザー形式で保存します。
    """
    print(f"トークナイザーの出力ディレクトリを作成します: {output_path}")
    Path(output_path).mkdir(parents=True, exist_ok=True)

    print(f"Hugging Faceモデル {model_name} のトークナイザーを保存します...")
    try:
        tokenizer = AutoTokenizer.from_pretrained(model_name)
        tokenizer.save_pretrained(output_path)
        print("トークナイザーが tokenizer.json として正常に保存されました。")
    except Exception as e:
        print(f"トークナイザーの保存中にエラーが発生しました: {e}")
        sys.exit(1)

# 使用例
if __name__ == "__main__":
    # 変換したいモデル名と保存先ディレクトリを指定
    model_name = "kotoba-tech/kotoba-whisper-v2.2"
    output_directory = "token"
    save_tokenizer(model_name, output_directory)