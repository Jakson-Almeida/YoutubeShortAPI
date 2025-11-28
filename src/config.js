// Em desenvolvimento: usa proxy do package.json (string vazia)
// Em produção no Vercel: usa rewrites do vercel.json (string vazia também)
// Isso permite que as requisições /api/* sejam encaminhadas automaticamente
const API_BASE_URL = '';

export default API_BASE_URL;
