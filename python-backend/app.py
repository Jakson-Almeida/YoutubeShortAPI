import os
import re
import tempfile
from io import BytesIO
import zipfile
from datetime import datetime, timedelta
import time
import random

from urllib.error import HTTPError

from flask import Flask, jsonify, request, send_file, Response, stream_with_context
from flask_cors import CORS
from flask_jwt_extended import JWTManager, create_access_token, jwt_required, get_jwt_identity
import json
import threading

from models import db, User, bcrypt

app = Flask(__name__)

# Configuração do banco de dados
basedir = os.path.abspath(os.path.dirname(__file__))
app.config['SQLALCHEMY_DATABASE_URI'] = os.environ.get('DATABASE_URL') or \
    'sqlite:///' + os.path.join(basedir, 'youtube_shorts.db')
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False

# Configuração JWT
app.config['JWT_SECRET_KEY'] = os.environ.get('JWT_SECRET_KEY') or 'your-secret-key-change-in-production'
app.config['JWT_ACCESS_TOKEN_EXPIRES'] = timedelta(days=365)  # Token expira em 1 ano

# Inicializar extensões
db.init_app(app)
bcrypt.init_app(app)
jwt = JWTManager(app)
CORS(app, supports_credentials=True)

# Criar tabelas ao iniciar
with app.app_context():
    db.create_all()

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


def extract_product_links(description: str, link_filter: str = None) -> list:
    """
    Extrai links de produtos da descrição do vídeo.
    
    Args:
        description: Descrição completa do vídeo
        link_filter: Termo que a URL deve conter para ser incluída (opcional)
    
    Returns:
        Lista de URLs encontradas
    """
    if not description:
        return []
    
    # Padrões comuns de URLs de produtos/afiliados
    patterns = [
        r'https?://(?:www\.)?(?:shopee|amazon|aliexpress|magazineluiza|mercadolivre|americanas|submarino|shoptime)\.(?:com\.br|com)/[^\s\)]+',
        r'https?://(?:amzn\.to|bit\.ly|t\.co|short\.link|tinyurl)/[^\s\)]+',
        r'https?://[^\s\)]+(?:shopee|amazon|aliexpress|magazineluiza|mercadolivre)[^\s\)]*',
    ]
    
    links = set()
    
    for pattern in patterns:
        matches = re.findall(pattern, description, re.IGNORECASE)
        for match in matches:
            # Limpar URL (remover caracteres finais indesejados)
            url = match.rstrip('.,;:!?)]}')
            
            # Aplicar filtro se fornecido
            if link_filter and link_filter.strip():
                if link_filter.lower() not in url.lower():
                    continue
            
            links.add(url)
    
    return sorted(list(links))


def create_video_package(video_buffer: BytesIO, video_filename: str, metadata: dict, 
                         save_video: bool = True, save_description: bool = False, 
                         save_links: bool = False) -> BytesIO:
    """
    Cria um pacote ZIP com vídeo e metadados, ou retorna apenas o buffer do vídeo.
    
    Args:
        video_buffer: Buffer do vídeo baixado
        video_filename: Nome do arquivo de vídeo
        metadata: Dicionário com metadados (description, links, title, etc.)
        save_video: Se deve incluir o vídeo
        save_description: Se deve incluir descrição
        save_links: Se deve incluir links
    
    Returns:
        BytesIO com ZIP ou vídeo direto
    """
    # Se não há metadados para salvar, retornar vídeo direto
    if not save_description and not save_links:
        return video_buffer
    
    # Criar ZIP com metadados
    zip_buffer = BytesIO()
    
    with zipfile.ZipFile(zip_buffer, 'w', zipfile.ZIP_DEFLATED) as zip_file:
        # Adicionar vídeo se solicitado
        if save_video:
            video_buffer.seek(0)
            zip_file.writestr(video_filename, video_buffer.read())
        
        # Preparar JSON com metadados
        metadata_json = {}
        
        if save_description and metadata.get('description'):
            metadata_json['description'] = metadata['description']
        
        if save_links and metadata.get('links'):
            metadata_json['links'] = metadata['links']
        
        # Adicionar outros metadados úteis
        if metadata.get('title'):
            metadata_json['title'] = metadata['title']
        if metadata.get('channel'):
            metadata_json['channel'] = metadata['channel']
        if metadata.get('published_at'):
            metadata_json['published_at'] = metadata['published_at']
        
        # Salvar JSON
        if metadata_json:
            json_content = json.dumps(metadata_json, ensure_ascii=False, indent=2)
            zip_file.writestr('metadata.json', json_content.encode('utf-8'))
    
    zip_buffer.seek(0)
    return zip_buffer


@app.get("/api/health")
def health_check():
    methods = []
    if YT_DLP_AVAILABLE:
        methods.append("yt-dlp")
    if PYTUBE_AVAILABLE:
        methods.append("pytube")
    
    message = f"Python backend ativo. Métodos disponíveis: {', '.join(methods) if methods else 'nenhum'}"
    return jsonify({"status": "OK", "message": message, "methods": methods})


# ==================== ENDPOINTS DE AUTENTICAÇÃO ====================

@app.post("/api/auth/register")
def register():
    """Registrar novo usuário"""
    try:
        data = request.get_json()
        email = data.get('email', '').strip().lower()
        password = data.get('password', '').strip()
        
        # Validações
        if not email or not password:
            return jsonify({"error": "Email e senha são obrigatórios"}), 400
        
        if len(password) < 6:
            return jsonify({"error": "Senha deve ter pelo menos 6 caracteres"}), 400
        
        # Verificar se email já existe
        existing_user = User.query.filter_by(email=email).first()
        if existing_user:
            return jsonify({"error": "Email já cadastrado"}), 400
        
        # Criar novo usuário
        user = User(email=email, password=password)
        db.session.add(user)
        db.session.commit()
        
        # Criar token JWT
        access_token = create_access_token(identity=str(user.id))
        
        return jsonify({
            "message": "Usuário criado com sucesso",
            "user": user.to_dict(),
            "access_token": access_token
        }), 201
        
    except Exception as e:
        db.session.rollback()
        app.logger.error(f"Erro ao registrar usuário: {str(e)}")
        return jsonify({"error": "Não foi possível criar sua conta. Tente novamente."}), 500


