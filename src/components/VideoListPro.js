import React, { useState, useMemo, useEffect } from 'react';
import './VideoListPro.css';
import VideoCard from './VideoCard';
import { isVideoDownloaded } from '../utils/downloadHistory';

const VideoListPro = ({ 
  videos, 
  onVideoSelect, 
  selectedVideo,
  selectable = false,
  onBatchDownload,
  downloadingVideos = new Set(), // Set de videoIds que estão sendo baixados
  hideDownloaded = false // Ocultar vídeos já baixados
}) => {
  const [checkedVideos, setCheckedVideos] = useState(new Set());

  // Escutar eventos de download para remover vídeos baixados da seleção
  useEffect(() => {
    if (!hideDownloaded) return;

    const handleVideoDownloaded = () => {
      // Remover vídeo baixado da seleção se estiver marcado
      setCheckedVideos(prev => {
        const filtered = Array.from(prev).filter(videoId => !isVideoDownloaded(videoId));
        return new Set(filtered);
      });
    };

    window.addEventListener('videoDownloaded', handleVideoDownloaded);
    return () => window.removeEventListener('videoDownloaded', handleVideoDownloaded);
  }, [hideDownloaded]);

  // Filtrar vídeos já baixados se a opção estiver ativa
  const filteredVideos = useMemo(() => {
    if (!hideDownloaded || !selectable) {
      return videos;
    }
    
    return videos.filter(video => {
      const videoId = video.id.videoId || video.id;
      return !isVideoDownloaded(videoId);
    });
  }, [videos, hideDownloaded, selectable]);

  // Remover vídeos baixados da seleção quando o filtro é ativado ou quando vídeos são filtrados
  useEffect(() => {
    if (hideDownloaded && selectable) {
      setCheckedVideos(prev => {
        // Remover vídeos que não estão na lista filtrada (foram ocultados)
        const filteredVideoIds = new Set(filteredVideos.map(v => v.id.videoId || v.id));
        const cleaned = Array.from(prev).filter(videoId => filteredVideoIds.has(videoId));
        
        // Se houve mudança, retornar novo Set, caso contrário retornar o mesmo
        if (cleaned.length !== prev.size) {
          return new Set(cleaned);
        }
        return prev;
      });
    }
  }, [hideDownloaded, selectable, filteredVideos]);

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
    if (checkedVideos.size === filteredVideos.length) {
      // Desmarcar todos
      setCheckedVideos(new Set());
    } else {
      // Marcar todos (apenas os vídeos filtrados)
      setCheckedVideos(new Set(filteredVideos.map(v => v.id.videoId || v.id)));
    }
  };

  const handleBatchDownloadClick = () => {
    if (checkedVideos.size > 0 && onBatchDownload) {
      onBatchDownload(Array.from(checkedVideos));
      // Limpar seleção após iniciar download
      setCheckedVideos(new Set());
    }
  };

  // Contar vídeos ocultos
  const hiddenCount = hideDownloaded && selectable 
    ? videos.length - filteredVideos.length 
    : 0;

  if (filteredVideos.length === 0) {
    return (
      <div className="no-videos">
        <p>🔍 {videos.length === 0 
          ? 'Nenhum vídeo encontrado. Tente pesquisar por "shorts" ou qualquer outro termo.'
          : hideDownloaded && hiddenCount > 0
            ? `Todos os ${videos.length} vídeo${videos.length !== 1 ? 's' : ''} encontrado${videos.length !== 1 ? 's' : ''} já foram baixados. Desative "Ocultar vídeos já baixados" para vê-los.`
            : 'Nenhum vídeo encontrado.'
        }</p>
      </div>
    );
  }

  return (
    <div className="video-list-pro-container">
      <div className="video-list-header">
        <div className="video-list-title-section">
          <h2 className="video-list-title">
            {filteredVideos.length} vídeo{filteredVideos.length !== 1 ? 's' : ''} disponível{filteredVideos.length !== 1 ? 'is' : ''}
            {hiddenCount > 0 && (
              <span className="hidden-count"> ({hiddenCount} já baixado{hiddenCount !== 1 ? 's' : ''} oculto{hiddenCount !== 1 ? 's' : ''})</span>
            )}
          </h2>
        </div>
        
        {selectable && (
          <div className="batch-controls">
            <button
              className="batch-select-button"
              onClick={handleSelectAll}
              disabled={filteredVideos.length === 0}
            >
              {checkedVideos.size === filteredVideos.length && filteredVideos.length > 0 
                ? '☐ Desmarcar Todos' 
                : '☑ Selecionar Todos'}
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
        {filteredVideos.map((video) => {
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

