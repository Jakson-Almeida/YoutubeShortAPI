import os
import re
import tempfile
from io import BytesIO

from urllib.error import HTTPError

from flask import Flask, jsonify, request, send_file, Response, stream_with_context
from flask_cors import CORS
import json
import threading

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


@app.get("/api/formats")
def get_video_formats():
    """
    Retorna as qualidades disponíveis para um vídeo.
    """
    video_id = request.args.get("videoId")
    if not video_id:
        return jsonify({"error": "ID do video nao fornecido"}), 400

    if not YT_DLP_AVAILABLE:
        return jsonify({"error": "yt-dlp não está disponível"}), 503

    candidate_urls = [
        f"https://www.youtube.com/watch?v={video_id}",
        f"https://www.youtube.com/shorts/{video_id}",
        f"https://youtu.be/{video_id}",
    ]

    for video_url in candidate_urls:
        try:
            ydl_opts = {
                'listformats': True,
                'quiet': True,
                'no_warnings': True,
            }

            with yt_dlp.YoutubeDL(ydl_opts) as ydl:
                info = ydl.extract_info(video_url, download=False)
                
                formats = []
                seen_qualities = set()
                
                # Processar formatos disponíveis
                for fmt in info.get('formats', []):
                    # Filtrar apenas formatos de vídeo com H.264 (evitar AV1)
                    vcodec = fmt.get('vcodec', 'none')
                    if vcodec == 'none' or 'av01' in vcodec.lower():
                        continue
                    
                    height = fmt.get('height')
                    width = fmt.get('width')
                    filesize = fmt.get('filesize') or fmt.get('filesize_approx', 0)
                    format_id = fmt.get('format_id')
                    ext = fmt.get('ext', 'mp4')
                    
                    if height:
                        # Criar label de qualidade
                        if height >= 2160:
                            quality_label = "4K (2160p)"
                        elif height >= 1440:
                            quality_label = "2K (1440p)"
                        elif height >= 1080:
                            quality_label = "Full HD (1080p)"
                        elif height >= 720:
                            quality_label = "HD (720p)"
                        elif height >= 480:
                            quality_label = "SD (480p)"
                        elif height >= 360:
                            quality_label = "360p"
                        else:
                            quality_label = f"{height}p"
                        
                        quality_key = f"{height}p"
                        
                        # Evitar duplicatas e priorizar H.264
                        if quality_key not in seen_qualities or 'avc1' in vcodec.lower():
                            if quality_key in seen_qualities:
                                # Substituir se for H.264
                                formats = [f for f in formats if f.get('height') != height]
                            
                            seen_qualities.add(quality_key)
                            formats.append({
                                'format_id': format_id,
                                'quality': quality_label,
                                'height': height,
                                'width': width,
                                'filesize': filesize,
                                'filesize_mb': round(filesize / (1024 * 1024), 2) if filesize else None,
                                'vcodec': vcodec,
                                'ext': ext,
                            })
                
                # Ordenar por altura (maior primeiro)
                formats.sort(key=lambda x: x['height'], reverse=True)
                
                # Adicionar opção "Melhor qualidade disponível"
                formats.insert(0, {
                    'format_id': 'best',
                    'quality': 'Melhor qualidade disponível',
                    'height': None,
                    'width': None,
                    'filesize': None,
                    'filesize_mb': None,
                    'vcodec': None,
                    'ext': 'mp4',
                })
                
                return jsonify({
                    "formats": formats,
                    "video_id": video_id,
                    "title": info.get('title', 'Video')
                })
                
        except Exception as exc:
            app.logger.warning("Erro ao obter formatos (%s): %s", video_url, str(exc))
            continue
    
    return jsonify({"error": "Não foi possível obter formatos do vídeo"}), 500


def get_format_selector(quality=None):
    """
    Retorna a string de formato baseada na qualidade selecionada.
    """
    if quality == 'best' or quality is None:
        # Melhor qualidade disponível (H.264)
        return ('bestvideo[vcodec^=avc1][ext=mp4]+bestaudio[acodec^=mp4a][ext=m4a]/'
                'bestvideo[vcodec^=avc1]+bestaudio[acodec^=mp4a]/'
                'bestvideo[ext=mp4][vcodec!*=av01][vcodec!*=vp09]+bestaudio[ext=m4a]/'
                'bestvideo[ext=mp4][vcodec!*=av01]+bestaudio[ext=m4a]/'
                'best[ext=mp4][vcodec!*=av01]/best[vcodec!*=av01]')
    else:
        # Qualidade específica (format_id)
        return quality


