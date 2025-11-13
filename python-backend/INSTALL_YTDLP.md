# 📥 Guia de Instalação do yt-dlp

O **yt-dlp** é agora o método **prioritário** para downloads de vídeos do YouTube. Ele é mais confiável e atualizado que o pytube.

## 🚀 Instalação Rápida (Recomendado)

### Opção 1: Instalação via pip (Mais Fácil)

```bash
# No diretório python-backend
pip install yt-dlp
```

Ou se estiver usando um ambiente virtual:

```bash
# Ativar o ambiente virtual primeiro
# Windows:
.venv\Scripts\activate
# macOS/Linux:
source .venv/bin/activate

# Depois instalar
pip install yt-dlp
```

### Opção 2: Instalação via requirements.txt

O arquivo `requirements.txt` já foi atualizado com o yt-dlp. Basta executar:

```bash
cd python-backend
pip install -r requirements.txt
```

## ✅ Verificar Instalação

Para verificar se o yt-dlp foi instalado corretamente:

```bash
yt-dlp --version
```

Ou no Python:

```python
import yt_dlp
print(yt_dlp.__version__)
```

## 🔧 Requisito Adicional: ffmpeg (Opcional mas Recomendado)

O **ffmpeg** é necessário para juntar áudio e vídeo de alta qualidade. Sem ele, o yt-dlp ainda funciona, mas pode ter limitações.

### Windows:

1. Baixe de: https://www.gyan.dev/ffmpeg/builds/
2. Baixe: **`ffmpeg-release-essentials.zip`**
3. Extraia e renomeie a pasta para `ffmpeg`
4. Mova para: `C:\ffmpeg\`
5. Adicione `C:\ffmpeg\bin` ao PATH do Windows

### macOS:

```bash
brew install ffmpeg
```

### Linux:

```bash
sudo apt update
sudo apt install ffmpeg
```

## 🎯 Como Funciona Agora

O backend agora tenta downloads nesta ordem:

1. **yt-dlp** (PRIMEIRA PRIORIDADE) - Mais confiável e atualizado
2. **pytube** (FALLBACK) - Usado apenas se yt-dlp falhar

## 🔄 Atualizar o yt-dlp

O yt-dlp é atualizado frequentemente para acompanhar mudanças do YouTube. Para atualizar:

```bash
pip install -U yt-dlp
```

Ou:

```bash
yt-dlp -U
```

## 📝 Notas

- O yt-dlp funciona melhor com ffmpeg instalado
- Se o yt-dlp não estiver disponível, o sistema automaticamente usa pytube
- O backend verifica automaticamente qual método está disponível

## ❓ Problemas Comuns

**Erro: "yt-dlp não está instalado"**
- Execute: `pip install yt-dlp`
- Verifique se está no ambiente virtual correto

**Erro: "ffmpeg not found"**
- Instale o ffmpeg (veja instruções acima)
- O sistema ainda funcionará, mas com qualidade limitada

**Download lento**
- Isso é normal para vídeos grandes
- O yt-dlp está baixando e processando o vídeo

---

✨ **Pronto!** Agora seus downloads devem funcionar muito melhor! 🎬

