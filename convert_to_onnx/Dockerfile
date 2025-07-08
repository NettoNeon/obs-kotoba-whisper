# ベースイメージはPythonの公式イメージを使用します
FROM python:3.9-slim-buster

# 作業ディレクトリを設定します
WORKDIR /app

# 依存関係をインストールします
COPY requirements.txt .

# PyTorchのCPU版をインストールするための追加URLを指定
# PyTorchのバージョンに合わせてURLを調整してください (例: cu118をcpuに)
# 最新のURLは https://download.pytorch.org/whl/torch_stable.html で確認できます
RUN pip install --no-cache-dir -r requirements.txt -f https://download.pytorch.org/whl/cpu/torch_stable.html

# スクリプトをコンテナにコピーします
COPY convert_to_onnx.py .
COPY run_conversion.sh .

# 実行権限を付与します
RUN chmod +x run_conversion.sh

# デフォルトのコマンドを設定します
CMD ["./run_conversion.sh"]