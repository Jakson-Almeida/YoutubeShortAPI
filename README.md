# YouTube Shorts Downloader 🎬

Um website simples e moderno desenvolvido em React para pesquisar, visualizar e baixar vídeos do YouTube Shorts.

## 🚀 Funcionalidades

- 🔍 **Busca de vídeos**: Pesquise vídeos do YouTube Shorts usando a YouTube Data API v3
- 👀 **Visualização**: Assista aos vídeos diretamente no site com player incorporado
- ⬇️ **Download**: Baixe os vídeos que você encontrar (requer configuração adicional)

## 📋 Pré-requisitos

- Node.js (versão 14 ou superior)
- npm ou yarn
- Chave de API do YouTube (Google Cloud Console)
- Python 3.8 ou superior (para o backend de download em Python)

## 🛠️ Instalação

1. **Clone o repositório**:
```bash
git clone https://github.com/Jakson-Almeida/YoutubeShortAPI.git
cd YoutubeShortAPI
```

2. **Instale as dependências**:
```bash
npm install
```

3. **Configure a API Key do YouTube**:

   - Acesse o [Google Cloud Console](https://console.cloud.google.com/)
   - Crie um novo projeto ou selecione um existente
   - Ative a **YouTube Data API v3**
   - Crie credenciais (Chave de API)
   - Copie sua chave de API

4. **Crie um arquivo `.env` na raiz do projeto**:
```env
REACT_APP_YOUTUBE_API_KEY=sua_chave_de_api_aqui
```

## 🎯 Como Usar

1. **Inicie o servidor de desenvolvimento**:
```bash
npm start
```

2. **Acesse o aplicativo**:
   - Abra seu navegador em `http://localhost:3000`

3. **Pesquise vídeos**:
   - Digite um termo de busca na barra de pesquisa
   - Clique no botão de busca ou pressione Enter
   - Os resultados aparecerão abaixo

4. **Visualize um vídeo**:
   - Clique em qualquer card de vídeo
   - O player será aberto em uma modal

5. **Baixe um vídeo**:
   - Com um vídeo aberto, clique no botão "⬇️ Baixar Vídeo"
   - ⚠️ **Nota**: Para downloads funcionarem completamente, você precisará configurar um backend ou usar serviços de terceiros

## 🔧 Backend Python para Downloads

Para habilitar downloads funcionais, foi adicionado um backend em Python que utiliza **yt-dlp** (prioritário) e **pytube** (fallback):

### 🎯 Métodos de Download (em ordem de prioridade):

1. **yt-dlp** (PRIMEIRA PRIORIDADE) - Mais confiável e atualizado, com suporte a +1.800 sites
2. **pytube** (FALLBACK) - Usado automaticamente se yt-dlp falhar

### 📦 Instalação:

1. **Instale as dependências** (recomendado criar um ambiente virtual):
```bash
cd python-backend
# opcional
python -m venv .venv
# Windows
.venv\Scripts\activate
# macOS/Linux
source .venv/bin/activate

pip install -r requirements.txt
```

2. **Inicie o backend**:
```bash
python app.py
```

O servidor rodará na porta `5000`. O frontend já está configurado para apontar para esse backend através da propriedade `proxy` em `package.json`.

### 📚 Documentação Adicional:

- Veja `python-backend/INSTALL_YTDLP.md` para instruções detalhadas sobre o yt-dlp
- Para melhor qualidade de vídeo, instale o **ffmpeg** (veja o guia de instalação)

⚠️ **Importante**:
- O yt-dlp é atualizado frequentemente para acompanhar mudanças do YouTube
- Para produção, considere adicionar autenticação, cache e rate limiting
- O download de vídeos pode violar os Termos de Serviço do YouTube

## 📁 Estrutura do Projeto

```
YoutubeShortAPI/
├── public/
│   └── index.html
├── python-backend/            # Backend em Python (Flask + pytube)
│   ├── app.py
│   └── requirements.txt
├── server/                    # Backend Node (legado/opcional)
├── src/
│   ├── components/
│   │   ├── SearchBar.js
│   │   ├── SearchBar.css
│   │   ├── VideoList.js
│   │   ├── VideoList.css
│   │   ├── VideoCard.js
│   │   ├── VideoCard.css
│   │   ├── VideoPlayer.js
│   │   └── VideoPlayer.css
│   ├── App.js
│   ├── App.css
│   ├── index.js
│   └── index.css
├── package.json
├── .gitignore
└── README.md
```

## 🔧 Tecnologias Utilizadas

- **React** - Biblioteca JavaScript para construção de interfaces
- **YouTube Data API v3** - API oficial do Google para buscar vídeos do YouTube
- **CSS3** - Estilização moderna com gradientes e animações
- **Axios** - Cliente HTTP para requisições (pode ser usado para futuras melhorias)

## ⚠️ Notas Importantes

1. **Limites da API**: A YouTube Data API v3 tem limites de quota. Tenha cuidado com o número de requisições.

2. **Download de Vídeos**: 
   - O download de vídeos do YouTube pode violar os Termos de Serviço do YouTube
   - Utilize o backend em `python-backend/` (Flask + pytube) ou outro serviço de terceiros
   - O frontend oferece links para serviços online alternativos caso o backend não esteja disponível

3. **Filtro de Shorts**: O código filtra vídeos por duração curta, mas isso não garante 100% que sejam Shorts. Você pode melhorar isso usando filtros adicionais da API.

## 🎨 Customização

Você pode personalizar as cores, estilos e layout editando os arquivos CSS em `src/App.css` e nos componentes individuais.

## 📝 Licença

Este projeto é apenas para fins educacionais. Certifique-se de respeitar os Termos de Serviço do YouTube ao usar este aplicativo.

## 🤝 Contribuindo

Sinta-se à vontade para abrir issues ou pull requests com melhorias!

---

Desenvolvido com ❤️ usando React