@app.post("/api/auth/login")
def login():
    """Login de usuário"""
    try:
        data = request.get_json()
        email = data.get('email', '').strip().lower()
        password = data.get('password', '').strip()
        
        if not email or not password:
            return jsonify({"error": "Email e senha são obrigatórios"}), 400
        
        # Buscar usuário
        user = User.query.filter_by(email=email).first()
        
        if not user or not user.check_password(password):
            return jsonify({"error": "Email ou senha incorretos"}), 401
        
        # Criar token JWT
        access_token = create_access_token(identity=str(user.id))
        
        return jsonify({
            "message": "Login realizado com sucesso",
            "user": user.to_dict(),
            "access_token": access_token
        }), 200
        
    except Exception as e:
        app.logger.error(f"Erro ao fazer login: {str(e)}")
        return jsonify({"error": "Não foi possível fazer login. Tente novamente."}), 500


@app.get("/api/auth/verify")
@jwt_required()
def verify():
    """Verificar se token é válido e retornar dados do usuário"""
    try:
        user_id = get_jwt_identity()
        try:
            user_id_int = int(user_id)
        except (TypeError, ValueError):
            app.logger.error("Identidade do token inválida: %s", user_id)
            return jsonify({"error": "Sessão inválida. Faça login novamente."}), 401
        user = User.query.get(user_id_int)
        
        if not user:
            return jsonify({"error": "Usuário não encontrado"}), 404
        
        return jsonify({
            "valid": True,
            "user": user.to_dict()
        }), 200
        
    except Exception as e:
        app.logger.error(f"Erro ao verificar token: {str(e)}")
        return jsonify({"error": "Sessão inválida. Faça login novamente."}), 401


@app.post("/api/auth/logout")
@jwt_required()
def logout():
    """Logout (no JWT, logout é feito no cliente removendo o token)"""
    return jsonify({"message": "Logout realizado com sucesso"}), 200


@app.get("/api/formats")
def get_video_formats():
    """
    Retorna as qualidades disponíveis para um vídeo.
    """
    video_id = request.args.get("videoId")
    if not video_id:
        return jsonify({"error": "ID do video nao fornecido"}), 400

    if not YT_DLP_AVAILABLE:
        return jsonify({"error": "Serviço temporariamente indisponível"}), 503

    candidate_urls = [
        f"https://www.youtube.com/watch?v={video_id}",
        f"https://www.youtube.com/shorts/{video_id}",
        f"https://youtu.be/{video_id}",
    ]

    for video_url in candidate_urls:
        try:
            # Obter cookies de variável de ambiente se disponível
            cookies_file = os.environ.get('YOUTUBE_COOKIES_FILE')
            
            # Usar configurações otimizadas para evitar detecção de bot
            ydl_opts = get_ydl_opts_base(cookies_file=cookies_file, quiet=True, listformats=True)

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
            error_msg = str(exc)
            app.logger.warning("Erro ao obter formatos (%s): %s", video_url, error_msg)
            
            # Verificar se é erro de bloqueio do YouTube
            if is_bot_detection_error(error_msg):
                app.logger.error("YouTube bloqueou a requisição (detecção de bot)")
                # Mensagem genérica - não expor detalhes técnicos
                return jsonify({
                    "error": "Serviço temporariamente indisponível. Tente novamente mais tarde.",
                    "code": "YOUTUBE_BLOCKED"
                }), 503
            
            continue
    
    # Mensagem genérica - não expor detalhes técnicos
    return jsonify({
        "error": "Não foi possível processar a solicitação. Tente novamente mais tarde.",
        "code": "FORMATS_UNAVAILABLE"
    }), 503


def get_ydl_opts_base(format_selector=None, cookies_file=None, quiet=False, listformats=False, player_client=None, strategy='default'):
    """
    Retorna configurações base otimizadas do yt-dlp para evitar detecção de bot.
    Inclui headers realistas e opções específicas do extractor do YouTube.
    
    Args:
        format_selector: String de formato ou None (para listagem de formatos)
        cookies_file: Caminho para arquivo de cookies (opcional)
        quiet: Se True, reduz output
        listformats: Se True, apenas lista formatos sem baixar
        player_client: Lista de player_clients para tentar (None = usa padrão)
        strategy: Estratégia a usar ('default', 'ios', 'android', 'web', 'tv')
    """
    # User-Agent mais recente e realista (Chrome 131 - Janeiro 2025)
    user_agent = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36'
    
    # Player clients baseado na estratégia
    if player_client is None:
        if strategy == 'ios':
            player_client = ['ios']
        elif strategy == 'android':
            player_client = ['android']
        elif strategy == 'web':
            player_client = ['web']
        elif strategy == 'tv':
            player_client = ['tv_embedded', 'web']
        else:  # default
            player_client = ['android', 'web']
    elif not isinstance(player_client, list):
        player_client = [player_client]
    
    # Referer baseado na URL do vídeo
    referer = 'https://www.youtube.com/'
    
    opts = {
        'quiet': quiet,
        'no_warnings': quiet,
        'noplaylist': True,
        'extract_flat': False,
        'verbose': not quiet,
        
        # Headers muito mais realistas para evitar detecção
        'http_headers': {
            'User-Agent': user_agent,
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
            'Accept-Language': 'en-US,en;q=0.9,pt-BR;q=0.8,pt;q=0.7',
            'Accept-Encoding': 'gzip, deflate, br, zstd',
            'DNT': '1',
            'Connection': 'keep-alive',
            'Upgrade-Insecure-Requests': '1',
            'Sec-Fetch-Dest': 'document',
            'Sec-Fetch-Mode': 'navigate',
            'Sec-Fetch-Site': 'none',
            'Sec-Fetch-User': '?1',
            'sec-ch-ua': '"Google Chrome";v="131", "Chromium";v="131", "Not_A Brand";v="24"',
            'sec-ch-ua-mobile': '?0',
            'sec-ch-ua-platform': '"Windows"',
            'Referer': referer,
            'Origin': 'https://www.youtube.com',
        },
        
        # Opções específicas do extractor do YouTube para evitar detecção
        'extractor_args': {
            'youtube': {
                'player_client': player_client,  # Tentar clientes diferentes
                'player_skip': ['webpage'] if strategy != 'web' else [],  # Pular página web quando possível
            }
        },
        
        # Usar cookies se disponíveis
        'cookiefile': cookies_file if cookies_file and os.path.exists(cookies_file) else None,
        
        # Outras opções para melhorar compatibilidade
        'no_check_certificate': False,
        'prefer_insecure': False,
        'geo_bypass': True,
        'geo_bypass_country': None,
        
        # Tentar múltiplos clientes do YouTube
        'youtube_include_dash_manifest': False,
        
        # Opções adicionais para evitar detecção
        'sleep_requests': 1,  # Delay entre requisições
        'sleep_interval': 0,  # Delay entre vídeos
        'max_sleep_interval': 0,
        'sleep_subtitles': 0,
    }
    
    # Adicionar format apenas se não for listagem e se fornecido
    if not listformats:
        if format_selector:
            opts['format'] = format_selector
            opts['merge_output_format'] = 'mp4'
            opts['outtmpl'] = '%(title)s.%(ext)s'
        else:
            opts['format'] = 'best'
            opts['merge_output_format'] = 'mp4'
            opts['outtmpl'] = '%(title)s.%(ext)s'
    else:
        opts['listformats'] = True
    
    return opts


