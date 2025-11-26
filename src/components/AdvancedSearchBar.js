import React, { useState } from 'react';
import './AdvancedSearchBar.css';

const AdvancedSearchBar = ({ 
  onSearch, 
  onSearchChannels, 
  loading,
  advancedOptions = {},
  onAdvancedOptionsChange 
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [channelId, setChannelId] = useState('');
  const [searchType, setSearchType] = useState('videos'); // 'videos' ou 'channels'
  const [orderBy, setOrderBy] = useState('date'); // 'date' (recentes) ou 'date:asc' (antigos)
  const [showAdvanced, setShowAdvanced] = useState(false);

  const extractChannelIdFromUrl = (url) => {
    if (!url) return '';
    
    // Extrair channel ID de diferentes formatos de URL
    const patterns = [
      /youtube\.com\/channel\/([a-zA-Z0-9_-]+)/,
      /youtube\.com\/@([a-zA-Z0-9_-]+)/,
      /youtube\.com\/c\/([a-zA-Z0-9_-]+)/,
      /youtube\.com\/user\/([a-zA-Z0-9_-]+)/,
    ];
    
    for (const pattern of patterns) {
      const match = url.match(pattern);
      if (match) {
        return match[1];
      }
    }
    
    // Se não parece uma URL, pode ser um ID direto
    if (/^[a-zA-Z0-9_-]+$/.test(url)) {
      return url;
    }
    
    return '';
  };

  const handleChannelIdChange = (value) => {
    // Tentar extrair channel ID se for uma URL
    const extracted = extractChannelIdFromUrl(value);
    setChannelId(extracted || value);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!searchTerm.trim() && !channelId.trim()) {
      return;
    }

    if (searchType === 'channels') {
      // Buscar canais
      if (onSearchChannels) {
        onSearchChannels(searchTerm.trim());
      }
    } else {
      // Buscar vídeos (shorts)
      if (onSearch) {
        onSearch({
          query: searchTerm.trim(),
          channelId: channelId.trim() || null,
          orderBy: orderBy
        });
      }
    }
  };

  return (
    <div className="advanced-search-bar-container">
      <form onSubmit={handleSubmit} className="advanced-search-form">
        <div className="search-type-selector">
          <label>
            <input
              type="radio"
              name="searchType"
              value="videos"
              checked={searchType === 'videos'}
              onChange={(e) => setSearchType(e.target.value)}
              disabled={loading}
            />
            <span>Vídeos Shorts</span>
          </label>
          <label>
            <input
              type="radio"
              name="searchType"
              value="channels"
              checked={searchType === 'channels'}
              onChange={(e) => setSearchType(e.target.value)}
              disabled={loading}
            />
            <span>Canais</span>
          </label>
        </div>

        <div className="search-inputs">
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder={searchType === 'channels' ? 'Buscar canais por nome...' : 'Buscar shorts por termo...'}
            className="advanced-search-input"
            disabled={loading}
          />
          
          {searchType === 'videos' && (
            <input
              type="text"
              value={channelId}
              onChange={(e) => handleChannelIdChange(e.target.value)}
              placeholder="ID ou URL do canal (opcional)"
              className="advanced-search-input channel-input"
              disabled={loading}
            />
          )}

          {searchType === 'videos' && (
            <select
              value={orderBy}
              onChange={(e) => setOrderBy(e.target.value)}
              className="advanced-search-select"
              disabled={loading}
            >
              <option value="date">Mais recentes</option>
              <option value="date:asc">Mais antigos</option>
            </select>
          )}
        </div>

        <button 
          type="submit" 
          className="advanced-search-button"
          disabled={loading || (!searchTerm.trim() && !channelId.trim())}
        >
          {loading ? '⏳' : '🔍'} Buscar
        </button>

        {searchType === 'videos' && (
          <div className="advanced-options-section">
            <button
              type="button"
              className="advanced-toggle-button"
              onClick={() => setShowAdvanced(!showAdvanced)}
            >
              <span>⚙️ Opções Avançadas</span>
              <span className={`toggle-arrow ${showAdvanced ? 'open' : ''}`}>▼</span>
            </button>

            {showAdvanced && (
              <div className="advanced-options-content">
                <div className="option-group">
                  <label className="checkbox-label">
                    <input
                      type="checkbox"
                      checked={advancedOptions.allowMultipleDownloads || false}
                      onChange={(e) => onAdvancedOptionsChange?.({ 
                        ...advancedOptions, 
                        allowMultipleDownloads: e.target.checked 
                      })}
                      disabled={loading}
                    />
                    <span>Permitir múltiplos downloads</span>
                  </label>
                </div>

                {advancedOptions.allowMultipleDownloads && (
                  <>
                    <div className="option-group">
                      <label className="checkbox-label">
                        <input
                          type="checkbox"
                          checked={advancedOptions.saveVideo !== false}
                          onChange={(e) => onAdvancedOptionsChange?.({ 
                            ...advancedOptions, 
                            saveVideo: e.target.checked 
                          })}
                          disabled={loading}
                        />
                        <span>Salvar vídeo</span>
                      </label>
                    </div>

                    <div className="option-group">
                      <label className="checkbox-label">
                        <input
                          type="checkbox"
                          checked={advancedOptions.saveDescription || false}
                          onChange={(e) => onAdvancedOptionsChange?.({ 
                            ...advancedOptions, 
                            saveDescription: e.target.checked 
                          })}
                          disabled={loading}
                        />
                        <span>Salvar descrição</span>
                      </label>
                    </div>

                    <div className="option-group">
                      <label className="checkbox-label">
                        <input
                          type="checkbox"
                          checked={advancedOptions.saveLinks || false}
                          onChange={(e) => onAdvancedOptionsChange?.({ 
                            ...advancedOptions, 
                            saveLinks: e.target.checked 
                          })}
                          disabled={loading}
                        />
                        <span>Salvar links</span>
                      </label>
                    </div>

                    {advancedOptions.saveLinks && (
                      <div className="option-group">
                        <label className="input-label">
                          Filtrar links por termo (opcional):
                          <input
                            type="text"
                            value={advancedOptions.linkFilter || ''}
                            onChange={(e) => onAdvancedOptionsChange?.({ 
                              ...advancedOptions, 
                              linkFilter: e.target.value 
                            })}
                            placeholder="Ex: shopee, amazon, amzn.to"
                            className="filter-input"
                            disabled={loading}
                          />
                          <small>URLs devem conter este termo para serem incluídas</small>
                        </label>
                      </div>
                    )}
                  </>
                )}
              </div>
            )}
          </div>
        )}
      </form>
    </div>
  );
};

export default AdvancedSearchBar;

