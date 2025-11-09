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
        candidate_urls = [
            f"https://www.youtube.com/watch?v={video_id}",
            f"https://www.youtube.com/shorts/{video_id}",
            f"https://youtu.be/{video_id}",
        ]

        yt = None
        last_error = None

        for candidate_url in candidate_urls:
            app.logger.info("Tentando inicializar pytube com URL: %s", candidate_url)
            try:
                yt = YouTube(candidate_url, use_oauth=False, allow_oauth_cache=False)
                video_url = candidate_url
                break
            except VideoUnavailable as exc:
                last_error = exc
                app.logger.warning("Video indisponivel para URL %s: %s", candidate_url, exc)
            except HTTPError as http_err:
                last_error = http_err
                app.logger.warning("HTTPError ao inicializar pytube com URL %s: %s", candidate_url, http_err)
            except PytubeError as exc:
                last_error = exc
                app.logger.warning("PytubeError ao inicializar pytube com URL %s: %s", candidate_url, exc)

        if yt is None:
            if isinstance(last_error, VideoUnavailable):
                return jsonify({"error": "Video indisponivel", "message": "O video esta bloqueado ou nao pode ser reproduzido."}), 403
            if isinstance(last_error, HTTPError):
                return jsonify({"error": "HTTPError", "message": "YouTube retornou erro 400 ao tentar acessar o vídeo."}), 502
            if last_error:
                app.logger.exception("Falha ao inicializar pytube para o video %s", video_id)
                return jsonify({"error": "Erro pytube", "message": str(last_error)}), 500
            return jsonify({"error": "Erro pytube", "message": "Nao foi possivel inicializar pytube para este video"}), 500

        video_url = candidate_url
        app.logger.info("Iniciando download via pytube: %s", video_url)

        def fetch_stream(target: YouTube):
            return (
                target.streams
                .filter(progressive=True, file_extension="mp4")
                .order_by("resolution")
                .desc()
                .first()
            )

        try:
            stream = fetch_stream(yt)
        except HTTPError as http_err:
            app.logger.warning("HTTPError ao obter streams do video %s: %s", video_id, http_err)
            try:
                app.logger.info("Tentando bypass_age_gate para %s", video_id)
                yt.bypass_age_gate()
                stream = fetch_stream(yt)
            except Exception as sub_exc:  # pylint: disable=broad-except
                app.logger.warning("Falha ao aplicar bypass_age_gate: %s", sub_exc)
                return jsonify(
                    {
                        "error": "HTTPError",
                        "message": "Nao foi possivel obter as streams do video. O YouTube retornou erro 400.",
                    }
                ), 502
        except PytubeError as exc:
            app.logger.exception("Erro do pytube ao processar streams do video %s", video_id)
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