def is_bot_detection_error(error_msg):
    """
    Verifica se o erro é relacionado à detecção de bot do YouTube.
    
    Args:
        error_msg: Mensagem de erro a verificar
        
    Returns:
        True se for erro de detecção de bot, False caso contrário
    """
    if not error_msg:
        return False
    
    error_lower = str(error_msg).lower()
    bot_indicators = [
        "sign in to confirm",
        "bot",
        "blocked",
        "temporarily unavailable",
        "403 forbidden",
        "503 service unavailable",
        "429 too many requests",
        "unable to extract",
        "please sign in",
        "verify you're not a robot",
        "this action is not allowed",
    ]
    
    return any(indicator in error_lower for indicator in bot_indicators)


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
        # Qualidade específica (format_id) precisa ser combinada com o melhor áudio disponível
        # para evitar downloads apenas de vídeo (DASH) sem áudio.
        # A ordem abaixo tenta:
        # 1. vídeo selecionado + melhor áudio mp4a
        # 2. vídeo selecionado + melhor áudio disponível
        # 3. fallback para o formato selecionado isolado (caso já seja progressivo)
        return (
            f"{quality}+bestaudio[acodec^=mp4a][ext=m4a]/"
            f"{quality}+bestaudio/"
            f"{quality}"
        )


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
    
    # Estratégias para tentar (em ordem de preferência)
    strategies = [
        ('default', ['android', 'web']),
        ('ios', ['ios']),
        ('android', ['android']),
        ('web', ['web']),
        ('tv', ['tv_embedded', 'web']),
    ]
    
    # Adicionar delay inicial aleatório para parecer mais humano (0-3 segundos)
    initial_delay = random.uniform(0, 3)
    if initial_delay > 0:
        app.logger.debug("Delay inicial aleatório: %.2f segundos (anti-detecção)", initial_delay)
        time.sleep(initial_delay)

    for strategy_name, player_clients in strategies:
        app.logger.info("Tentando estratégia: %s com player_clients: %s", strategy_name, player_clients)
        
        for video_url in candidate_urls:
            try:
                app.logger.info("Tentando download com yt-dlp: %s (qualidade: %s, estratégia: %s)", 
                              video_url, quality or 'best', strategy_name)
                
                # Configuração do yt-dlp para baixar em formato compatível (H.264/AVC1)
                format_selector = get_format_selector(quality)
                
                total_expected_bytes = 0
                total_components = 1
                downloaded_total_bytes = 0
                current_filename = None
                last_file_bytes = 0
                remaining_components = 1

                # Obter cookies de variável de ambiente se disponível
                cookies_file = os.environ.get('YOUTUBE_COOKIES_FILE')
                
                # Usar configurações otimizadas para evitar detecção de bot com estratégia específica
                ydl_opts = get_ydl_opts_base(
                    format_selector=format_selector, 
                    cookies_file=cookies_file, 
                    quiet=False,
                    player_client=player_clients,
                    strategy=strategy_name
                )
                ydl_opts['outtmpl'] = '%(title)s.%(ext)s'  # Manter outtmpl específico para este contexto
                
                # Adicionar hook de progresso se callback fornecido
                if progress_callback:
                    merge_started = False
                
                def progress_hook(d):
                    nonlocal merge_started, total_expected_bytes, downloaded_total_bytes, current_filename, last_file_bytes, remaining_components
                    try:
                        status = d.get('status', '')
                        if status == 'downloading':
                            filename = d.get('filename') or (d.get('info_dict') or {}).get('id')
                            if filename != current_filename:
                                current_filename = filename
                                last_file_bytes = 0
                            
                            downloaded = d.get('downloaded_bytes') or 0
                            delta = max(0, downloaded - last_file_bytes)
                            downloaded_total_bytes += delta
                            last_file_bytes = downloaded
                            
                            combined_total = total_expected_bytes or 0
                            if not combined_total:
                                combined_total = d.get('total_bytes') or d.get('total_bytes_estimate') or 0
                            
                            percent = None
                            if combined_total:
                                percent = min(99.9, (downloaded_total_bytes / combined_total) * 100)
                            
                            speed = d.get('speed', 0)
                            progress_callback({
                                'status': 'downloading',
                                'percent': round(percent, 2) if percent is not None else None,
                                'downloaded_bytes': downloaded_total_bytes,
                                'total_bytes': combined_total if combined_total else None,
                                'downloaded_mb': round(downloaded_total_bytes / (1024 * 1024), 2),
                                'total_mb': round(combined_total / (1024 * 1024), 2) if combined_total else None,
                                'speed': speed,
                                'speed_mbps': round(speed / (1024 * 1024), 2) if speed else 0,
                            })
                        elif status == 'finished':
                            app.logger.info("Progress hook: status='finished' - segmentos baixados")
                            file_total = d.get('total_bytes') or d.get('total_bytes_estimate') or last_file_bytes
                            if file_total and last_file_bytes < file_total:
                                downloaded_total_bytes += (file_total - last_file_bytes)
                            last_file_bytes = 0
                            remaining_components = max(0, remaining_components - 1)
                            
                            if remaining_components <= 0:
                                merge_started = True
                                combined_total = total_expected_bytes or downloaded_total_bytes
                                progress_callback({
                                    'status': 'processing',
                                    'percent': 100,
                                    'downloaded_bytes': downloaded_total_bytes,
                                    'total_bytes': combined_total,
                                    'downloaded_mb': round(downloaded_total_bytes / (1024 * 1024), 2),
                                    'total_mb': round(combined_total / (1024 * 1024), 2) if combined_total else None,
                                    'message': 'Processando... Juntando áudio e vídeo (isso pode demorar)'
                                })
                        elif status == 'postprocessor':
                            app.logger.info("Progress hook: status='postprocessor' - merge iniciado")
                            merge_started = True
                            progress_callback({
                                'status': 'processing',
                                'percent': 100,
                                'downloaded_bytes': downloaded_total_bytes,
                                'total_bytes': total_expected_bytes or downloaded_total_bytes,
                                'downloaded_mb': round(downloaded_total_bytes / (1024 * 1024), 2),
                                'total_mb': round((total_expected_bytes or downloaded_total_bytes) / (1024 * 1024), 2),
                                'message': 'Processando... Juntando áudio e vídeo (isso pode demorar)'
                            })
                    except Exception as e:
                        app.logger.error("Erro no progress_hook: %s", str(e))
                        # Não propagar erro para não quebrar o download
                
                ydl_opts['progress_hooks'] = [progress_hook]

                buffer = BytesIO()
                
                # Usar yt-dlp para baixar diretamente para o buffer
                with tempfile.TemporaryDirectory() as tmpdir:
                    ydl_opts['outtmpl'] = os.path.join(tmpdir, '%(title)s.%(ext)s')
                    # Manter quiet=True para não interferir no comportamento padrão
                    
                    with yt_dlp.YoutubeDL(ydl_opts) as ydl:
                        # Obter informações do vídeo primeiro
                        info = ydl.extract_info(video_url, download=False)

                        requested_formats = info.get('requested_formats')
                        if isinstance(requested_formats, list) and requested_formats:
                            total_components = len([f for f in requested_formats if f])
                            remaining_components = total_components
                            total_expected_bytes = 0
                            for fmt in requested_formats:
                                if not fmt:
                                    continue
                                size = fmt.get('filesize') or fmt.get('filesize_approx')
                                if size:
                                    total_expected_bytes += size
                        else:
                            size = info.get('filesize') or info.get('filesize_approx')
                            if size:
                                total_expected_bytes = size
                            total_components = 1
                            remaining_components = 1

                        title = info.get('title', 'video')
                        filename = f"{slugify(title)}.mp4"
                        
                        # Baixar o vídeo em thread para poder monitorar o progresso
                        
                        download_complete = threading.Event()
                        download_error = [None]
                        final_mp4_files = []
                        
                        def download_thread_func():
                            try:
                                app.logger.info("Thread: Iniciando ydl.download para %s", video_url)
                                ydl.download([video_url])
                                app.logger.info("Thread: ydl.download retornou")
                                download_complete.set()
                            except Exception as e:
                                app.logger.error("Thread: Erro durante ydl.download: %s", str(e))
                                import traceback
                                app.logger.error(traceback.format_exc())
                                download_error[0] = e
                                download_complete.set()
                        
                        download_thread = threading.Thread(target=download_thread_func, daemon=True)
                        download_thread.start()
                        app.logger.debug("Monitorando diretório temporário: %s", tmpdir)
                        
                        # Monitorar diretório enquanto download está rodando
                        max_wait = 600  # 10 minutos máximo
                        wait_start = time.time()
                        last_log_time = 0
                        
                        while not download_complete.is_set() and (time.time() - wait_start) < max_wait:
                            time.sleep(2)  # Verificar a cada 2 segundos
                            
                            try:
                                all_files = os.listdir(tmpdir)
                                # Procurar arquivo final (.mp4 que não seja temporário)
                                # Excluir todos os arquivos temporários do yt-dlp (.f*.mp4, .f*.m4a)
                                candidate_files = [
                                    f for f in all_files 
                                    if f.endswith('.mp4') 
                                    and os.path.isfile(os.path.join(tmpdir, f))
                                    and not re.search(r'\.f\d+\.(mp4|m4a)$', f)  # Excluir .f136.mp4, .f137.mp4, etc.
                                ]
                                
                                # Priorizar arquivo final (não .temp.mp4)
                                final_files = [f for f in candidate_files if not f.endswith('.temp.mp4')]
                                
                                # Se não encontrou arquivo final, verificar .temp.mp4
                                if not final_files:
                                    temp_files = [f for f in candidate_files if f.endswith('.temp.mp4')]
                                    if temp_files:
                                        temp_file = os.path.join(tmpdir, temp_files[0])
                                        # Verificar se o arquivo temp está estável (FFmpeg terminou)
                                        temp_size1 = os.path.getsize(temp_file)
                                        time.sleep(2)
                                        temp_size2 = os.path.getsize(temp_file)
                                        if temp_size1 == temp_size2 and temp_size1 > 0:
                                            app.logger.info("Arquivo .temp.mp4 estável encontrado: %s (%d bytes)", temp_files[0], temp_size1)
                                            # Usar o temp como final
                                            final_mp4_files = [temp_files[0]]
                                            break
                                
                                # Se encontrar arquivo final, usar ele
                                if final_files and not final_mp4_files:
                                    try:
                                        file_path = os.path.join(tmpdir, final_files[0])
                                        if not os.path.exists(file_path):
                                            continue  # Arquivo foi deletado, continuar monitorando
                                        
                                        final_mp4_files = final_files
                                        app.logger.info("Arquivo final detectado durante download: %s", final_mp4_files[0])
                                        
                                        # Aguardar um pouco mais para garantir que está completo
                                        time.sleep(3)
                                        
                                        # Verificar se arquivo ainda existe e está estável
                                        if not os.path.exists(file_path):
                                            app.logger.debug("Arquivo removido durante verificação; aguardando FFmpeg")
                                            final_mp4_files = []  # Reset para continuar procurando
                                            continue
                                        
                                        file_size = os.path.getsize(file_path)
                                        time.sleep(2)
                                        
                                        # Verificar novamente se arquivo ainda existe e está estável
                                        if not os.path.exists(file_path):
                                            app.logger.debug("Arquivo removido durante verificação de tamanho; aguardando FFmpeg")
                                            final_mp4_files = []  # Reset para continuar procurando
                                            continue
                                        
                                        if os.path.getsize(file_path) == file_size:  # Arquivo não mudou
                                            app.logger.info("Arquivo final estável (tamanho: %d bytes). Finalizando download.", file_size)
                                            break
                                    except (OSError, FileNotFoundError) as e:
                                        app.logger.debug("Arquivo não acessível durante verificação: %s", str(e))
                                        final_mp4_files = []  # Reset para continuar procurando
                                        continue
                                
                                # Log periódico
                                elapsed = int(time.time() - wait_start)
                                if elapsed - last_log_time >= 10:
                                    app.logger.debug("Monitorando download (%ds, %d arquivos temporários)", 
                                                     elapsed, len(all_files))
                                    last_log_time = elapsed
                            except Exception as e:
                                app.logger.error("Erro ao monitorar diretório: %s", str(e))
                    
                        # Aguardar thread terminar ou timeout
                        if not download_complete.wait(timeout=30):
                            app.logger.warning("Thread de download não completou em 30 segundos após arquivo detectado")
                        
                        if download_error[0]:
                            raise download_error[0]
                        
                        app.logger.info("Download e monitoramento concluídos")
                        
                        # Encontrar o arquivo baixado
                        app.logger.info("Listando arquivos finais em %s", tmpdir)
                        all_files = os.listdir(tmpdir)
                        app.logger.info("Todos os arquivos encontrados: %s", all_files)
                        
                        # Se já encontramos arquivo final durante o monitoramento, usar ele
                        if final_mp4_files:
                            downloaded_file = os.path.join(tmpdir, final_mp4_files[0])
                            if not os.path.exists(downloaded_file):
                                app.logger.warning("Arquivo encontrado anteriormente não existe mais: %s", downloaded_file)
                                final_mp4_files = []  # Resetar para procurar novamente
                            else:
                                app.logger.info("Usando arquivo final encontrado durante monitoramento: %s", downloaded_file)
                        
                        # Se arquivo não existe ou não foi encontrado, procurar novamente
                        if not final_mp4_files:
                            # Tentar encontrar agora - primeiro arquivo final, depois .temp.mp4
                            # Excluir todos os arquivos temporários do yt-dlp (.f*.mp4, .f*.m4a)
                            final_mp4_files = [
                                f for f in all_files 
                                if f.endswith('.mp4') 
                                and os.path.isfile(os.path.join(tmpdir, f))
                                and not re.search(r'\.f\d+\.(mp4|m4a)$', f)  # Excluir .f136.mp4, .f137.mp4, etc.
                                and not f.endswith('.temp.mp4')  # Excluir .temp.mp4 temporariamente
                            ]
                            
                            # Se não encontrou arquivo final, tentar .temp.mp4
                            if not final_mp4_files:
                                temp_files = [
                                    f for f in all_files 
                                    if f.endswith('.temp.mp4') 
                                    and os.path.isfile(os.path.join(tmpdir, f))
                                ]
                                if temp_files:
                                    temp_file_path = os.path.join(tmpdir, temp_files[0])
                                    temp_size = os.path.getsize(temp_file_path)
                                    app.logger.info("Usando arquivo .temp.mp4 como final: %s (%d bytes)", temp_files[0], temp_size)
                                    final_mp4_files = temp_files
                            
                            if final_mp4_files:
                                downloaded_file = os.path.join(tmpdir, final_mp4_files[0])
                                app.logger.info("Arquivo final encontrado após download: %s", downloaded_file)
                            else:
                                # Fallback: procurar todos os arquivos de vídeo/áudio (excluindo temporários)
                                downloaded_files = [f for f in all_files 
                                                   if os.path.isfile(os.path.join(tmpdir, f)) 
                                                   and f.endswith(('.mp4', '.webm', '.mkv', '.m4a'))
                                                   and not re.search(r'\.f\d+\.(mp4|m4a)$', f)  # Excluir .f*.mp4, .f*.m4a
                                                   and not f.endswith('.temp.mp4')]  # Excluir .temp.mp4 também no fallback
                                app.logger.info("Arquivos de vídeo/áudio filtrados: %s", downloaded_files)
                                
                                if not downloaded_files:
                                    app.logger.warning("Nenhum arquivo baixado encontrado em %s. Arquivos totais: %s", tmpdir, all_files)
                                    continue
                                
                                # Priorizar arquivos MP4
                                mp4_files = [f for f in downloaded_files if f.endswith('.mp4')]
                                downloaded_file = os.path.join(tmpdir, mp4_files[0] if mp4_files else downloaded_files[0])
                                app.logger.info("Arquivo selecionado para leitura: %s", downloaded_file)
                        
                        # Ler o arquivo para o buffer
                        file_size = os.path.getsize(downloaded_file)
                        app.logger.info("Tamanho do arquivo: %d bytes", file_size)
                        
                        with open(downloaded_file, 'rb') as f:
                            buffer.write(f.read())
                        
                        buffer.seek(0)
                        buffer_size = buffer.getbuffer().nbytes
                        app.logger.info("Download concluído com yt-dlp: %s (buffer: %d bytes, arquivo: %d bytes)", 
                                      filename, buffer_size, file_size)
                        
                        if buffer_size == 0:
                            app.logger.error("Buffer vazio após leitura do arquivo!")
                            continue
                            
                        app.logger.info("Download bem-sucedido usando estratégia: %s", strategy_name)
                        return True, buffer, filename, None

            except Exception as exc:  # pylint: disable=broad-except
                error_msg = str(exc)
                app.logger.warning("Erro ao baixar com yt-dlp (%s, estratégia: %s): %s", 
                                 video_url, strategy_name, error_msg)
                import traceback
                app.logger.debug(traceback.format_exc())
                
                # Verificar se é erro de bloqueio do YouTube (bot detection)
                if is_bot_detection_error(error_msg):
                    app.logger.error("YouTube bloqueou a requisição (detecção de bot) para vídeo: %s (estratégia: %s)", 
                                   video_id, strategy_name)
                    # Adicionar delay aleatório antes de tentar próxima tentativa (2-5 segundos)
                    delay = random.uniform(2, 5)
                    app.logger.info("Aguardando %.1f segundos antes da próxima tentativa (anti-detecção)...", delay)
                    time.sleep(delay)
                    # Continuar para próxima estratégia/URL
                    continue
                
                # Para outros erros, também continuar tentando
                continue
    
    # Se chegou aqui, todas as estratégias falharam
    app.logger.error("Todas as estratégias falharam para o vídeo: %s", video_id)
    return False, None, None, "Não foi possível processar o download. YouTube pode estar bloqueando temporariamente."


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
            return False, None, None, "Não foi possível processar o vídeo"
    except PytubeError as exc:
        app.logger.exception("Erro do pytube ao processar streams do video %s", video_id)
        return False, None, None, "Não foi possível processar o vídeo"

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
    # Verificar autenticação
    try:
        # Tentar obter token do header Authorization
        auth_header = request.headers.get('Authorization')
        if auth_header and auth_header.startswith('Bearer '):
            token = auth_header.split(' ')[1]
        else:
            # Tentar obter da query string (para SSE)
            token = request.args.get('token')
        
        if not token:
            return jsonify({"error": "Faça login para continuar."}), 401
        
        # Verificar token
        from flask_jwt_extended import decode_token
        decoded = decode_token(token)
        user_id = decoded.get('sub')
        if not user_id:
            return jsonify({"error": "Sessão inválida. Faça login novamente."}), 401
    except Exception as e:
        app.logger.error(f"Erro ao verificar autenticação: {str(e)}")
        return jsonify({"error": "Sessão inválida. Faça login novamente."}), 401
    
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
    yt_dlp_error = None
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
            yt_dlp_error = error_msg
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
            
            # Verificar se foi erro de bot detection do YouTube
            is_bot_detection = False
            if yt_dlp_error and ("bloqueou" in yt_dlp_error.lower() or "bot" in yt_dlp_error.lower()):
                is_bot_detection = True
            elif error_msg and ("bloqueou" in str(error_msg).lower() or "bot" in str(error_msg).lower()):
                is_bot_detection = True
            
            if is_bot_detection:
                # Mensagem específica para bloqueio do YouTube
                app.logger.error("YouTube bloqueou as requisições (detecção de bot)")
                return jsonify({
                    "error": "Serviço temporariamente indisponível",
                    "message": "O YouTube bloqueou temporariamente as requisições. Tente novamente em alguns minutos."
                }), 503
            
            # Mensagem genérica - não expor detalhes técnicos
            return jsonify({
                "error": "Falha no download",
                "message": "Não foi possível concluir o download. Tente novamente."
            }), 503  # Mudar de 500 para 503 (Service Unavailable)
    else:
        # Mensagem genérica - não expor detalhes técnicos
        return jsonify({
            "error": "Serviço indisponível",
            "message": "Serviço temporariamente indisponível. Tente novamente mais tarde."
        }), 503

    # Se chegou aqui, algo deu muito errado
    return jsonify({
        "error": "Erro desconhecido",
        "message": "Não foi possível processar o download"
    }), 503  # Mudar de 500 para 503 (Service Unavailable)


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
        # Verificar autenticação via token na query string (para SSE)
        token = request.args.get('token')
        if token:
            try:
                from flask_jwt_extended import decode_token
                decoded = decode_token(token)
                user_id = decoded.get('sub')
                if not user_id:
                    yield f"data: {json.dumps({'status': 'error', 'error': 'Sessão expirada. Faça login novamente.'})}\n\n"
                    return
            except Exception as e:
                app.logger.error(f"Erro ao verificar token SSE: {str(e)}")
                yield f"data: {json.dumps({'status': 'error', 'error': 'Sessão expirada. Faça login novamente.'})}\n\n"
                return
        else:
            # Tentar verificar via header Authorization (fallback)
            auth_header = request.headers.get('Authorization')
            if not auth_header or not auth_header.startswith('Bearer '):
                yield f"data: {json.dumps({'status': 'error', 'error': 'Faça login para continuar.'})}\n\n"
                return
            try:
                from flask_jwt_extended import decode_token
                token = auth_header.split(' ')[1]
                decoded = decode_token(token)
                user_id = decoded.get('sub')
                if not user_id:
                    yield f"data: {json.dumps({'status': 'error', 'error': 'Sessão expirada. Faça login novamente.'})}\n\n"
                    return
            except Exception as e:
                app.logger.error(f"Erro ao verificar token SSE: {str(e)}")
                yield f"data: {json.dumps({'status': 'error', 'error': 'Sessão expirada. Faça login novamente.'})}\n\n"
                return
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
                    app.logger.info("Thread de download iniciada para vídeo %s", video_id)
                    
                    def callback(data):
                        try:
                            progress_queue.put(data)
                        except Exception as e:
                            app.logger.error("Erro ao enviar progresso para queue: %s", str(e))
                    
                    app.logger.info("Chamando download_with_ytdlp para vídeo %s", video_id)
                    success, buffer, filename, error_msg = download_with_ytdlp(video_id, quality, callback)
                    app.logger.info("download_with_ytdlp retornou: success=%s, filename=%s, error=%s", 
                                  success, filename, error_msg)
                    
                    if success:
                        app.logger.info("Download bem-sucedido. Salvando buffer no cache para vídeo %s", video_id)
                        # Salvar buffer temporariamente (em produção, usar Redis ou storage)
                        download_progress[video_id] = {
                            'status': 'completed',
                            'percent': 100,
                            'filename': filename,
                            'buffer_ready': True,
                            'buffer': buffer  # Salvar buffer para download imediato
                        }
                        progress_queue.put({'status': 'completed', 'percent': 100, 'filename': filename})
                        app.logger.info("Status 'completed' enviado para queue. Thread finalizando.")
                    else:
                        app.logger.error("Download falhou: %s", error_msg)
                        progress_queue.put({'status': 'error', 'error': error_msg})
                except Exception as exc:
                    app.logger.exception("Exceção na thread de download para vídeo %s", video_id)
                    # Mensagem genérica - não expor detalhes técnicos
                    progress_queue.put({'status': 'error', 'error': 'Não foi possível concluir o download. Tente novamente.'})
            
            thread = threading.Thread(target=download_thread)
            thread.start()
            
            # Enviar progresso enquanto download está em andamento
            max_wait_time = 600  # 10 minutos máximo
            start_time = time.time()
            
            while thread.is_alive():
                # Verificar timeout
                if time.time() - start_time > max_wait_time:
                    app.logger.error("Timeout no download para vídeo %s", video_id)
                    yield f"data: {json.dumps({'status': 'error', 'error': 'Timeout: Download demorou muito'})}\n\n"
                    break
                    
                try:
                    data = progress_queue.get(timeout=0.5)
                    app.logger.debug("Enviando progresso via SSE: %s", data.get('status'))
                    yield f"data: {json.dumps(data)}\n\n"
                    
                    # Se recebeu status de completed ou error, sair do loop
                    if data.get('status') in ('completed', 'error'):
                        break
                except queue.Empty:
                    # Enviar progresso atual como heartbeat
                    current = download_progress.get(video_id, {})
                    if current.get('status') not in ('completed', 'error'):
                        yield f"data: {json.dumps(current)}\n\n"
                    time.sleep(0.5)
            
            # Aguardar thread terminar (com timeout de 10 segundos para garantir)
            thread.join(timeout=10)
            
            if thread.is_alive():
                app.logger.warning("Thread de download ainda está ativa após timeout para vídeo %s", video_id)
            
            # Enviar resultado final - garantir que temos o status correto
            final_data = download_progress.get(video_id, {})
            
            # Se não temos status completed mas a thread terminou, verificar buffer
            if final_data.get('status') != 'completed' and final_data.get('buffer_ready'):
                final_data['status'] = 'completed'
                app.logger.info("Buffer está pronto, marcando como completed")
            
            app.logger.info("Enviando status final via SSE: %s, filename=%s", 
                          final_data.get('status'), final_data.get('filename'))
            
            # Enviar evento final com todos os dados necessários
            final_event = {
                'status': final_data.get('status', 'unknown'),
                'percent': final_data.get('percent', 100),
            }
            if final_data.get('filename'):
                final_event['filename'] = final_data['filename']
            if final_data.get('error'):
                final_event['error'] = final_data['error']
            
            yield f"data: {json.dumps(final_event)}\n\n"
            
            # Aguardar um pouco para garantir que o evento foi enviado
            time.sleep(0.5)
            
        except Exception as exc:
            app.logger.exception("Erro no download_with_progress para vídeo %s", video_id)
            # Mensagem genérica - não expor detalhes técnicos
            yield f"data: {json.dumps({'status': 'error', 'error': 'Não foi possível concluir o download. Tente novamente.'})}\n\n"
        finally:
            # Manter progresso por 5 minutos para download do arquivo
            pass
    
    return Response(stream_with_context(generate()), mimetype='text/event-stream')


