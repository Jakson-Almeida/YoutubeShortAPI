import React, { useState } from 'react';
import './App.css';
import SearchBar from './components/SearchBar';
import VideoList from './components/VideoList';
import VideoPlayer from './components/VideoPlayer';

function App() {
  const [videos, setVideos] = useState([]);
  const [selectedVideo, setSelectedVideo] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleSearch = async (searchTerm) => {
    setLoading(true);
    setError(null);
    setSelectedVideo(null);

    const apiKey = process.env.REACT_APP_YOUTUBE_API_KEY;
    
    if (!apiKey) {
      setError('API key não configurada. Verifique o arquivo .env');
      setLoading(false);
      return;
    }

    try {
      const response = await fetch(
        `https://www.googleapis.com/youtube/v3/search?part=snippet&maxResults=20&q=${encodeURIComponent(searchTerm)}&type=video&videoDuration=short&key=${apiKey}`
      );

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error?.message || 'Erro ao buscar vídeos. Verifique sua API key.');
      }

      const data = await response.json();
      
      if (data.items) {
        // Filtrar apenas vídeos que são Shorts (geralmente têm menos de 60 segundos)
        setVideos(data.items);
      } else {
        setVideos([]);
      }
    } catch (err) {
      setError(err.message);
      setVideos([]);
    } finally {
      setLoading(false);
    }
  };

  const handleVideoSelect = (video) => {
    setSelectedVideo(video);
  };

  return (
    <div className="App">
      <header className="app-header">
        <h1>🎬 YouTube Shorts Downloader</h1>
        <p>Pesquise, visualize e baixe seus Shorts favoritos</p>
      </header>

      <div className="app-container">
        <SearchBar onSearch={handleSearch} loading={loading} />

        {error && (
          <div className="error-message">
            ⚠️ {error}
          </div>
        )}

        {selectedVideo && (
          <VideoPlayer video={selectedVideo} onClose={() => setSelectedVideo(null)} />
        )}

        {loading ? (
          <div className="loading-container">
            <div className="spinner"></div>
            <p>Buscando vídeos...</p>
          </div>
        ) : (
          <VideoList
            videos={videos}
            onVideoSelect={handleVideoSelect}
            selectedVideo={selectedVideo}
          />
        )}
      </div>
    </div>
  );
}

export default App;