def download_with_ytdlp(video_id: str, quality=None, progress_callback=None):
    """
    Tenta baixar o vídeo usando yt-dlp (PRIMEIRA PRIORIDADE).
    Retorna (success, buffer, filename, error_message)
    
    Args:
        video_id: ID do vídeo do YouTube
        quality: format_id específico ou 'best' para melhor qualidade
        progress_callback: função callback(d, status) para progresso
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
            app.logger.info("Tentando download com yt-dlp: %s (qualidade: %s)", video_url, quality or 'best')
            
            # Configuração do yt-dlp para baixar em formato compatível (H.264/AVC1)
            format_selector = get_format_selector(quality)
            
            ydl_opts = {
                'format': format_selector,
                'merge_output_format': 'mp4',  # Garante que o merge seja MP4
                'outtmpl': '%(title)s.%(ext)s',
                'quiet': True,
                'no_warnings': True,
                'noplaylist': True,
                'extract_flat': False,
            }
            
            # Adicionar hook de progresso se callback fornecido
            if progress_callback:
                def progress_hook(d):
                    if d['status'] == 'downloading':
                        total = d.get('total_bytes') or d.get('total_bytes_estimate', 0)
                        downloaded = d.get('downloaded_bytes', 0)
                        if total > 0:
                            percent = (downloaded / total) * 100
                            speed = d.get('speed', 0)
                            progress_callback({
                                'status': 'downloading',
                                'percent': round(percent, 2),
                                'downloaded_bytes': downloaded,
                                'total_bytes': total,
                                'downloaded_mb': round(downloaded / (1024 * 1024), 2),
                                'total_mb': round(total / (1024 * 1024), 2),
                                'speed': speed,
                                'speed_mbps': round(speed / (1024 * 1024), 2) if speed else 0,
                            })
                    elif d['status'] == 'finished':
                        progress_callback({
                            'status': 'processing',
                            'percent': 100,
                            'message': 'Processando... (juntando áudio e vídeo)'
                        })
                
                ydl_opts['progress_hooks'] = [progress_hook]

            buffer = BytesIO()
            
            # Usar yt-dlp para baixar diretamente para o buffer
            with tempfile.TemporaryDirectory() as tmpdir:
                ydl_opts['outtmpl'] = os.path.join(tmpdir, '%(title)s.%(ext)s')
                ydl_opts['quiet'] = False # Habilitar logs para debug
                
                with yt_dlp.YoutubeDL(ydl_opts) as ydl:
                    # Obter informações do vídeo primeiro
                    info = ydl.extract_info(video_url, download=False)
                    title = info.get('title', 'video')
                    filename = f"{slugify(title)}.mp4"
                    
                    # Baixar o vídeo
                    app.logger.info("Iniciando ydl.download para %s", video_url)
                    ydl.download([video_url])
                    app.logger.info("ydl.download retornou. Verificando arquivos em %s", tmpdir)
                    
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
    
    Parâmetros:
    - videoId: ID do vídeo (obrigatório)
    - quality: format_id ou 'best' para melhor qualidade (opcional)
    - progress: 'true' para usar Server-Sent Events com progresso (opcional)
    
    PRIORIDADE DE DOWNLOAD:
    1. yt-dlp (PRIMEIRA TENTATIVA - mais confiável e atualizado)
    2. pytube (FALLBACK - caso yt-dlp falhe)
    
    Retorna o binário do vídeo MP4 diretamente ou SSE stream com progresso.
    """
    video_id = request.args.get("videoId")
    quality = request.args.get("quality", "best")
    use_progress = request.args.get("progress", "false").lower() == "true"
    
    if not video_id:
        return jsonify({"error": "ID do video nao fornecido"}), 400

    # Se progresso está habilitado, usar Server-Sent Events (SSE)
    if use_progress:
        return download_with_progress(video_id, quality)

    # Verificar se já existe um download concluído em cache (do fluxo de progresso)
    cached_download = download_progress.get(video_id)
    if cached_download and cached_download.get('buffer_ready') and cached_download.get('buffer'):
        app.logger.info("Usando download em cache para vídeo: %s", video_id)
        buffer = cached_download['buffer']
        buffer.seek(0)
        filename = cached_download['filename']
        
        # Limpar cache após uso (opcional, mas bom para memória)
        # del download_progress[video_id] 
        
        return send_file(
            buffer,
            as_attachment=True,
            download_name=filename,
            mimetype="video/mp4"
        )

    # Download normal sem progresso
    # TENTATIVA 1: yt-dlp (PRIMEIRA PRIORIDADE)
    if YT_DLP_AVAILABLE:
        app.logger.info("Tentando download com yt-dlp (método prioritário) para vídeo: %s (qualidade: %s)", video_id, quality)
        success, buffer, filename, error_msg = download_with_ytdlp(video_id, quality)
        
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


