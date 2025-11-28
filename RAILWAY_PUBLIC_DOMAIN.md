# 🌐 Como Gerar Domínio Público no Railway

## Passo a Passo:

1. **Acesse as Settings do seu serviço no Railway:**
   - Vá para: https://railway.com/project/36754960-30c8-4477-a01d-65c1cd972a41/service/ef012523-4216-4d29-a1cc-7d634f3afbf1/settings

2. **Role até a seção "Networking"**

3. **Na seção "Public Networking":**
   - Clique no botão **"Generate Domain"** (com ícone de raio ⚡)
   - O Railway gerará automaticamente uma URL pública

4. **Anote a URL gerada:**
   - Formato: `https://youtube-shorts-api-xxxx.up.railway.app`
   - Essa URL será usada para configurar o Vercel

5. **Após gerar o domínio:**
   - Você verá a URL pública exibida na seção
   - Pode testar acessando: `https://SUA-URL.up.railway.app/api/health`

## ⚠️ Importante:

- O domínio público é **gratuito** e gerado automaticamente
- Você também pode configurar um domínio personalizado depois, se desejar
- Mantenha essa URL segura e não a compartilhe publicamente

## 📝 Próximo Passo:

Após obter a URL, atualize o arquivo `vercel.json` substituindo `YOUR-RAILWAY-BACKEND-URL` pela URL gerada.

