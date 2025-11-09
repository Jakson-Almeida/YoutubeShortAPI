import React from 'react';
import './VideoList.css';
import VideoCard from './VideoCard';

const VideoList = ({ videos, onVideoSelect, selectedVideo }) => {
  if (videos.length === 0) {
    return (
      <div className="no-videos">
        <p>🔍 Nenhum vídeo encontrado. Tente pesquisar por "shorts" ou qualquer outro termo.</p>
      </div>
    );
  }

  return (
    <div className="video-list-container">
      <h2 className="video-list-title">
        {videos.length} vídeo{videos.length !== 1 ? 's' : ''} encontrado{videos.length !== 1 ? 's' : ''}
      </h2>
      <div className="video-grid">
        {videos.map((video) => (
          <VideoCard
            key={video.id.videoId}
            video={video}
            onClick={() => onVideoSelect(video)}
            isSelected={selectedVideo?.id.videoId === video.id.videoId}
          />
        ))}
      </div>
    </div>
  );
};

export default VideoList;



