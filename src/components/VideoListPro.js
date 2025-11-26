import React, { useState } from 'react';
import './VideoListPro.css';
import VideoCard from './VideoCard';

const VideoListPro = ({ 
  videos, 
  onVideoSelect, 
  selectedVideo,
  selectable = false,
  onBatchDownload,
  downloadingVideos = new Set() // Set de videoIds que estão sendo baixados
}) => {
  const [checkedVideos, setCheckedVideos] = useState(new Set());

  const handleCheckChange = (videoId, isChecked) => {
    setCheckedVideos(prev => {
      const newSet = new Set(prev);
      if (isChecked) {
        newSet.add(videoId);
      } else {
        newSet.delete(videoId);
      }
      return newSet;
    });
  };

  const handleSelectAll = () => {
    if (checkedVideos.size === videos.length) {
      // Desmarcar todos
      setCheckedVideos(new Set());
    } else {
      // Marcar todos
      setCheckedVideos(new Set(videos.map(v => v.id.videoId || v.id)));
    }
  };

  const handleBatchDownloadClick = () => {
    if (checkedVideos.size > 0 && onBatchDownload) {
      onBatchDownload(Array.from(checkedVideos));
      // Limpar seleção após iniciar download
      setCheckedVideos(new Set());
    }
  };

  if (videos.length === 0) {
    return (
      <div className="no-videos">
        <p>🔍 Nenhum vídeo encontrado. Tente pesquisar por "shorts" ou qualquer outro termo.</p>
      </div>
    );
  }

  return (
    <div className="video-list-pro-container">
      <div className="video-list-header">
        <h2 className="video-list-title">
          {videos.length} vídeo{videos.length !== 1 ? 's' : ''} encontrado{videos.length !== 1 ? 's' : ''}
        </h2>
        
        {selectable && (
          <div className="batch-controls">
            <button
              className="batch-select-button"
              onClick={handleSelectAll}
              disabled={videos.length === 0}
            >
              {checkedVideos.size === videos.length ? '☐ Desmarcar Todos' : '☑ Selecionar Todos'}
            </button>
            
            {checkedVideos.size > 0 && (
              <button
                className="batch-download-button"
                onClick={handleBatchDownloadClick}
                disabled={downloadingVideos.size > 0}
              >
                ⬇ Baixar Selecionados ({checkedVideos.size})
              </button>
            )}
          </div>
        )}
      </div>

      <div className="video-grid">
        {videos.map((video) => {
          const videoId = video.id.videoId || video.id;
          const isChecked = checkedVideos.has(videoId);
          const isDownloading = downloadingVideos.has(videoId);
          
          return (
            <VideoCard
              key={videoId}
              video={video}
              onClick={() => !selectable && onVideoSelect?.(video)}
              isSelected={selectedVideo?.id.videoId === videoId}
              selectable={selectable}
              isChecked={isChecked}
              onCheckChange={handleCheckChange}
              isDownloading={isDownloading}
            />
          );
        })}
      </div>
    </div>
  );
};

export default VideoListPro;

