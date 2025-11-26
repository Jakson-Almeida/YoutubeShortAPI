import React, { useState, useEffect } from 'react';
import './VideoCard.css';
import { isVideoDownloaded } from '../utils/downloadHistory';

const VideoCard = ({ video, onClick, isSelected }) => {
  const thumbnail = video.snippet.thumbnails.medium?.url || video.snippet.thumbnails.default?.url;
  const title = video.snippet.title;
  const channel = video.snippet.channelTitle;
  const publishedAt = new Date(video.snippet.publishedAt).toLocaleDateString('pt-BR');
  const videoId = video.id.videoId || video.id;
  const [downloaded, setDownloaded] = useState(isVideoDownloaded(videoId));

  // Escutar eventos de download para atualizar o estado
  useEffect(() => {
    const handleVideoDownloaded = (event) => {
      if (event.detail.videoId === videoId) {
        setDownloaded(true);
      }
    };

    window.addEventListener('videoDownloaded', handleVideoDownloaded);
    
    // Também verificar ao montar o componente
    setDownloaded(isVideoDownloaded(videoId));

    return () => {
      window.removeEventListener('videoDownloaded', handleVideoDownloaded);
    };
  }, [videoId]);

  return (
    <div 
      className={`video-card ${isSelected ? 'selected' : ''} ${downloaded ? 'downloaded' : ''}`}
      onClick={onClick}
    >
      <div className="video-thumbnail">
        <img src={thumbnail} alt={title} />
        {downloaded && (
          <div className="downloaded-badge" title="Vídeo já baixado">
            ✓
          </div>
        )}
        <div className="play-overlay">
          <span className="play-icon">▶</span>
        </div>
      </div>
      <div className="video-info">
        <h3 className="video-title" title={title}>
          {title}
        </h3>
        <p className="video-channel">{channel}</p>
        <p className="video-date">Publicado em {publishedAt}</p>
      </div>
    </div>
  );
};

export default VideoCard;

