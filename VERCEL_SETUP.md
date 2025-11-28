# 🚀 Guia de Configuração do Vercel

Este guia mostra como fazer o deploy do frontend React no Vercel e conectá-lo ao backend no Railway.

## 📋 Pré-requisitos

- Conta no [Vercel](https://vercel.com)
- Backend já deployado no Railway (veja a URL pública do seu serviço)
- Repositório no GitHub

## 🔧 Passo 1: Obter a URL do Backend no Railway

1. Acesse o [Railway Dashboard](https://railway.app)
2. Clique no seu projeto
3. Clique no serviço do backend (`YoutubeShortAPI`)
4. Vá para a aba **Settings**
5. Na seção **Networking**, encontre o **Public Domain** ou **Custom Domain**
6. Copie a URL (exemplo: `https://youtube-shorts-api-production.up.railway.app`)

## 📝 Passo 2: Atualizar o vercel.json

1. Abra o arquivo `vercel.json` na raiz do projeto
2. Substitua `YOUR-RAILWAY-BACKEND-URL` pela URL do seu backend no Railway:

```json
{
  "rewrites": [
    {
      "source": "/api/(.*)",
      "destination": "https://SEU-BACKEND.up.railway.app/api/$1"
    },
    {
      "source": "/(.*)",
      "destination": "/index.html"
    }
  ]
}
```

## 🔑 Passo 3: Configurar Variáveis de Ambiente no Vercel

1. Acesse o [Vercel Dashboard](https://vercel.com/dashboard)
2. Clique em **Add New Project** ou selecione seu projeto existente
3. Conecte seu repositório do GitHub
4. Nas configurações do projeto, vá para **Settings** > **Environment Variables**
5. Adicione a seguinte variável:

   - **Name:** `REACT_APP_YOUTUBE_API_KEY`
   - **Value:** Sua chave da API do YouTube
   - **Environment:** Production, Preview, Development (marque todos)

## 🚀 Passo 4: Fazer Deploy

### Opção 1: Via GitHub (Recomendado)

1. Commit e push das alterações para o GitHub
2. O Vercel detectará automaticamente e fará o deploy

### Opção 2: Via CLI do Vercel

1. Instale a CLI do Vercel:
   ```bash
   npm i -g vercel
   ```

2. Faça login:
   ```bash
   vercel login
   ```

3. Execute o deploy:
   ```bash
   vercel
   ```

4. Para produção:
   ```bash
   vercel --prod
   ```

## ✅ Passo 5: Verificar o Deploy

Após o deploy:

1. Acesse a URL fornecida pelo Vercel (exemplo: `https://seu-projeto.vercel.app`)
2. Teste a funcionalidade de busca
3. Teste o login/registro
4. Teste o download de vídeos

## 🔍 Troubleshooting

### Erro 404 nas rotas
- Verifique se o `vercel.json` tem o rewrite para `/(.*)` → `/index.html`
- Isso é necessário para o React Router funcionar

### Erro de CORS nas requisições de API
- Verifique se a URL no `vercel.json` está correta
- Verifique se o backend no Railway está acessível publicamente

### Variáveis de ambiente não funcionam
- Certifique-se de que as variáveis começam com `REACT_APP_`
- Após adicionar variáveis, faça um novo deploy

### Backend não responde
- Verifique se o backend no Railway está rodando
- Verifique a URL no `vercel.json`
- Teste a URL diretamente no navegador: `https://SEU-BACKEND.up.railway.app/api/health`

## 📚 Recursos

- [Documentação do Vercel](https://vercel.com/docs)
- [React Router no Vercel](https://vercel.com/guides/deploying-react-with-vercel)
- [Rewrites do Vercel](https://vercel.com/docs/concepts/projects/project-configuration#rewrites)

