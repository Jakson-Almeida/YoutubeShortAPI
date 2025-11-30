# Guia de Configuração de Cookies do YouTube (Anti-Bloqueio)

Se você está vendo erros como "Sign in to confirm you're not a bot" ou "Failed to extract any player response" nos logs do Railway, isso significa que o YouTube bloqueou o endereço IP do servidor (o que é comum em datacenters como AWS/Railway).

A **única** solução definitiva é usar cookies de uma sessão autenticada. Isso faz com que o servidor "finja" ser você acessando o YouTube logado.

## Passo 1: Obter Cookies do seu Navegador

1. Instale a extensão **"Get cookies.txt LOCALLY"** no seu navegador:
   - [Chrome Web Store](https://chrome.google.com/webstore/detail/get-cookiestxt-locally/cclelndahbckbenkjhflccppbcdfclid)
   - [Firefox Add-ons](https://addons.mozilla.org/en-US/firefox/addon/get-cookies-txt-locally/)

2. Acesse [youtube.com](https://www.youtube.com) e faça login com uma conta (pode ser uma conta secundária se preferir).
3. Abra a extensão "Get cookies.txt LOCALLY".
4. Clique em **"Export All Cookies"** ou certifique-se de que está exportando os cookies do domínio youtube.com.
5. Salve o arquivo `cookies.txt` no seu computador.

## Passo 2: Configurar no Railway

Como o arquivo `cookies.txt` contém informações sensíveis e pode mudar, **NÃO** recomendamos comitá-lo no Git. Em vez disso, vamos usar uma Variável de Ambiente.

1. Abra o arquivo `cookies.txt` que você baixou em um editor de texto (Bloco de Notas, VS Code, etc).
2. Copie **TODO** o conteúdo do arquivo.
3. Vá para o painel do **Railway**.
4. Selecione seu projeto e o serviço do backend (Python).
5. Vá na aba **Variables**.
6. Adicione uma nova variável:
   - **Nome:** `YOUTUBE_COOKIES_CONTENT`
   - **Valor:** (Cole todo o conteúdo do arquivo cookies.txt aqui)

## Passo 3: Deploy

O backend já foi atualizado para ler essa variável automaticamente. Assim que você salvar a variável no Railway, ele deve reiniciar o serviço (ou você pode fazer um Redeploy manual).

O sistema irá criar um arquivo temporário com esses cookies e usá-lo para autenticar as requisições do `yt-dlp`, contornando o bloqueio de bot.

## Notas Importantes

- **Validade:** Os cookies expiram eventualmente. Se voltar a dar erro daqui a alguns meses, repita o processo para pegar cookies novos.
- **Segurança:** Não compartilhe o conteúdo do seu `cookies.txt` com ninguém, pois ele dá acesso à sua conta do YouTube.
- **IP:** Se o IP do Railway estiver *muito* queimado, pode ser necessário usar cookies de uma conta com YouTube Premium, mas geralmente uma conta gratuita já resolve.