@app.get("/api/download-with-metadata")
@jwt_required()
def download_with_metadata():
    """
    Endpoint para download de vídeo com opções de metadados.
    
    Parâmetros:
    - videoId: ID do vídeo (obrigatório)
    - quality: format_id ou 'best' para melhor qualidade (opcional, padrão: 'best')
    - saveVideo: 'true' ou 'false' - se deve salvar o vídeo (padrão: 'true')
    - saveDescription: 'true' ou 'false' - se deve salvar descrição (padrão: 'false')
    - saveLinks: 'true' ou 'false' - se deve salvar links (padrão: 'false')
    - linkFilter: Termo que a URL deve conter para ser incluída (opcional)
    
    Retorna:
    - Se apenas vídeo: arquivo MP4 direto
    - Se tem metadados: arquivo ZIP contendo vídeo + metadata.json
    """
    # Verificar autenticação
    try:
        auth_header = request.headers.get('Authorization')
        if auth_header and auth_header.startswith('Bearer '):
            token = auth_header.split(' ')[1]
        else:
            return jsonify({"error": "Faça login para continuar."}), 401
        
        from flask_jwt_extended import decode_token
        decoded = decode_token(token)
        user_id = decoded.get('sub')
        if not user_id:
            return jsonify({"error": "Sessão inválida. Faça login novamente."}), 401
    except Exception as e:
        app.logger.error(f"Erro ao verificar autenticação: {str(e)}")
        return jsonify({"error": "Sessão inválida. Faça login novamente."}), 401
    
    video_id = request.args.get("videoId")
    quality = request.args.get("quality", "best")
    save_video = request.args.get("saveVideo", "true").lower() == "true"
    save_description = request.args.get("saveDescription", "false").lower() == "true"
    save_links = request.args.get("saveLinks", "false").lower() == "true"
    link_filter = request.args.get("linkFilter", "").strip()
    
    if not video_id:
        return jsonify({"error": "ID do video nao fornecido"}), 400
    
    if not YT_DLP_AVAILABLE:
        return jsonify({"error": "Serviço temporariamente indisponível"}), 503
    
    try:
        app.logger.info("Download com metadados: videoId=%s, saveVideo=%s, saveDescription=%s, saveLinks=%s", 
                       video_id, save_video, save_description, save_links)
        
        # URLs candidatas para o vídeo
        candidate_urls = [
            f"https://www.youtube.com/watch?v={video_id}",
            f"https://www.youtube.com/shorts/{video_id}",
            f"https://youtu.be/{video_id}",
        ]
        
        video_info = None
        video_url = None
        video_buffer = None
        video_filename = None
        
        # Obter informações do vídeo (sempre necessário para metadados)
        # Obter cookies de variável de ambiente se disponível
        cookies_file = os.environ.get('YOUTUBE_COOKIES_FILE')
        
        for url in candidate_urls:
            try:
                # Usar configurações otimizadas para evitar detecção de bot
                info_opts = get_ydl_opts_base(cookies_file=cookies_file, quiet=True)
                with yt_dlp.YoutubeDL(info_opts) as ydl:
                    # Obter informações do vídeo
                    video_info = ydl.extract_info(url, download=False)
                    
                    if video_info:
                        video_url = url
                        break
            except Exception as e:
                app.logger.debug("Tentativa falhou para %s: %s", url, str(e))
                continue
        
        if not video_info:
            return jsonify({"error": "Não foi possível obter informações do vídeo"}), 404
        
        # Baixar o vídeo se solicitado
        if save_video:
            format_selector = get_format_selector(quality)
            # Obter cookies de variável de ambiente se disponível
            cookies_file = os.environ.get('YOUTUBE_COOKIES_FILE')
            
            # Usar configurações otimizadas para evitar detecção de bot
            ydl_opts = get_ydl_opts_base(format_selector=format_selector, cookies_file=cookies_file, quiet=True)
            
            with tempfile.TemporaryDirectory() as tmpdir:
                ydl_opts['outtmpl'] = os.path.join(tmpdir, '%(title)s.%(ext)s')
                
                with yt_dlp.YoutubeDL(ydl_opts) as ydl:
                    ydl.download([video_url])
                    
                    # Encontrar arquivo baixado
                    all_files = os.listdir(tmpdir)
                    final_files = [
                        f for f in all_files 
                        if f.endswith('.mp4') 
                        and os.path.isfile(os.path.join(tmpdir, f))
                        and not re.search(r'\.f\d+\.(mp4|m4a)$', f)
                        and not f.endswith('.temp.mp4')
                    ]
                    
                    if final_files:
                        downloaded_file = os.path.join(tmpdir, final_files[0])
                        video_buffer = BytesIO()
                        with open(downloaded_file, 'rb') as f:
                            video_buffer.write(f.read())
                        video_buffer.seek(0)
                        video_filename = slugify(video_info.get('title', 'video')) + '.mp4'
                    else:
                        # Fallback: procurar qualquer arquivo MP4
                        mp4_files = [f for f in all_files if f.endswith('.mp4')]
                        if mp4_files:
                            downloaded_file = os.path.join(tmpdir, mp4_files[0])
                            video_buffer = BytesIO()
                            with open(downloaded_file, 'rb') as f:
                                video_buffer.write(f.read())
                            video_buffer.seek(0)
                            video_filename = slugify(video_info.get('title', 'video')) + '.mp4'
        
        # Se não baixou vídeo e não quer metadados, retornar erro
        if not save_video and not save_description and not save_links:
            return jsonify({"error": "Nenhuma opção de salvamento selecionada"}), 400
        
        # Preparar metadados
        metadata = {
            'title': video_info.get('title', ''),
            'channel': video_info.get('channel', ''),
            'published_at': video_info.get('upload_date', ''),
            'description': '',
            'links': []
        }
        
        # Extrair descrição se solicitado
        if save_description:
            metadata['description'] = video_info.get('description', '')
        
        # Extrair links se solicitado
        if save_links and metadata.get('description'):
            links = extract_product_links(metadata['description'], link_filter)
            metadata['links'] = links
        
        # Criar pacote (ZIP se tem metadados, vídeo direto caso contrário)
        if save_description or save_links:
            # Criar ZIP com vídeo (se disponível) e metadados
            package_buffer = create_video_package(
                video_buffer if (save_video and video_buffer) else BytesIO(),
                video_filename or 'video.mp4',
                metadata,
                save_video and video_buffer is not None,
                save_description,
                save_links
            )
            
            package_filename = slugify(video_info.get('title', 'video')) + '.zip'
            
            return send_file(
                package_buffer,
                mimetype='application/zip',
                as_attachment=True,
                download_name=package_filename
            )
        else:
            # Retornar vídeo direto (sem metadados)
            if not video_buffer:
                return jsonify({"error": "Nenhum conteúdo para baixar"}), 400
            
            return send_file(
                video_buffer,
                mimetype='video/mp4',
                as_attachment=True,
                download_name=video_filename or f'video_{video_id}.mp4'
            )
            
    except Exception as e:
        app.logger.exception("Erro ao baixar vídeo com metadados: %s", str(e))
        return jsonify({"error": f"Erro ao processar download: {str(e)}"}), 500


if __name__ == "__main__":
    port = int(os.getenv("PORT", "5000"))
    app.run(host="0.0.0.0", port=port)