# Armazenamento temporário de progresso (em produção, usar Redis ou similar)
download_progress = {}

@app.get("/api/download/progress")
def get_download_progress():
    """
    Endpoint para obter progresso do download via polling.
    """
    video_id = request.args.get("videoId")
    if not video_id:
        return jsonify({"error": "ID do video nao fornecido"}), 400
    
    progress = download_progress.get(video_id, {'status': 'not_started'})
    return jsonify(progress)


def download_with_progress(video_id: str, quality: str):
    """
    Download com progresso usando Server-Sent Events (SSE).
    Envia apenas progresso via SSE. O arquivo será baixado via endpoint normal após conclusão.
    """
    def generate():
        progress_data = {'status': 'starting', 'percent': 0, 'downloaded_mb': 0, 'total_mb': 0, 'speed_mbps': 0}
        download_progress[video_id] = progress_data
        
        def progress_callback(data):
            progress_data.update(data)
            download_progress[video_id] = progress_data.copy()
            # Enviar progresso via SSE
            return f"data: {json.dumps(progress_data)}\n\n"
        
        try:
            # Iniciar download
            yield f"data: {json.dumps({'status': 'starting', 'percent': 0})}\n\n"
            
            # Fazer download em thread separada e enviar progresso
            import queue
            progress_queue = queue.Queue()
            
            def download_thread():
                try:
                    def callback(data):
                        progress_queue.put(data)
                    
                    success, buffer, filename, error_msg = download_with_ytdlp(video_id, quality, callback)
                    
                    if success:
                        # Salvar buffer temporariamente (em produção, usar Redis ou storage)
                        download_progress[video_id] = {
                            'status': 'completed',
                            'percent': 100,
                            'filename': filename,
                            'buffer_ready': True,
                            'buffer': buffer  # Salvar buffer para download imediato
                        }
                        progress_queue.put({'status': 'completed', 'percent': 100, 'filename': filename})
                    else:
                        progress_queue.put({'status': 'error', 'error': error_msg})
                except Exception as exc:
                    progress_queue.put({'status': 'error', 'error': str(exc)})
            
            thread = threading.Thread(target=download_thread)
            thread.start()
            
            # Enviar progresso enquanto download está em andamento
            import time
            while thread.is_alive():
                try:
                    data = progress_queue.get(timeout=0.5)
                    yield f"data: {json.dumps(data)}\n\n"
                except queue.Empty:
                    # Enviar progresso atual
                    current = download_progress.get(video_id, {})
                    if current.get('status') != 'completed':
                        yield f"data: {json.dumps(current)}\n\n"
                    time.sleep(0.5)
            
            # Aguardar thread terminar
            thread.join()
            
            # Enviar resultado final
            final_data = download_progress.get(video_id, {})
            yield f"data: {json.dumps(final_data)}\n\n"
            
        except Exception as exc:
            yield f"data: {json.dumps({'status': 'error', 'error': str(exc)})}\n\n"
        finally:
            # Manter progresso por 5 minutos para download do arquivo
            pass
    
    return Response(stream_with_context(generate()), mimetype='text/event-stream')


if __name__ == "__main__":
    port = int(os.getenv("PORT", "5000"))
    app.run(host="0.0.0.0", port=port)
