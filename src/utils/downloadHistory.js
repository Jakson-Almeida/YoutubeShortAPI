/**
 * Utilitário para gerenciar histórico de downloads no localStorage
 */

const STORAGE_KEY = 'youtube_shorts_downloaded_videos';

/**
 * Obtém todos os vídeos baixados
 */
export const getDownloadedVideos = () => {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return {};
    
    const videos = JSON.parse(stored);
    
    // Limpar vídeos muito antigos (mais de 90 dias) para evitar que o localStorage fique muito grande
    const now = Date.now();
    const maxAge = 90 * 24 * 60 * 60 * 1000; // 90 dias em milissegundos
    
    const cleaned = {};
    let hasChanges = false;
    
    Object.keys(videos).forEach(videoId => {
      const videoData = videos[videoId];
      if (videoData && videoData.downloadedAt) {
        const age = now - videoData.downloadedAt;
        if (age < maxAge) {
          cleaned[videoId] = videoData;
        } else {
          hasChanges = true;
        }
      } else {
        cleaned[videoId] = videoData;
      }
    });
    
    if (hasChanges) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(cleaned));
    }
    
    return cleaned;
  } catch (error) {
    console.error('Erro ao ler histórico de downloads:', error);
    return {};
  }
};

/**
 * Verifica se um vídeo foi baixado
 */
export const isVideoDownloaded = (videoId) => {
  const downloadedVideos = getDownloadedVideos();
  return !!downloadedVideos[videoId];
};

/**
 * Marca um vídeo como baixado
 */
export const markVideoAsDownloaded = (videoId, videoInfo = {}) => {
  try {
    const downloadedVideos = getDownloadedVideos();
    
    downloadedVideos[videoId] = {
      videoId,
      title: videoInfo.title || '',
      channelTitle: videoInfo.channelTitle || '',
      thumbnail: videoInfo.thumbnail || '',
      downloadedAt: Date.now(),
      quality: videoInfo.quality || 'best',
      ...videoInfo
    };
    
    localStorage.setItem(STORAGE_KEY, JSON.stringify(downloadedVideos));
    return true;
  } catch (error) {
    console.error('Erro ao salvar histórico de download:', error);
    return false;
  }
};

/**
 * Remove um vídeo do histórico (caso o usuário queira limpar)
 */
export const removeDownloadedVideo = (videoId) => {
  try {
    const downloadedVideos = getDownloadedVideos();
    delete downloadedVideos[videoId];
    localStorage.setItem(STORAGE_KEY, JSON.stringify(downloadedVideos));
    return true;
  } catch (error) {
    console.error('Erro ao remover histórico de download:', error);
    return false;
  }
};

/**
 * Limpa todo o histórico de downloads
 */
export const clearDownloadHistory = () => {
  try {
    localStorage.removeItem(STORAGE_KEY);
    return true;
  } catch (error) {
    console.error('Erro ao limpar histórico de downloads:', error);
    return false;
  }
};

/**
 * Obtém estatísticas do histórico
 */
export const getDownloadStats = () => {
  const downloadedVideos = getDownloadedVideos();
  const count = Object.keys(downloadedVideos).length;
  
  // Calcular espaço aproximado (cada vídeo ~10-50MB em média, vamos estimar 20MB)
  const estimatedSizeMB = count * 20;
  
  return {
    count,
    estimatedSizeMB: Math.round(estimatedSizeMB)
  };
};

