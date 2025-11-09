import React from 'react';
import './VideoCard.css';

const VideoCard = ({ video, onClick, isSelected }) => {
  const thumbnail = video.snippet.thumbnails.medium?.url || video.snippet.thumbnails.default?.url;
  const title = video.snippet.title;
  const channel = video.snippet.channelTitle;
  const publishedAt = new Date(video.snippet.publishedAt).toLocaleDateString('pt-BR');

  return (
    <div 
      className={`video-card ${isSelected ? 'selected' : ''}`}
      onClick={onClick}
    >
      <div className="video-thumbnail">
        <img src={thumbnail} alt={title} />
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

