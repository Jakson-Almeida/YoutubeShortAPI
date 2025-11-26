import React, { useState, useEffect } from 'react';
import '../App.css';
import SearchBar from '../components/SearchBar';
import VideoList from '../components/VideoList';
import VideoPlayer from '../components/VideoPlayer';
import SuggestedContent from '../components/SuggestedContent';
import Logo from '../components/Logo';
import { Link } from 'react-router-dom';
import { saveLastSearch, getLastSearch } from '../utils/searchHistory';

function HomePage() {
  const [videos, setVideos] = useState([]);
  const [selectedVideo, setSelectedVideo] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [hasSearched, setHasSearched] = useState(false);
  const [initialLoad, setInitialLoad] = useState(true);

  const handleSearch = async (searchTerm, silent = false) => {
    if (!silent) {
      setLoading(true);
      setError(null);
      setSelectedVideo(null);
    }

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
        setVideos(data.items);
        setHasSearched(true);
        // Salvar pesquisa no localStorage
        saveLastSearch(searchTerm, data.items);
      } else {
        setVideos([]);
        setHasSearched(true);
      }
    } catch (err) {
      setError(err.message);
      setVideos([]);
      setHasSearched(true);
    } finally {
      setLoading(false);
      setInitialLoad(false);
    }
  };

  // Carregar última pesquisa ao montar o componente
  useEffect(() => {
    const lastSearch = getLastSearch();
    
    if (lastSearch && lastSearch.results && lastSearch.results.length > 0) {
      // Restaurar vídeos da última pesquisa
      setVideos(lastSearch.results);
      setHasSearched(true);
      setInitialLoad(false);
    } else if (lastSearch && lastSearch.term) {
      // Se tem termo mas não tem resultados, buscar novamente silenciosamente
      handleSearch(lastSearch.term, true);
    } else {
      // Se não tem última pesquisa, mostrar conteúdo sugerido
      // (não fazer busca automática, deixar usuário escolher)
      setInitialLoad(false);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleVideoSelect = (video) => {
    setSelectedVideo(video);
  };

  return (
    <div className="App">
      <header className="app-header">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
            <Logo size="medium" showText={false} />
            <div>
              <h1 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '10px' }}>
                <span>YouTube Shorts Downloader</span>
              </h1>
              <p style={{ margin: '5px 0 0 0' }}>Pesquise, visualize e baixe seus Shorts favoritos</p>
            </div>
          </div>
          <Link to="/pro" className="pro-link" style={{ 
            padding: '10px 20px', 
            backgroundColor: '#ff6b6b', 
            color: 'white', 
            textDecoration: 'none', 
            borderRadius: '5px',
            fontWeight: 'bold'
          }}>
            ⭐ Pro
          </Link>
        </div>
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
            <p>{initialLoad ? 'Carregando conteúdo...' : 'Buscando vídeos...'}</p>
          </div>
        ) : (
          <>
            {!hasSearched ? (
              <SuggestedContent onSearch={handleSearch} />
            ) : (
              <VideoList
                videos={videos}
                onVideoSelect={handleVideoSelect}
                selectedVideo={selectedVideo}
              />
            )}
          </>
        )}
      </div>
    </div>
  );
}

export default HomePage;

