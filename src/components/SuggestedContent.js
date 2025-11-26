import React from 'react';
import './SuggestedContent.css';

const SuggestedContent = ({ onSearch }) => {
  const suggestions = [
    { term: 'shorts', label: '🎬 Shorts', popular: true },
    { term: 'viral', label: '🔥 Viral', popular: true },
    { term: 'trending', label: '📈 Em Alta', popular: true },
    { term: 'funny shorts', label: '😄 Engraçados' },
    { term: 'cooking shorts', label: '👨‍🍳 Receitas' },
    { term: 'dance shorts', label: '💃 Dança' },
    { term: 'music shorts', label: '🎵 Música' },
    { term: 'gaming shorts', label: '🎮 Games' },
  ];

  const handleSuggestionClick = (term) => {
    if (onSearch) {
      onSearch(term);
    }
  };

  const handleFeelingLucky = () => {
    // Termos aleatórios para "estou com sorte"
    const luckyTerms = [
      'shorts viral',
      'shorts trending',
      'shorts funny',
      'shorts music',
      'shorts dance'
    ];
    const randomTerm = luckyTerms[Math.floor(Math.random() * luckyTerms.length)];
    handleSuggestionClick(randomTerm);
  };

  return (
    <div className="suggested-content">
      <div className="suggested-header">
        <h2>✨ Conteúdo Sugerido</h2>
        <p>Explore shorts populares ou tente sua sorte!</p>
      </div>

      <div className="suggestions-grid">
        <div 
          className="suggestion-card lucky-card"
          onClick={handleFeelingLucky}
        >
          <div className="lucky-icon">🍀</div>
          <h3>Estou com Sorte</h3>
          <p>Descubra vídeos aleatórios</p>
        </div>

        {suggestions.map((suggestion, index) => (
          <div
            key={index}
            className={`suggestion-card ${suggestion.popular ? 'popular' : ''}`}
            onClick={() => handleSuggestionClick(suggestion.term)}
          >
            <span className="suggestion-label">{suggestion.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
};

export default SuggestedContent;

