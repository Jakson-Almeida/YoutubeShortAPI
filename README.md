# YouTube Shorts Downloader 🎬

Aplicação web para pesquisar, visualizar e baixar vídeos do YouTube Shorts.

## 🚀 Funcionalidades

- 🔍 Busca de vídeos do YouTube Shorts
- 👀 Visualização com player incorporado
- ⬇️ Download de vídeos em múltiplas qualidades
- 👤 Sistema de autenticação e histórico de downloads

## 🏗️ Arquitetura

- **Frontend**: React (Vercel)
- **Backend**: Python Flask (Railway)
- **Download**: yt-dlp (prioritário) + pytube (fallback)

## ⚙️ Configuração de Produção

### Variáveis de Ambiente

#### Frontend (Vercel)
- `REACT_APP_YOUTUBE_API_KEY` - Chave da YouTube Data API v3
- `REACT_APP_API_URL` - URL do backend (ex: `https://seu-backend.railway.app`)

#### Backend (Railway)
- `YOUTUBE_COOKIES_CONTENT` - Cookies do YouTube (Netscape format) - **ESSENCIAL para downloads**
- `JWT_SECRET_KEY` - Chave secreta para JWT
- `DATABASE_URL` - URL do banco de dados (PostgreSQL recomendado)

### Configuração de Cookies

Para evitar bloqueios do YouTube, configure cookies:

1. Exporte cookies do navegador usando extensão "Get cookies.txt LOCALLY"
2. Configure `YOUTUBE_COOKIES_CONTENT` no Railway com o conteúdo completo do arquivo
3. Veja [GUIA_COOKIES.md](GUIA_COOKIES.md) para instruções detalhadas

## 📦 Deploy

### Backend (Railway)
1. Conecte o repositório ao Railway
2. Configure as variáveis de ambiente
3. O deploy é automático via `Procfile`

### Frontend (Vercel)
1. Conecte o repositório ao Vercel
2. Configure as variáveis de ambiente
3. O build é automático via `vercel.json`

## 🛠️ Desenvolvimento Local

```bash
# Frontend
npm install
npm start

# Backend
cd python-backend
python -m venv .venv
source .venv/bin/activate  # Windows: .venv\Scripts\activate
pip install -r requirements.txt
python app.py
```

## 📚 Documentação

- [GUIA_COOKIES.md](GUIA_COOKIES.md) - Configuração de cookies
- [DEPLOYMENT_CHECKLIST.md](DEPLOYMENT_CHECKLIST.md) - Checklist de deploy
- [QUICK_START.md](QUICK_START.md) - Guia rápido de instalação

## ⚠️ Importante

- Downloads podem violar os Termos de Serviço do YouTube
- Configure cookies para reduzir bloqueios em produção
- YouTube Data API v3 tem limites de quota

---

Desenvolvido com ❤️ usando React e Python
