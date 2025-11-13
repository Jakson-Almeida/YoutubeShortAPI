import os
import re
import tempfile
from io import BytesIO

from urllib.error import HTTPError

from flask import Flask, jsonify, request, send_file
from flask_cors import CORS

app = Flask(__name__)
CORS(app)

# Importações com fallback
try:
    import yt_dlp
    YT_DLP_AVAILABLE = True
except ImportError:
    YT_DLP_AVAILABLE = False
    app.logger.warning("yt-dlp não está disponível. Instale com: pip install yt-dlp")

try:
    from pytube import YouTube
    from pytube.exceptions import PytubeError, VideoUnavailable
    PYTUBE_AVAILABLE = True
except ImportError:
    PYTUBE_AVAILABLE = False
    app.logger.warning("pytube não está disponível. Instale com: pip install pytube")


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
    methods = []
    if YT_DLP_AVAILABLE:
        methods.append("yt-dlp")
    if PYTUBE_AVAILABLE:
        methods.append("pytube")
    
    message = f"Python backend ativo. Métodos disponíveis: {', '.join(methods) if methods else 'nenhum'}"
    return jsonify({"status": "OK", "message": message, "methods": methods})


def download_with_ytdlp(video_id: str):
    """
    Tenta baixar o vídeo usando yt-dlp (PRIMEIRA PRIORIDADE).
    Retorna (success, buffer, filename, error_message)
    """
    if not YT_DLP_AVAILABLE:
        return False, None, None, "yt-dlp não está instalado"

    candidate_urls = [
        f"https://www.youtube.com/watch?v={video_id}",
        f"https://www.youtube.com/shorts/{video_id}",
        f"https://youtu.be/{video_id}",
    ]

    for video_url in candidate_urls:
        try:
            app.logger.info("Tentando download com yt-dlp: %s", video_url)
            
            # Configuração do yt-dlp para baixar em formato compatível (H.264/AVC1)
            # Prioriza: H.264 (avc1) que é universalmente suportado (Windows, Android, Linux, Mac)
            # Evita: AV1 (av01) que não é suportado pelo player do Windows
            # Formato: MP4 com codec H.264 para máxima compatibilidade
            ydl_opts = {
                # Prioriza vídeo H.264 (avc1) + áudio AAC
                # Exclui explicitamente AV1 (av01) para garantir compatibilidade
                # Ordem de prioridade:
                # 1. Melhor vídeo H.264 MP4 + melhor áudio AAC
                # 2. Melhor vídeo H.264 (qualquer container) + melhor áudio AAC
                # 3. Melhor vídeo MP4 (exceto AV1) + melhor áudio
                # 4. Melhor qualidade geral (exceto AV1)
                'format': 'bestvideo[vcodec^=avc1][ext=mp4]+bestaudio[acodec^=mp4a][ext=m4a]/'
                         'bestvideo[vcodec^=avc1]+bestaudio[acodec^=mp4a]/'
                         'bestvideo[ext=mp4][vcodec!*=av01][vcodec!*=vp09]+bestaudio[ext=m4a]/'
                         'bestvideo[ext=mp4][vcodec!*=av01]+bestaudio[ext=m4a]/'
                         'best[ext=mp4][vcodec!*=av01]/best[vcodec!*=av01]',
                'merge_output_format': 'mp4',  # Garante que o merge seja MP4
                'outtmpl': '%(title)s.%(ext)s',
                'quiet': True,
                'no_warnings': True,
                'noplaylist': True,
                'extract_flat': False,
            }

            buffer = BytesIO()
            
            # Usar yt-dlp para baixar diretamente para o buffer
            with tempfile.TemporaryDirectory() as tmpdir:
                ydl_opts['outtmpl'] = os.path.join(tmpdir, '%(title)s.%(ext)s')
                
                with yt_dlp.YoutubeDL(ydl_opts) as ydl:
                    # Obter informações do vídeo primeiro
                    info = ydl.extract_info(video_url, download=False)
                    title = info.get('title', 'video')
                    filename = f"{slugify(title)}.mp4"
                    
                    # Baixar o vídeo
                    ydl.download([video_url])
                    
                    # Encontrar o arquivo baixado (pode ser .mp4, .webm, .mkv, etc)
                    downloaded_files = [f for f in os.listdir(tmpdir) 
                                       if os.path.isfile(os.path.join(tmpdir, f)) 
                                       and f.endswith(('.mp4', '.webm', '.mkv', '.m4a'))]
                    
                    if not downloaded_files:
                        app.logger.warning("Nenhum arquivo baixado encontrado em %s", tmpdir)
                        continue
                    
                    # Priorizar arquivos MP4
                    mp4_files = [f for f in downloaded_files if f.endswith('.mp4')]
                    downloaded_file = os.path.join(tmpdir, mp4_files[0] if mp4_files else downloaded_files[0])
                    
                    # Ler o arquivo para o buffer
                    with open(downloaded_file, 'rb') as f:
                        buffer.write(f.read())
                    
                    buffer.seek(0)
                    app.logger.info("Download concluído com yt-dlp: %s (tamanho: %d bytes)", 
                                  filename, buffer.getbuffer().nbytes)
                    return True, buffer, filename, None

        except Exception as exc:  # pylint: disable=broad-except
            app.logger.warning("Erro ao baixar com yt-dlp (%s): %s", video_url, str(exc))
            import traceback
            app.logger.debug(traceback.format_exc())
            continue
    
    return False, None, None, "yt-dlp falhou para todas as URLs tentadas"


