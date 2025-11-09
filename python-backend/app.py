import os
import re
from io import BytesIO

from urllib.error import HTTPError

from flask import Flask, jsonify, request, send_file
from flask_cors import CORS
from pytube import YouTube
from pytube.exceptions import PytubeError, VideoUnavailable

app = Flask(__name__)
CORS(app)


def slugify(value: str) -> str:
    """
    Formata o titulo do video para ser utilizado como nome de arquivo.
    Remove caracteres nao permitidos e limita o tamanho do resultado.
    """
    safe = re.sub(r"[^a-zA-Z0-9_-]", "_", value)
    # limitar tamanho do arquivo e evitar string vazia
    safe = safe.strip("_") or "video"
    return safe[:80]


@app.get("/api/health")
def health_check():
    return jsonify({"status": "OK", "message": "Python backend com pytube ativo"})


@app.get("/api/download")
def download_video():
    """
    Endpoint principal chamado pelo frontend quando o usuario clica em
    "Baixar video". Ele recebe o ID do video via querystring, utiliza
    pytube para localizar o stream MP4 e devolve o binario diretamente.
    """
    video_id = request.args.get("videoId")
    if not video_id:
        return jsonify({"error": "ID do video nao fornecido"}), 400

    try:
        video_url = f"https://www.youtube.com/watch?v={video_id}"
        app.logger.info("Iniciando download via pytube: %s", video_url)

        try:
            yt = YouTube(video_url, use_oauth=False, allow_oauth_cache=False)
        except VideoUnavailable:
            return (
                jsonify(
                    {
                        "error": "Video indisponivel",
                        "message": "O video esta bloqueado ou nao pode ser reproduzido.",
                    }
                ),
                403,
            )
        except HTTPError as http_err:
            app.logger.warning("HTTPError ao inicializar pytube (provavel restricao do video): %s", http_err)
            return jsonify(
                {
                    "error": "HTTPError",
                    "message": "YouTube retornou erro 400. Este video pode ter restricoes que impedem o download direto.",
                }
            ), 502
        except PytubeError as exc:
            app.logger.exception("Erro do pytube ao inicializar o video %s", video_id)
            return jsonify({"error": "Erro pytube", "message": str(exc)}), 500

        try:
            stream = (
                yt.streams
                .filter(progressive=True, file_extension="mp4")
                .order_by("resolution")
                .desc()
                .first()
            )
        except HTTPError as http_err:
            app.logger.warning(
                "HTTPError ao obter streams do video %s: %s", video_id, http_err
            )
            return jsonify(
                {
                    "error": "HTTPError",
                    "message": "Nao foi possivel obter as streams do video. O YouTube retornou erro 400.",
                }
            ), 502
        except PytubeError as exc:
            app.logger.exception(
                "Erro do pytube ao processar streams do video %s", video_id
            )
            return jsonify({"error": "Erro pytube", "message": str(exc)}), 500

        if stream is None:
            app.logger.warning(
                "Nenhum stream compativel encontrado para o video %s", video_id
            )
            return jsonify({"error": "Nenhum stream compativel encontrado para este video"}), 404

        buffer = BytesIO()
        stream.stream_to_buffer(buffer)
        buffer.seek(0)

        filename = f"{slugify(yt.title)}.mp4"

        app.logger.info("Download concluido: %s", filename)
        return send_file(
            buffer,
            as_attachment=True,
            download_name=filename,
            mimetype="video/mp4"
        )
    except Exception as exc:  # pylint: disable=broad-except
        app.logger.exception("Erro ao processar video %s", video_id)
        return jsonify({"error": "Erro ao baixar video", "message": str(exc)}), 500


if __name__ == "__main__":
    port = int(os.getenv("PORT", "5000"))
    app.run(host="0.0.0.0", port=port)
