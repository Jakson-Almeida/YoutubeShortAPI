# ✅ Checklist de Deploy Completo

## 🔵 Parte 1: Railway (Backend) - JÁ CONCLUÍDO ✓

- [x] Backend deployado no Railway
- [x] Root Directory configurado: `python-backend`
- [x] Procfile criado e configurado com gunicorn
- [x] JWT_SECRET_KEY configurada como variável de ambiente
- [x] Gunicorn rodando como servidor de produção

### 📍 Próximos Passos no Railway:

1. **Habilitar Public Networking:**
   - Vá para Settings do serviço no Railway
   - Seção "Networking" > "Public Networking"
   - Ative o toggle para habilitar acesso público
   - Anote a URL gerada (exemplo: `https://youtube-shorts-api-production-xxxx.up.railway.app`)

2. **Copiar a URL do Backend:**
   - A URL será algo como: `https://SEU-SERVICO.up.railway.app`
   - Você precisará desta URL para configurar o Vercel

---

## 🟢 Parte 2: Vercel (Frontend) - PRÓXIMOS PASSOS

### Passo 1: Obter URL do Backend no Railway

1. Acesse: https://railway.com/project/36754960-30c8-4477-a01d-65c1cd972a41/service/ef012523-4216-4d29-a1cc-7d634f3afbf1/settings
2. Role até a seção **"Networking"**
3. Na seção **"Public Networking"**, verifique se está ativado
4. Se não estiver, ative o toggle
5. Anote a URL gerada (exemplo: `https://youtube-shorts-api-xxxx.up.railway.app`)

### Passo 2: Atualizar vercel.json

1. Abra o arquivo `vercel.json` na raiz do projeto
2. Substitua `YOUR-RAILWAY-BACKEND-URL` pela URL do seu backend:

```json
{
  "rewrites": [
    {
      "source": "/api/(.*)",
      "destination": "https://SUA-URL-RAILWAY.up.railway.app/api/$1"
    },
    {
      "source": "/(.*)",
      "destination": "/index.html"
    }
  ]
}
```

3. Commit e push:
   ```bash
   git add vercel.json
   git commit -m "fix: Update vercel.json with Railway backend URL"
   git push origin main
   ```

### Passo 3: Criar Projeto no Vercel

1. Acesse: https://vercel.com/dashboard
2. Clique em **"Add New Project"**
3. Conecte seu repositório GitHub: `Jakson-Almeida/YoutubeShortAPI`
4. Configure o projeto:
   - **Framework Preset:** Create React App
   - **Root Directory:** `.` (raiz do projeto)
   - **Build Command:** `npm run build`
   - **Output Directory:** `build`

### Passo 4: Configurar Variáveis de Ambiente no Vercel

1. No projeto do Vercel, vá para **Settings** > **Environment Variables**
2. Adicione a variável:
   - **Name:** `REACT_APP_YOUTUBE_API_KEY`
   - **Value:** Sua chave da API do YouTube
   - **Environment:** Marque Production, Preview e Development

### Passo 5: Fazer Deploy

1. Clique em **"Deploy"**
2. Aguarde o deploy finalizar
3. Acesse a URL fornecida pelo Vercel (exemplo: `https://youtube-shorts-api.vercel.app`)

### Passo 6: Testar

1. ✅ Verifique se a página inicial carrega
2. ✅ Teste a busca de vídeos
3. ✅ Teste o login/registro
4. ✅ Teste o download de vídeos

---

## 🔍 Troubleshooting

### Backend não está acessível publicamente
- Verifique se o Public Networking está ativado no Railway
- Verifique se o serviço está rodando (Active)

### Erro 404 nas rotas do React
- Verifique se o `vercel.json` tem o rewrite para `/(.*)` → `/index.html`

### Erro de CORS
- Verifique se a URL no `vercel.json` está correta
- O Vercel faz proxy das requisições, então não deve haver erro de CORS

### Variáveis de ambiente não funcionam
- Certifique-se de que começam com `REACT_APP_`
- Faça um novo deploy após adicionar variáveis

---

## 📚 Recursos

- [Guia Completo do Vercel](VERCEL_SETUP.md)
- [Documentação do Railway](https://docs.railway.app)
- [Documentação do Vercel](https://vercel.com/docs)

