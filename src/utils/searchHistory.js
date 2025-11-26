/**
 * Utilitário para gerenciar histórico de pesquisas no localStorage
 */

const SEARCH_HISTORY_KEY = 'youtube_shorts_search_history';
const LAST_SEARCH_KEY = 'youtube_shorts_last_search';
const MAX_HISTORY_ITEMS = 10;

/**
 * Salva a última pesquisa realizada
 */
export const saveLastSearch = (searchTerm, results = null) => {
  try {
    if (!searchTerm || !searchTerm.trim()) return;
    
    const searchData = {
      term: searchTerm.trim(),
      timestamp: Date.now(),
      results: results ? results.slice(0, 20) : null // Limitar a 20 resultados
    };
    
    localStorage.setItem(LAST_SEARCH_KEY, JSON.stringify(searchData));
    
    // Adicionar ao histórico
    const history = getSearchHistory();
    const existingIndex = history.findIndex(item => item.term.toLowerCase() === searchTerm.trim().toLowerCase());
    
    if (existingIndex >= 0) {
      // Remover duplicado
      history.splice(existingIndex, 1);
    }
    
    // Adicionar no início
    history.unshift({
      term: searchTerm.trim(),
      timestamp: Date.now()
    });
    
    // Limitar histórico
    const limited = history.slice(0, MAX_HISTORY_ITEMS);
    localStorage.setItem(SEARCH_HISTORY_KEY, JSON.stringify(limited));
    
    return true;
  } catch (error) {
    console.error('Erro ao salvar última pesquisa:', error);
    return false;
  }
};

/**
 * Obtém a última pesquisa realizada
 */
export const getLastSearch = () => {
  try {
    const stored = localStorage.getItem(LAST_SEARCH_KEY);
    if (!stored) return null;
    
    const searchData = JSON.parse(stored);
    
    // Verificar se a pesquisa é muito antiga (mais de 7 dias)
    const maxAge = 7 * 24 * 60 * 60 * 1000; // 7 dias
    const age = Date.now() - searchData.timestamp;
    
    if (age > maxAge) {
      localStorage.removeItem(LAST_SEARCH_KEY);
      return null;
    }
    
    return searchData;
  } catch (error) {
    console.error('Erro ao ler última pesquisa:', error);
    return null;
  }
};

/**
 * Obtém o histórico de pesquisas
 */
export const getSearchHistory = () => {
  try {
    const stored = localStorage.getItem(SEARCH_HISTORY_KEY);
    if (!stored) return [];
    
    return JSON.parse(stored);
  } catch (error) {
    console.error('Erro ao ler histórico de pesquisas:', error);
    return [];
  }
};

/**
 * Limpa o histórico de pesquisas
 */
export const clearSearchHistory = () => {
  try {
    localStorage.removeItem(SEARCH_HISTORY_KEY);
    localStorage.removeItem(LAST_SEARCH_KEY);
    return true;
  } catch (error) {
    console.error('Erro ao limpar histórico de pesquisas:', error);
    return false;
  }
};