def download_with_pytube(video_id: str):
    """
    Tenta baixar o vídeo usando pytube (FALLBACK).
    Retorna (success, buffer, filename, error_message)
    """
    if not PYTUBE_AVAILABLE:
        return False, None, None, "pytube não está instalado"

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
        error_msg = "Não foi possível inicializar pytube para este vídeo"
        if isinstance(last_error, VideoUnavailable):
            error_msg = "O vídeo está bloqueado ou não pode ser reproduzido"
        elif isinstance(last_error, HTTPError):
            error_msg = "YouTube retornou erro ao tentar acessar o vídeo"
        return False, None, None, error_msg

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
            return False, None, None, "Não foi possível obter as streams do vídeo. O YouTube retornou erro 400."
    except PytubeError as exc:
        app.logger.exception("Erro do pytube ao processar streams do video %s", video_id)
        return False, None, None, f"Erro pytube: {str(exc)}"

    if stream is None:
        app.logger.warning("Nenhum stream compativel encontrado para o video %s", video_id)
        return False, None, None, "Nenhum stream compatível encontrado para este vídeo"

    try:
        buffer = BytesIO()
        stream.stream_to_buffer(buffer)
        buffer.seek(0)
        filename = f"{slugify(yt.title)}.mp4"
        app.logger.info("Download concluído com pytube: %s", filename)
        return True, buffer, filename, None
    except Exception as exc:  # pylint: disable=broad-except
        app.logger.exception("Erro ao fazer stream para buffer: %s", exc)
        return False, None, None, f"Erro ao processar stream: {str(exc)}"


@app.get("/api/download")
def download_video():
    """
    Endpoint principal chamado pelo frontend quando o usuario clica em
    "Baixar video". Ele recebe o ID do video via querystring.
    
    PRIORIDADE DE DOWNLOAD:
    1. yt-dlp (PRIMEIRA TENTATIVA - mais confiável e atualizado)
    2. pytube (FALLBACK - caso yt-dlp falhe)
    
    Retorna o binário do vídeo MP4 diretamente.
    """
    video_id = request.args.get("videoId")
    if not video_id:
        return jsonify({"error": "ID do video nao fornecido"}), 400

    # TENTATIVA 1: yt-dlp (PRIMEIRA PRIORIDADE)
    if YT_DLP_AVAILABLE:
        app.logger.info("Tentando download com yt-dlp (método prioritário) para vídeo: %s", video_id)
        success, buffer, filename, error_msg = download_with_ytdlp(video_id)
        
        if success:
            return send_file(
                buffer,
                as_attachment=True,
                download_name=filename,
                mimetype="video/mp4"
            )
        else:
            app.logger.warning("yt-dlp falhou: %s. Tentando pytube como fallback...", error_msg)
    else:
        app.logger.warning("yt-dlp não disponível. Usando pytube...")

    # TENTATIVA 2: pytube (FALLBACK)
    if PYTUBE_AVAILABLE:
        app.logger.info("Tentando download com pytube (fallback) para vídeo: %s", video_id)
        success, buffer, filename, error_msg = download_with_pytube(video_id)
        
        if success:
            return send_file(
                buffer,
                as_attachment=True,
                download_name=filename,
                mimetype="video/mp4"
            )
        else:
            app.logger.error("pytube também falhou: %s", error_msg)
            return jsonify({
                "error": "Falha no download",
                "message": f"Ambos os métodos falharam. yt-dlp: {'disponível mas falhou' if YT_DLP_AVAILABLE else 'não disponível'}. pytube: {error_msg}"
            }), 500
    else:
        return jsonify({
            "error": "Nenhum método disponível",
            "message": "Nenhum método de download está disponível. Instale yt-dlp (recomendado) ou pytube."
        }), 503

    # Se chegou aqui, algo deu muito errado
    return jsonify({
        "error": "Erro desconhecido",
        "message": "Não foi possível processar o download"
    }), 500


if __name__ == "__main__":
    port = int(os.getenv("PORT", "5000"))
    app.run(host="0.0.0.0", port=port)
