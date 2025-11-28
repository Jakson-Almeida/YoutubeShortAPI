import React, { useState, useEffect } from 'react';
import './VideoPlayer.css';
import { markVideoAsDownloaded } from '../utils/downloadHistory';
import { useAuth } from '../contexts/AuthContext';
import Login from './Auth/Login';

const VideoPlayer = ({ video, onClose }) => {
  const { isAuthenticated, getAuthHeaders } = useAuth();
  const [downloading, setDownloading] = useState(false);
  const [downloadError, setDownloadError] = useState(null);
  const [formats, setFormats] = useState([]);
  const [selectedQuality, setSelectedQuality] = useState('best');
  const [loadingFormats, setLoadingFormats] = useState(true);
  const [downloadProgress, setDownloadProgress] = useState(null);
  const [showLoginModal, setShowLoginModal] = useState(false);

  const videoId = video.id.videoId;
  const channelId = video.snippet.channelId;
  const embedUrl = `https://www.youtube.com/embed/${videoId}`;
  const [channelHandle, setChannelHandle] = useState(null);
  const [showCopyFeedback, setShowCopyFeedback] = useState(false);

  // Bloquear scroll do body quando o modal estiver aberto
  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, []);

  // Buscar formatos disponíveis quando o componente é montado
  useEffect(() => {
    const fetchFormats = async () => {
      try {
        setLoadingFormats(true);
        const response = await fetch(`/api/formats?videoId=${videoId}`);
        if (response.ok) {
          const data = await response.json();
          setFormats(data.formats || []);
          if (data.formats && data.formats.length > 0) {
            setSelectedQuality(data.formats[0].format_id || 'best');
          }
        }
      } catch (error) {
        console.error('Erro ao buscar formatos:', error);
      } finally {
        setLoadingFormats(false);
      }
    };

    fetchFormats();
  }, [videoId]);

  // Buscar handle do canal
  useEffect(() => {
    const fetchChannelHandle = async () => {
      if (!channelId) return;
      
      try {
        const apiKey = process.env.REACT_APP_YOUTUBE_API_KEY;
        if (!apiKey) return;

        const response = await fetch(
          `https://www.googleapis.com/youtube/v3/channels?part=snippet&id=${channelId}&key=${apiKey}`
        );
        
        if (response.ok) {
          const data = await response.json();
          if (data.items && data.items.length > 0) {
            const handle = data.items[0].snippet.customUrl;
            if (handle) {
              setChannelHandle(handle);
            }
          }
        }
      } catch (error) {
        console.error('Erro ao buscar handle do canal:', error);
      }
    };

    fetchChannelHandle();
  }, [channelId]);

  const handleCopyChannelHandle = (e) => {
    e.stopPropagation();
    if (channelHandle) {
      navigator.clipboard.writeText(channelHandle).then(() => {
        setShowCopyFeedback(true);
        setTimeout(() => setShowCopyFeedback(false), 2000);
      });
    }
  };

  const handleDownload = async () => {
    // Verificar autenticação antes de fazer download
    // Verificar tanto no contexto quanto diretamente no localStorage
    const hasToken = isAuthenticated || localStorage.getItem('auth_token');
    if (!hasToken) {
      setShowLoginModal(true);
      return;
    }

    setDownloading(true);
    setDownloadError(null);
    setDownloadProgress({ status: 'starting', percent: 0, downloaded_mb: 0, total_mb: 0, speed_mbps: 0 });

    try {
      // EventSource não suporta headers customizados, então passamos o token na query string
      // O backend irá verificar o token da query string para SSE
      const token = localStorage.getItem('auth_token');
      const eventSourceUrl = `/api/download?videoId=${videoId}&quality=${selectedQuality}&progress=true${token ? `&token=${token}` : ''}`;
      const eventSource = new EventSource(eventSourceUrl);

      let downloadCompleted = false;

      eventSource.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          
          // Log apenas eventos importantes (evitar spam de 'starting')
          if (data.status === 'downloading' && data.percent > 0) {
            console.log(`Download: ${data.percent.toFixed(1)}% (${data.downloaded_mb?.toFixed(2) || 0} MB / ${data.total_mb?.toFixed(2) || 0} MB)`);
          } else if (data.status !== 'starting') {
            console.log('Evento SSE:', data.status, data);
          }
          
          if (data.status === 'downloading' || data.status === 'starting') {
            setDownloadProgress({
              status: data.status,
              percent: data.percent || 0,
              downloaded_mb: data.downloaded_mb || 0,
              total_mb: data.total_mb || 0,
              speed_mbps: data.speed_mbps || 0,
            });
          } else if (data.status === 'finished' || data.status === 'processing') {
            setDownloadProgress(prev => ({ 
              ...prev, 
              status: 'processing', 
              percent: 100,
              message: data.message || 'Processando... Juntando áudio e vídeo'
            }));
          } else if (data.status === 'completed') {
            console.log('Download completado! Iniciando download do arquivo...');
            const filename = data.filename || `${video.snippet.title.replace(/[^a-z0-9]/gi, '_')}.mp4`;
            setDownloadProgress(prev => ({ ...prev, status: 'completed', percent: 100 }));
            
            // Fazer download do arquivo após progresso completar
            downloadCompleted = true;
            eventSource.close();
            
            // Aguardar um pouco para garantir que o estado foi atualizado e então baixar
            setTimeout(() => {
              console.log('Chamando handleDownloadFile com filename:', filename);
              handleDownloadFile(selectedQuality, filename);
            }, 500);
          } else if (data.status === 'error') {
            console.error('Erro recebido via SSE:', data.error);
            eventSource.close();
            downloadCompleted = true;
            setDownloadError(data.error || 'Erro ao baixar vídeo');
            setDownloading(false);
            setDownloadProgress(null);
          }
        } catch (error) {
          console.error('Erro ao processar evento SSE:', error);
        }
      };

      eventSource.onerror = (error) => {
        console.error('Erro no EventSource:', error);
        console.log('EventSource readyState:', eventSource.readyState);
        
        // Se o EventSource fechou (readyState === 2), pode ser que o download tenha completado
        if (eventSource.readyState === EventSource.CLOSED) {
          console.log('EventSource fechado. Verificando se download completou...');
          
          // Aguardar um pouco e verificar se podemos baixar do cache
          setTimeout(() => {
            if (!downloadCompleted) {
              console.log('Tentando baixar do cache...');
              // Tentar baixar diretamente - o backend pode ter o arquivo em cache
              handleDownloadFile(selectedQuality);
            }
          }, 1000);
        }
        
        eventSource.close();
        
        // Verificar se foi erro de autenticação
        if (eventSource.readyState === EventSource.CLOSED && !downloadCompleted) {
          // Pode ser erro de autenticação - verificar
          setTimeout(() => {
            if (!downloadCompleted) {
              // Tentar verificar se é erro de autenticação
              const token = localStorage.getItem('auth_token');
              if (!token) {
                // Não há token - mostrar modal de login
                setShowLoginModal(true);
                setDownloadError('Você precisa estar autenticado para fazer downloads');
                setDownloading(false);
                setDownloadProgress(null);
              } else {
                // Verificar se o token ainda é válido
                fetch(`/api/auth/verify`, {
                  headers: { 'Authorization': `Bearer ${token}` }
                }).then(res => {
                  if (!res.ok) {
                    setShowLoginModal(true);
                    setDownloadError('Sessão expirada. Faça login novamente.');
                    setDownloading(false);
                    setDownloadProgress(null);
                  } else {
                    // Token válido - tentar download normal sem progresso
                    handleDownloadFallback();
                  }
                }).catch(() => {
                  // Erro de rede - tentar download mesmo assim
                  handleDownloadFallback();
                });
              }
            }
          }, 1000);
        } else if (!downloadCompleted) {
          // Fallback: tentar download normal sem progresso
          setTimeout(() => {
            handleDownloadFallback();
          }, 2000);
        }
      };

      // Timeout de segurança (10 minutos)
      setTimeout(() => {
        if (!downloadCompleted) {
          eventSource.close();
          setDownloadError('Timeout: O download demorou muito. Tente novamente.');
          setDownloading(false);
          setDownloadProgress(null);
        }
      }, 600000);

    } catch (error) {
      console.error('Erro ao iniciar download:', error);
      // Fallback para download normal
      handleDownloadFallback();
    }
  };

  const handleDownloadFile = async (quality, filename) => {
    try {
      console.log(`Baixando arquivo: videoId=${videoId}, quality=${quality}, filename=${filename || 'não fornecido'}`);
      const headers = getAuthHeaders();
      const response = await fetch(`/api/download?videoId=${videoId}&quality=${quality}`, {
        headers: headers
      });
      
      if (!response.ok) {
        if (response.status === 401) {
          // Verificar se o token ainda existe no localStorage antes de mostrar modal
          const token = localStorage.getItem('auth_token');
          if (!token) {
            setShowLoginModal(true);
            setDownloadError('Você precisa estar autenticado para fazer downloads');
          } else {
            // Token existe mas foi rejeitado - pode estar expirado
            setDownloadError('Sessão expirada. Faça login novamente.');
            setShowLoginModal(true);
          }
          setDownloading(false);
          setDownloadProgress(null);
          return;
        }
        const errorText = await response.text();
        console.error('Resposta de erro do servidor:', errorText);
        throw new Error(`Erro ao baixar arquivo: ${response.status} ${response.statusText}`);
      }

      // Obter filename do header Content-Disposition se não foi fornecido
      let finalFilename = filename;
      if (!finalFilename) {
        const contentDisposition = response.headers.get('Content-Disposition');
        if (contentDisposition) {
          const filenameMatch = contentDisposition.match(/filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/);
          if (filenameMatch && filenameMatch[1]) {
            finalFilename = filenameMatch[1].replace(/['"]/g, '');
          }
        }
      }
      
      // Fallback: usar título do vídeo
      if (!finalFilename) {
        finalFilename = `${video.snippet.title.replace(/[^a-z0-9]/gi, '_')}.mp4`;
      }

      console.log('Iniciando download do blob, filename:', finalFilename);
      const blob = await response.blob();
      console.log('Blob recebido, tamanho:', blob.size, 'bytes');
      
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = finalFilename;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      
      console.log('Download iniciado no navegador');
      
      // Marcar vídeo como baixado no localStorage
      markVideoAsDownloaded(videoId, {
        title: video.snippet.title,
        channelTitle: video.snippet.channelTitle,
        thumbnail: video.snippet.thumbnails.medium?.url || video.snippet.thumbnails.default?.url,
        quality: quality
      });
      
      // Disparar evento customizado para atualizar os VideoCards
      window.dispatchEvent(new CustomEvent('videoDownloaded', { 
        detail: { videoId } 
      }));
      
      setDownloading(false);
      setDownloadProgress(null);
    } catch (error) {
      console.error('Erro ao baixar arquivo:', error);
      setDownloadError(`Erro ao baixar arquivo: ${error.message}. Tente novamente.`);
      setDownloading(false);
      setDownloadProgress(null);
    }
  };

  const handleDownloadFallback = async () => {
    try {
      const headers = getAuthHeaders();
      const response = await fetch(`/api/download?videoId=${videoId}&quality=${selectedQuality}`, {
        headers: headers
      });
      
      if (!response.ok) {
        if (response.status === 401) {
          // Verificar se o token ainda existe no localStorage antes de mostrar modal
          const token = localStorage.getItem('auth_token');
          if (!token) {
            setShowLoginModal(true);
            setDownloadError('Você precisa estar autenticado para fazer downloads');
          } else {
            // Token existe mas foi rejeitado - pode estar expirado
            setDownloadError('Sessão expirada. Faça login novamente.');
            setShowLoginModal(true);
          }
          setDownloading(false);
          setDownloadProgress(null);
          return;
        }
        let message = 'Serviço de download não disponível.';
        try {
          const errorResponse = await response.json();
          if (errorResponse?.error) {
            message = `${message} (${errorResponse.error}${errorResponse.message ? `: ${errorResponse.message}` : ''})`;
          }
        } catch (_) {
          // ignora caso não seja JSON
        }
        throw new Error(message);
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${video.snippet.title.replace(/[^a-z0-9]/gi, '_')}.mp4`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      
      // Marcar vídeo como baixado no localStorage
      markVideoAsDownloaded(videoId, {
        title: video.snippet.title,
        channelTitle: video.snippet.channelTitle,
        thumbnail: video.snippet.thumbnails.medium?.url || video.snippet.thumbnails.default?.url,
        quality: selectedQuality
      });
      
      // Disparar evento customizado para atualizar os VideoCards
      window.dispatchEvent(new CustomEvent('videoDownloaded', { 
        detail: { videoId } 
      }));
      
      setDownloading(false);
      setDownloadProgress(null);
    } catch (error) {
      console.error('Erro ao baixar vídeo (fallback):', error);
      
      if (error.message.includes('Failed to fetch') || error.message.includes('ECONNREFUSED')) {
        setDownloadError('Backend Python não está rodando. Vá até python-backend/, instale as dependências e execute "python app.py".');
      } else {
        setDownloadError(error.message);
      }
      
      const alternativeUrl = `https://www.y2mate.com/youtube/${videoId}`;
      setTimeout(() => {
        if (window.confirm('Serviço de download não disponível. Deseja abrir um serviço online alternativo?')) {
          window.open(alternativeUrl, '_blank');
        }
      }, 500);
      
      setDownloading(false);
      setDownloadProgress(null);
    }
  };

  return (
    <div className="video-player-overlay" onClick={onClose}>
      <div className="video-player-container" onClick={(e) => e.stopPropagation()}>
        <button className="close-button" onClick={onClose}>
          ✕
        </button>
        
        <div className="video-player-content">
          <div className="video-embed">
            <iframe
              src={embedUrl}
              title={video.snippet.title}
              frameBorder="0"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
            ></iframe>
          </div>

          <div className="video-details">
            <h2 className="video-player-title">{video.snippet.title}</h2>
            <p className="video-player-channel">
              📺 {video.snippet.channelTitle}
              {channelHandle && (
                <span 
                  className="channel-handle" 
                  onClick={handleCopyChannelHandle}
                  title="Clique para copiar"
                >
                  {channelHandle}
                  <span className="copy-icon">📋</span>
                  {showCopyFeedback && <span className="copy-feedback">Copiado!</span>}
                </span>
              )}
            </p>
            <p className="video-player-description">
              {video.snippet.description.substring(0, 200)}
              {video.snippet.description.length > 200 ? '...' : ''}
            </p>

            <div className="download-section">
              {/* Seletor de Qualidade */}
              {!loadingFormats && formats.length > 0 && (
                <div className="quality-selector">
                  <label htmlFor="quality-select">Qualidade do vídeo:</label>
                  <select
                    id="quality-select"
                    value={selectedQuality}
                    onChange={(e) => setSelectedQuality(e.target.value)}
                    disabled={downloading}
                    className="quality-select"
                  >
                    {formats.map((format) => (
                      <option key={format.format_id} value={format.format_id}>
                        {format.quality}
                        {format.filesize_mb ? ` (~${format.filesize_mb} MB)` : ''}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {loadingFormats && (
                <div className="loading-formats">
                  <p>Carregando qualidades disponíveis...</p>
                </div>
              )}

              {/* Botão de Download */}
              <button
                className="download-button"
                onClick={handleDownload}
                disabled={downloading || loadingFormats}
              >
                {downloading ? '⏳ Baixando...' : '⬇️ Baixar Vídeo'}
              </button>

              {/* Progresso do Download */}
              {downloadProgress && (
                <div className="download-progress">
                  <div className="progress-bar-container">
                    <div 
                      className="progress-bar" 
                      style={{ width: `${downloadProgress.percent || 0}%` }}
                    ></div>
                  </div>
                  <div className="progress-info">
                    <span className="progress-percent">
                      {downloadProgress.percent?.toFixed(1) || 0}%
                    </span>
                    {downloadProgress.status === 'downloading' && (
                      <div className="progress-details">
                        <span>
                          {downloadProgress.downloaded_mb?.toFixed(2) || 0} MB
                          {downloadProgress.total_mb ? ` / ${downloadProgress.total_mb.toFixed(2)} MB` : ''}
                        </span>
                        {downloadProgress.speed_mbps > 0 && (
                          <span className="download-speed">
                            @ {downloadProgress.speed_mbps.toFixed(2)} MB/s
                          </span>
                        )}
                      </div>
                    )}
                    {downloadProgress.status === 'completed' && (
                      <span className="progress-complete">✓ Download concluído!</span>
                    )}
                    {downloadProgress.status === 'processing' && (
                      <span className="progress-processing">⚙️ {downloadProgress.message || 'Processando...'}</span>
                    )}
                  </div>
                </div>
              )}

              {downloadError && (
                <div className="download-error">
                  <p>⚠️ {downloadError}</p>
                  <p className="download-alternative">
                    Você pode copiar o ID do vídeo: <strong>{videoId}</strong> e usar 
                    serviços online como y2mate.com ou savefrom.net
                  </p>
                </div>
              )}

              <div className="video-links">
                <a
                  href={`https://www.youtube.com/watch?v=${videoId}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="external-link"
                >
                  🔗 Abrir no YouTube
                </a>
              </div>
            </div>
          </div>
        </div>
      </div>
      
      {showLoginModal && (
        <Login 
          onClose={() => setShowLoginModal(false)}
          onSwitchToRegister={() => {
            setShowLoginModal(false);
            // Poderia abrir modal de registro aqui
          }}
        />
      )}
    </div>
  );
};

export default VideoPlayer;


