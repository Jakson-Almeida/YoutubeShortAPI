# 🚀 Guia Rápido - Como Rodar o Projeto

## ✅ Passo 1: Instalar Dependências (JÁ FEITO!)
As dependências já foram instaladas com sucesso! ✓

## 🔑 Passo 2: Obter Chave da API do YouTube

1. **Acesse o Google Cloud Console:**
   - Vá para: https://console.cloud.google.com/
   - Faça login com sua conta Google

2. **Crie ou selecione um projeto:**
   - Clique no seletor de projetos no topo
   - Clique em "NOVO PROJETO"
   - Dê um nome (ex: "youtube-shorts-api")
   - Clique em "CRIAR"

3. **Ative a YouTube Data API v3:**
   - No menu lateral, vá em "APIs e serviços" > "Biblioteca"
   - Procure por "YouTube Data API v3"
   - Clique e depois em "ATIVAR"

4. **Crie uma Chave de API:**
   - Vá em "APIs e serviços" > "Credenciais"
   - Clique em "CRIAR CREDENCIAIS" > "Chave de API"
   - Copie a chave gerada (exemplo: AIzaSyA1B2C3D4E5F6G7H8I9J0K1L2M3N4O5P6Q)

## 📝 Passo 3: Configurar o arquivo .env

1. Na raiz do projeto, crie um arquivo chamado `.env`
2. Adicione a seguinte linha (substitua pela sua chave):

```
REACT_APP_YOUTUBE_API_KEY=SUA_CHAVE_AQUI
```

**Exemplo:**
```
REACT_APP_YOUTUBE_API_KEY=AIzaSyA1B2C3D4E5F6G7H8I9J0K1L2M3N4O5P6Q
```

⚠️ **Importante:** Não compartilhe sua chave de API publicamente!

## ▶️ Passo 4: Iniciar o Projeto

Abra um terminal na pasta do projeto e execute:

```bash
npm start
```

O projeto será aberto automaticamente no navegador em `http://localhost:3000`

## 🎯 Como Usar

1. **Pesquisar:** Digite um termo na barra de pesquisa e pressione Enter
2. **Visualizar:** Clique em qualquer vídeo para assistir
3. **Baixar:** (Opcional) Com o backend configurado, você pode baixar vídeos

## 🔧 Backend Python (Downloads)

Se quiser habilitar downloads com pytube:

```bash
# Em outro terminal, navegue até a pasta python-backend
cd python-backend

# (opcional) criar ambiente virtual
python -m venv .venv
.venv\Scripts\activate # Windows
# source .venv/bin/activate # macOS/Linux

pip install -r requirements.txt
python app.py
```

O backend rodará na porta 5000.

## ❓ Problemas Comuns

**Erro: "REACT_APP_YOUTUBE_API_KEY is not defined"**
- Verifique se criou o arquivo `.env` na raiz do projeto
- Certifique-se que o nome da variável está correto (com REACT_APP_ no início)
- Reinicie o servidor (`npm start`) após criar/editar o `.env`

**Erro: "API key not valid"**
- Verifique se copiou a chave corretamente
- Certifique-se que ativou a YouTube Data API v3 no Google Cloud Console

**Nenhum vídeo aparece:**
- Verifique sua conexão com a internet
- Confirme que a API key está configurada corretamente
- Tente pesquisar termos mais genéricos primeiro

---

✨ Pronto! Agora é só começar a usar! 🎬



