import React from 'react';
import './SuggestedContent.css';

const SuggestedContentPro = ({ onSearchVideos, onSearchChannels }) => {
  const videoSuggestions = [
    { term: 'shorts', label: '🎬 Shorts', popular: true },
    { term: 'viral', label: '🔥 Viral', popular: true },
    { term: 'trending', label: '📈 Em Alta', popular: true },
    { term: 'funny shorts', label: '😄 Engraçados' },
    { term: 'cooking shorts', label: '👨‍🍳 Receitas' },
    { term: 'dance shorts', label: '💃 Dança' },
    { term: 'music shorts', label: '🎵 Música' },
    { term: 'gaming shorts', label: '🎮 Games' },
    { term: 'achadinhos shopee', label: '🛒 Achadinhos Shopee' },
    { term: 'dicas casa', label: '🏠 Dicas Casa' },
  ];

  const channelSuggestions = [
    { term: 'achadinhos', label: '🛒 Achadinhos' },
    { term: 'utilidades', label: '🔧 Utilidades' },
    { term: 'receitas', label: '👨‍🍳 Receitas' },
    { term: 'dicas', label: '💡 Dicas' },
    { term: 'moda', label: '👗 Moda' },
    { term: 'decoração', label: '🏠 Decoração' },
  ];

  const handleVideoSuggestionClick = (term) => {
    if (onSearchVideos) {
      onSearchVideos({ query: term, channelId: null, orderBy: 'date' });
    }
  };

  const handleChannelSuggestionClick = (term) => {
    if (onSearchChannels) {
      onSearchChannels(term);
    }
  };

  const handleFeelingLucky = () => {
    // Termos aleatórios para "estou com sorte"
    const luckyTerms = [
      'shorts viral',
      'achadinhos shopee',
      'shorts trending',
      'shorts funny',
      'dicas casa'
    ];
    const randomTerm = luckyTerms[Math.floor(Math.random() * luckyTerms.length)];
    handleVideoSuggestionClick(randomTerm);
  };

  return (
    <div className="suggested-content">
      <div className="suggested-header">
        <h2>✨ Conteúdo Sugerido - Pro</h2>
        <p>Explore shorts populares, canais ou tente sua sorte!</p>
      </div>

      <div className="suggestions-section">
        <h3 className="suggestions-section-title">🎬 Sugestões de Vídeos</h3>
        <div className="suggestions-grid">
          <div 
            className="suggestion-card lucky-card"
            onClick={handleFeelingLucky}
          >
            <div className="lucky-icon">🍀</div>
            <h3>Estou com Sorte</h3>
            <p>Descubra vídeos aleatórios</p>
          </div>

          {videoSuggestions.map((suggestion, index) => (
            <div
              key={index}
              className={`suggestion-card ${suggestion.popular ? 'popular' : ''}`}
              onClick={() => handleVideoSuggestionClick(suggestion.term)}
            >
              <span className="suggestion-label">{suggestion.label}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="suggestions-section">
        <h3 className="suggestions-section-title">📺 Sugestões de Canais</h3>
        <div className="suggestions-grid">
          {channelSuggestions.map((suggestion, index) => (
            <div
              key={index}
              className="suggestion-card channel-card"
              onClick={() => handleChannelSuggestionClick(suggestion.term)}
            >
              <span className="suggestion-label">{suggestion.label}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default SuggestedContentPro;

