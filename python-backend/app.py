import os
import re
from io import BytesIO

from flask import Flask, jsonify, request, send_file
from flask_cors import CORS
from pytube import YouTube

app = Flask(__name__)
CORS(app)


def slugify(value: str) -> str:
    safe = re.sub(r"[^a-zA-Z0-9_-]", "_", value)
    # limitar tamanho do arquivo e evitar string vazia
    safe = safe.strip("_") or "video"
    return safe[:80]


@app.get("/api/health")
def health_check():
    return jsonify({"status": "OK", "message": "Python backend com pytube ativo"})


@app.get("/api/download")
def download_video():
    video_id = request.args.get("videoId")
    if not video_id:
        return jsonify({"error": "ID do video nao fornecido"}), 400

    try:
        video_url = f"https://www.youtube.com/watch?v={video_id}"
        yt = YouTube(video_url)

        stream = (
            yt.streams
            .filter(progressive=True, file_extension="mp4")
            .order_by("resolution")
            .desc()
            .first()
        )

        if stream is None:
            return jsonify({"error": "Nenhum stream compativel encontrado para este video"}), 404

        buffer = BytesIO()
        stream.stream_to_buffer(buffer)
        buffer.seek(0)

        filename = f"{slugify(yt.title)}.mp4"

        return send_file(
            buffer,
            as_attachment=True,
            download_name=filename,
            mimetype="video/mp4"
        )
    except Exception as exc:  # pylint: disable=broad-except
        return jsonify({"error": "Erro ao baixar video", "message": str(exc)}), 500


if __name__ == "__main__":
    port = int(os.getenv("PORT", "5000"))
    app.run(host="0.0.0.0", port=port)
