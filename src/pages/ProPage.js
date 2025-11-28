import React, { useState, useEffect } from 'react';
import '../App.css';
import AdvancedSearchBar from '../components/AdvancedSearchBar';
import VideoList from '../components/VideoList';
import VideoListPro from '../components/VideoListPro';
import VideoPlayer from '../components/VideoPlayer';
import ChannelList from '../components/ChannelList';
import SuggestedContentPro from '../components/SuggestedContentPro';
import Logo from '../components/Logo';
import { markVideoAsDownloaded } from '../utils/downloadHistory';
import { saveLastSearchPro, getLastSearchPro } from '../utils/searchHistory';
import { useAuth } from '../contexts/AuthContext';
import UserMenu from '../components/UserMenu';

function ProPage() {
  const { user, logout, getAuthHeaders } = useAuth();
  const [videos, setVideos] = useState([]);
  const [channels, setChannels] = useState([]);
  const [selectedVideo, setSelectedVideo] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [currentSearchType, setCurrentSearchType] = useState(null); // 'videos' ou 'channels'
  const [hasSearched, setHasSearched] = useState(false);
  const [advancedOptions, setAdvancedOptions] = useState({
    allowMultipleDownloads: false,
    saveVideo: true,
    saveDescription: false,
    saveLinks: false,
    linkFilter: '',
    hideDownloaded: false // Ocultar vídeos já baixados
  });
  const [downloadingVideos, setDownloadingVideos] = useState(new Set()); // Set de videoIds em download
  const [nextPageToken, setNextPageToken] = useState(null); // Token para próxima página
  const [pageTokenStack, setPageTokenStack] = useState([]); // Stack de tokens para navegação (histórico)
  const [currentSearchParams, setCurrentSearchParams] = useState(null); // Parâmetros da busca atual
  const [currentPage, setCurrentPage] = useState(1); // Página atual (1-indexed)

  const apiKey = process.env.REACT_APP_YOUTUBE_API_KEY;

  useEffect(() => {
    if (!apiKey) {
      setError('API key não configurada. Verifique o arquivo .env');
    }
  }, [apiKey]);

  // Carregar última pesquisa ao montar o componente
  useEffect(() => {
    const lastSearch = getLastSearchPro();
    
    if (lastSearch && lastSearch.results && lastSearch.results.length > 0) {
      if (lastSearch.type === 'videos') {
        setVideos(lastSearch.results);
        setCurrentSearchType('videos');
        setHasSearched(true);
      } else if (lastSearch.type === 'channels') {
        setChannels(lastSearch.results);
        setCurrentSearchType('channels');
        setHasSearched(true);
      }
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const extractChannelId = async (channelUrlOrId) => {
    if (!channelUrlOrId) return null;

    const trimmed = channelUrlOrId.trim();

    // Verificar se já é um channel ID (começa com UC e tem 24 caracteres)
    if (/^UC[a-zA-Z0-9_-]{22}$/.test(trimmed)) {
      return trimmed;
    }

    // Tentar extrair de URL
    const urlPatterns = [
      /(?:https?:\/\/)?(?:www\.)?youtube\.com\/channel\/([a-zA-Z0-9_-]+)/,
      /(?:https?:\/\/)?(?:www\.)?youtube\.com\/@([a-zA-Z0-9_-]+)/,
      /(?:https?:\/\/)?(?:www\.)?youtube\.com\/c\/([a-zA-Z0-9_-]+)/,
      /(?:https?:\/\/)?(?:www\.)?youtube\.com\/user\/([a-zA-Z0-9_-]+)/,
    ];

    for (const pattern of urlPatterns) {
      const match = trimmed.match(pattern);
      if (match) {
        const identifier = match[1];
        
        // Se for URL /channel/UC..., retornar diretamente
        if (identifier.startsWith('UC') && identifier.length === 24) {
          return identifier;
        }
        
        // Se começa com @ ou é um handle, precisa buscar o channel ID
        if (trimmed.includes('/@') || !trimmed.includes('youtube.com')) {
          try {
            // Tentar buscar por handle usando search
            const searchQuery = trimmed.includes('/@') ? identifier : trimmed.replace('@', '');
            const response = await fetch(
              `https://www.googleapis.com/youtube/v3/search?part=snippet&q=${encodeURIComponent(searchQuery)}&type=channel&key=${apiKey}&maxResults=5`
            );
            if (response.ok) {
              const data = await response.json();
              if (data.items && data.items.length > 0) {
                // Procurar correspondência exata pelo customUrl ou title
                for (const item of data.items) {
                  const customUrl = item.snippet.customUrl;
                  const title = item.snippet.title.toLowerCase();
                  const searchLower = searchQuery.toLowerCase();
                  
                  if (customUrl && customUrl.toLowerCase() === `@${searchLower}`) {
                    return item.id.channelId || item.snippet.channelId;
                  }
                  if (title === searchLower || title.includes(searchLower)) {
                    return item.id.channelId || item.snippet.channelId;
                  }
                }
                // Se não encontrou correspondência exata, retornar o primeiro
                return data.items[0].id.channelId || data.items[0].snippet.channelId;
              }
            }
          } catch (err) {
            console.error('Erro ao buscar channel ID:', err);
          }
          return null;
        }
      }
    }

    // Se não parece uma URL, tentar buscar como termo de busca
    if (!trimmed.includes('http') && !trimmed.includes('youtube')) {
      try {
        const response = await fetch(
          `https://www.googleapis.com/youtube/v3/search?part=snippet&q=${encodeURIComponent(trimmed)}&type=channel&key=${apiKey}&maxResults=1`
        );
        if (response.ok) {
          const data = await response.json();
          if (data.items && data.items.length > 0) {
            return data.items[0].id.channelId || data.items[0].snippet.channelId;
          }
        }
      } catch (err) {
        console.error('Erro ao buscar channel ID:', err);
      }
    }

    return null;
  };

  const handleSearchVideos = async ({ query, channelId, orderBy, dateFrom, dateTo, pageToken = null, isNewSearch = false }) => {
    setLoading(true);
    setError(null);
    setSelectedVideo(null);
    setCurrentSearchType('videos');
    setChannels([]);

    // Se é uma nova busca, resetar tokens de paginação
    if (isNewSearch || !pageToken) {
      setNextPageToken(null);
      setPageTokenStack([null]); // Incluir null para primeira página
      setCurrentPage(1);
    }

    if (!apiKey) {
      setError('API key não configurada. Verifique o arquivo .env');
      setLoading(false);
      return;
    }

    try {
      // Se channelId fornecido, primeiro extrair o ID real
      let finalChannelId = null;
      if (channelId) {
        finalChannelId = await extractChannelId(channelId);
        if (!finalChannelId && channelId.trim()) {
          setError('ID do canal inválido. Tente usar a URL completa do canal ou o ID do canal.');
          setLoading(false);
          return;
        }
      }

      // A API do YouTube ordena por 'date' (mais recentes primeiro)
      // Para ordenar por mais antigos, faremos manualmente após receber os resultados
      const orderParam = 'date';
      const orderDirection = orderBy === 'date:asc' ? 'asc' : 'desc';

      // Converter datas para formato ISO 8601 (RFC 3339) requerido pela API
      let publishedAfter = null;
      let publishedBefore = null;
      
      if (dateFrom) {
        // Data início do dia (00:00:00 UTC)
        const dateFromObj = new Date(dateFrom);
        dateFromObj.setHours(0, 0, 0, 0);
        publishedAfter = dateFromObj.toISOString();
      }
      
      if (dateTo) {
        // Data fim do dia (23:59:59 UTC)
        const dateToObj = new Date(dateTo);
        dateToObj.setHours(23, 59, 59, 999);
        publishedBefore = dateToObj.toISOString();
      }

      let url = `https://www.googleapis.com/youtube/v3/search?part=snippet&maxResults=50&type=video&videoDuration=short&order=${orderParam}&key=${apiKey}`;
      
      if (query) {
        url += `&q=${encodeURIComponent(query)}`;
      }
      
      if (finalChannelId) {
        url += `&channelId=${finalChannelId}`;
      }

      // Adicionar filtros de data
      if (publishedAfter) {
        url += `&publishedAfter=${publishedAfter}`;
      }
      
      if (publishedBefore) {
        url += `&publishedBefore=${publishedBefore}`;
      }

      // Adicionar token de paginação se fornecido
      if (pageToken) {
        url += `&pageToken=${pageToken}`;
      }

      const response = await fetch(url);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error?.message || 'Erro ao buscar vídeos. Verifique sua API key.');
      }

      const data = await response.json();
      
      // Ordenar resultados manualmente se necessário
      let items = data.items || [];
      
      if (orderDirection === 'asc') {
        // Ordenar por mais antigos primeiro
        items = [...items].sort((a, b) => {
          const dateA = new Date(a.snippet.publishedAt);
          const dateB = new Date(b.snippet.publishedAt);
          return dateA - dateB; // Crescente (mais antigo primeiro)
        });
      } else {
        // Já vem ordenado por mais recentes, mas vamos garantir
        items = [...items].sort((a, b) => {
          const dateA = new Date(a.snippet.publishedAt);
          const dateB = new Date(b.snippet.publishedAt);
          return dateB - dateA; // Decrescente (mais recente primeiro)
        });
      }
      
      setVideos(items);
      setHasSearched(true);
      
      // Atualizar tokens de paginação
      const newNextPageToken = data.nextPageToken || null;
      setNextPageToken(newNextPageToken);
      
      // Atualizar página atual baseado no estado
      if (isNewSearch || (!pageToken && pageTokenStack.length <= 1)) {
        // Nova busca ou primeira página (stack tem apenas [null])
        setCurrentPage(1);
      } else if (pageToken) {
        // Navegando: a página é baseada no tamanho do stack
        // Stack tem [null, token1, token2, ...], então a página atual é stack.length
        setCurrentPage(pageTokenStack.length);
      }
      
      // Salvar parâmetros da busca atual para navegação
      setCurrentSearchParams({
        query: query || '',
        channelId: finalChannelId || null,
        orderBy: orderBy,
        dateFrom: dateFrom,
        dateTo: dateTo
      });
      
      // Salvar pesquisa de vídeos (apenas para nova busca, sem incluir tokens de paginação)
      if (isNewSearch || !pageToken) {
        saveLastSearchPro({
          type: 'videos',
          query: query || '',
          channelId: finalChannelId || null,
          orderBy: orderBy,
          dateFrom: dateFrom,
          dateTo: dateTo,
          results: items
        });
      }
      
      if (items.length === 0) {
        setError('Nenhum vídeo encontrado neste intervalo de datas. Tente ajustar os filtros de busca.');
      }
    } catch (err) {
      setError(err.message);
      setVideos([]);
      setHasSearched(true);
    } finally {
      setLoading(false);
    }
  };

  const handleSearchChannels = async (query) => {
    setLoading(true);
    setError(null);
    setSelectedVideo(null);
    setCurrentSearchType('channels');
    setVideos([]);

    if (!apiKey) {
      setError('API key não configurada. Verifique o arquivo .env');
      setLoading(false);
      return;
    }

    if (!query || !query.trim()) {
      setError('Digite um termo para buscar canais.');
      setLoading(false);
      return;
    }

    try {
      // Primeiro, buscar canais usando search API
      const searchResponse = await fetch(
        `https://www.googleapis.com/youtube/v3/search?part=snippet&maxResults=50&q=${encodeURIComponent(query)}&type=channel&key=${apiKey}`
      );

      if (!searchResponse.ok) {
        const errorData = await searchResponse.json().catch(() => ({}));
        throw new Error(errorData.error?.message || 'Erro ao buscar canais. Verifique sua API key.');
      }

      const searchData = await searchResponse.json();
      
      if (searchData.items && searchData.items.length > 0) {
        // Extrair IDs dos canais encontrados
        const channelIds = searchData.items
          .map(item => item.id.channelId || item.snippet.channelId)
          .filter(id => id);
        
        // Buscar detalhes completos dos canais (snippet + statistics) para obter thumbnails e estatísticas
        let enrichedChannels = searchData.items;
        
        if (channelIds.length > 0) {
          try {
            const idsParam = channelIds.slice(0, 50).join(','); // API limita a 50
            // Buscar snippet e statistics para poder ordenar por relevância
            const detailsResponse = await fetch(
              `https://www.googleapis.com/youtube/v3/channels?part=snippet,statistics&id=${idsParam}&key=${apiKey}`
            );
            
            if (detailsResponse.ok) {
              const detailsData = await detailsResponse.json();
              
              if (detailsData.items && detailsData.items.length > 0) {
                // Criar mapa de canais por ID
                const channelMap = new Map();
                detailsData.items.forEach(channel => {
                  channelMap.set(channel.id, channel);
                });
                
                // Enriquecer canais originais com dados completos e estatísticas
                enrichedChannels = searchData.items.map(item => {
                  const channelId = item.id.channelId || item.snippet.channelId;
                  const fullChannel = channelMap.get(channelId);
                  
                  if (fullChannel) {
                    // Usar snippet completo do channels.list (tem thumbnails melhores)
                    // e adicionar estatísticas para ordenação
                    return {
                      ...item,
                      snippet: {
                        ...item.snippet,
                        thumbnails: fullChannel.snippet?.thumbnails || item.snippet.thumbnails
                      },
                      statistics: fullChannel.statistics || null
                    };
                  }
                  
                  return item;
                });
                
                // Ordenar canais por relevância: primeiro por número de inscritos, depois por número de vídeos
                enrichedChannels.sort((a, b) => {
                  const statsA = a.statistics;
                  const statsB = b.statistics;
                  
                  // Se um canal não tem estatísticas, colocar no final
                  if (!statsA && !statsB) return 0;
                  if (!statsA) return 1;
                  if (!statsB) return -1;
                  
                  // Converter para números (podem vir como strings)
                  const subscribersA = parseInt(statsA.subscriberCount || '0', 10);
                  const subscribersB = parseInt(statsB.subscriberCount || '0', 10);
                  const videosA = parseInt(statsA.videoCount || '0', 10);
                  const videosB = parseInt(statsB.videoCount || '0', 10);
                  
                  // Primeiro ordenar por número de inscritos (maior primeiro)
                  if (subscribersA !== subscribersB) {
                    return subscribersB - subscribersA;
                  }
                  
                  // Se tiverem o mesmo número de inscritos, ordenar por número de vídeos (maior primeiro)
                  return videosB - videosA;
                });
              }
            }
          } catch (detailsErr) {
            console.warn('Erro ao buscar detalhes dos canais, usando dados básicos:', detailsErr);
            // Continuar com dados da busca original se falhar
          }
        }
        
        setChannels(enrichedChannels);
        setHasSearched(true);
        // Salvar pesquisa de canais
        saveLastSearchPro({
          type: 'channels',
          query: query,
          results: enrichedChannels
        });
      } else {
        setChannels([]);
        setError('Nenhum canal encontrado. Tente outro termo de busca.');
        setHasSearched(true);
      }
    } catch (err) {
      setError(err.message);
      setChannels([]);
      setHasSearched(true);
    } finally {
      setLoading(false);
    }
  };

  const handleVideoSelect = (video) => {
    setSelectedVideo(video);
  };

  const handleChannelSelect = async (channel) => {
    // Quando seleciona um canal, buscar todos os shorts desse canal
    const channelId = channel.id.channelId || channel.snippet.channelId;
    if (channelId) {
      await handleSearchVideos({ 
        query: '', 
        channelId: channelId, 
        orderBy: 'date' 
      });
    }
  };

  const handleNextPage = () => {
    if (nextPageToken && currentSearchParams) {
      // Adicionar o token ao stack ANTES de navegar (para poder voltar depois)
      setPageTokenStack(prev => {
        // Adicionar o token que vamos usar para ir para a próxima página
        if (!prev.includes(nextPageToken)) {
          return [...prev, nextPageToken];
        }
        return prev;
      });
      
      handleSearchVideos({
        ...currentSearchParams,
        pageToken: nextPageToken,
        isNewSearch: false
      });
      // Scroll para o topo após navegar
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const handlePrevPage = () => {
    if (!currentSearchParams) return;
    
    if (pageTokenStack.length > 1) {
      // Temos pelo menos 2 entradas no stack (null + tokens), podemos voltar
      // Remover o último token (da página atual) e usar o penúltimo
      const newStack = [...pageTokenStack];
      newStack.pop(); // Remover token da página atual
      const tokenToUse = newStack[newStack.length - 1]; // Usar penúltimo (pode ser null)
      setPageTokenStack(newStack);
      
      handleSearchVideos({
        ...currentSearchParams,
        pageToken: tokenToUse,
        isNewSearch: false
      });
      
      // Scroll para o topo após navegar
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } else {
      // Stack tem apenas [null], já estamos na primeira página
      // Não fazer nada ou fazer nova busca sem token
      handleSearchVideos({
        ...currentSearchParams,
        pageToken: null,
        isNewSearch: false
      });
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const handleBatchDownload = async (videoIds) => {
    if (!videoIds || videoIds.length === 0) return;

    // Adicionar vídeos ao conjunto de downloads
    setDownloadingVideos(new Set(videoIds));
    setError(null);

    try {
      // Fazer download de cada vídeo individualmente em paralelo
      const downloadPromises = videoIds.map(async (videoId) => {
        try {
          const video = videos.find(v => (v.id.videoId || v.id) === videoId);
          if (!video) {
            throw new Error(`Vídeo ${videoId} não encontrado`);
          }

          // Chamar endpoint de download individual com opções
          const params = new URLSearchParams({
            videoId: videoId,
            quality: 'best',
            saveVideo: advancedOptions.saveVideo ? 'true' : 'false',
            saveDescription: advancedOptions.saveDescription ? 'true' : 'false',
            saveLinks: advancedOptions.saveLinks ? 'true' : 'false',
            linkFilter: advancedOptions.linkFilter || ''
          });

          const headers = getAuthHeaders();
          const response = await fetch(`/api/download-with-metadata?${params.toString()}`, {
            headers: headers
          });
          
          if (!response.ok) {
            if (response.status === 401) {
              throw new Error('Sessão expirada. Faça login novamente.');
            }
            throw new Error(`Erro ao baixar vídeo ${videoId}`);
          }

          // Baixar arquivo (ZIP se tem metadados, MP4 se só vídeo)
          const blob = await response.blob();
          const url = window.URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          
          // Obter nome do arquivo do header
          const contentDisposition = response.headers.get('Content-Disposition');
          let filename = `video_${videoId}.mp4`;
          if (contentDisposition) {
            const match = contentDisposition.match(/filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/);
            if (match && match[1]) {
              filename = match[1].replace(/['"]/g, '');
            }
          }
          
          a.download = filename;
          document.body.appendChild(a);
          a.click();
          window.URL.revokeObjectURL(url);
          document.body.removeChild(a);

          // Marcar vídeo como baixado no localStorage
          if (video) {
            markVideoAsDownloaded(videoId, {
              title: video.snippet.title,
              channelTitle: video.snippet.channelTitle,
              thumbnail: video.snippet.thumbnails.medium?.url || video.snippet.thumbnails.default?.url,
              quality: 'best'
            });
            
            // Disparar evento para atualizar cards
            window.dispatchEvent(new CustomEvent('videoDownloaded', { 
              detail: { videoId } 
            }));
          }

          return { videoId, success: true };
        } catch (err) {
          console.error(`Erro ao baixar vídeo ${videoId}:`, err);
          return { videoId, success: false, error: err.message };
        }
      });

      // Aguardar todos os downloads (paralelos)
      const results = await Promise.all(downloadPromises);
      
      // Verificar se houve erros
      const errors = results.filter(r => !r.success);
      if (errors.length > 0) {
        console.warn(`${errors.length} vídeo(s) falharam ao baixar:`, errors);
        setError(`${errors.length} de ${videoIds.length} vídeo(s) falharam ao baixar. Verifique o console para detalhes.`);
      }

    } catch (err) {
      setError(`Erro durante downloads: ${err.message}`);
    } finally {
      // Remover vídeos do conjunto de downloads
      setDownloadingVideos(new Set());
    }
  };

  return (
    <div className="App">
      <header className="app-header">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
            <Logo size="medium" showText={false} />
            <div>
              <h1 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '10px' }}>
                <span>⭐ YouTube Shorts Pro</span>
              </h1>
              <p style={{ margin: '5px 0 0 0' }}>Busca avançada e navegação de Shorts</p>
            </div>
          </div>
          <UserMenu 
            user={user} 
            logout={logout} 
            currentPage="pro"
            // ProPage é protegida, então onLogin/onRegister teoricamente não seriam usados aqui
            // se o usuário não estiver logado, mas vamos passar null ou funções vazias
            onLogin={() => {}}
            onRegister={() => {}}
          />
        </div>
      </header>

      <div className="app-container">
        <AdvancedSearchBar 
          onSearch={handleSearchVideos}
          onSearchChannels={handleSearchChannels}
          loading={loading}
          advancedOptions={advancedOptions}
          onAdvancedOptionsChange={setAdvancedOptions}
        />

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
            <p>Buscando...</p>
          </div>
        ) : (
          <>
            {currentSearchType === 'channels' && channels.length > 0 && (
              <ChannelList 
                channels={channels}
                onChannelSelect={handleChannelSelect}
              />
            )}
            
            {currentSearchType === 'videos' && videos.length > 0 && (
              advancedOptions.allowMultipleDownloads ? (
                <VideoListPro
                  videos={videos}
                  onVideoSelect={handleVideoSelect}
                  selectedVideo={selectedVideo}
                  selectable={true}
                  onBatchDownload={handleBatchDownload}
                  downloadingVideos={downloadingVideos}
                  hideDownloaded={advancedOptions.hideDownloaded || false}
                  pagination={{
                    hasNextPage: !!nextPageToken,
                    hasPrevPage: pageTokenStack.length > 0 || currentPage > 1,
                    onNextPage: handleNextPage,
                    onPrevPage: handlePrevPage,
                    currentPage: currentPage
                  }}
                />
              ) : (
                <VideoList
                  videos={videos}
                  onVideoSelect={handleVideoSelect}
                  selectedVideo={selectedVideo}
                />
              )
            )}

            {!hasSearched && !loading && (
              <SuggestedContentPro 
                onSearchVideos={handleSearchVideos}
                onSearchChannels={handleSearchChannels}
              />
            )}
          </>
        )}
      </div>
    </div>
  );
}

export default ProPage;

