import React, { useState } from 'react';
import './VideoPlayer.css';

const VideoPlayer = ({ video, onClose }) => {
  const [downloading, setDownloading] = useState(false);
  const [downloadError, setDownloadError] = useState(null);

  const videoId = video.id.videoId;
  const embedUrl = `https://www.youtube.com/embed/${videoId}`;

  const handleDownload = async () => {
    setDownloading(true);
    setDownloadError(null);

    try {
      // Tentar usar um serviço de API externo para download
      // Nota: Para produção, você precisará de um backend próprio ou usar uma API paga
      const response = await fetch(`/api/download?videoId=${videoId}`, {
        method: 'GET',
      });

      if (!response.ok) {
        // Se não houver backend, fornecer alternativa
        throw new Error('Serviço de download não disponível. Use a URL abaixo para baixar manualmente.');
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
    } catch (error) {
      // Verificar se é erro de conexão (backend não está rodando)
      if (error.message.includes('Failed to fetch') || error.message.includes('ECONNREFUSED')) {
        setDownloadError('Backend Python não está rodando. Vá até python-backend/, instale as dependências e execute "python app.py".');
      } else {
        setDownloadError(error.message);
      }
      
      // Fornecer link alternativo usando serviços online gratuitos
      const alternativeUrl = `https://www.y2mate.com/youtube/${videoId}`;
      setTimeout(() => {
        if (window.confirm('Serviço de download não disponível. Deseja abrir um serviço online alternativo?')) {
          window.open(alternativeUrl, '_blank');
        }
      }, 500);
    } finally {
      setDownloading(false);
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
            </p>
            <p className="video-player-description">
              {video.snippet.description.substring(0, 200)}
              {video.snippet.description.length > 200 ? '...' : ''}
            </p>

            <div className="download-section">
              <button
                className="download-button"
                onClick={handleDownload}
                disabled={downloading}
              >
                {downloading ? '⏳ Baixando...' : '⬇️ Baixar Vídeo'}
              </button>

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
    </div>
  );
};

export default VideoPlayer;


