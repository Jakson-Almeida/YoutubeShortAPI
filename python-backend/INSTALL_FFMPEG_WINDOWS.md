# 📥 Guia de Instalação do ffmpeg no Windows

O **ffmpeg** é necessário para juntar áudio e vídeo de alta qualidade. Sem ele, o yt-dlp ainda funciona, mas pode ter limitações.

## ⚠️ IMPORTANTE: Baixe a Versão Correta!

Você precisa baixar os **BINÁRIOS COMPILADOS** (executáveis prontos), não o código-fonte.

## 🚀 Passo a Passo (Windows)

### 1. Baixar o ffmpeg

1. Acesse: **https://www.gyan.dev/ffmpeg/builds/**
2. Procure pela seção **"release builds"**
3. Baixe o arquivo: **`ffmpeg-release-essentials.zip`**
   - ⚠️ **NÃO baixe** o "ffmpeg-release-full.zip" (muito grande)
   - ⚠️ **NÃO baixe** o código-fonte do GitHub

### 2. Extrair o Arquivo

1. Extraia o arquivo `ffmpeg-release-essentials.zip`
2. Dentro da pasta extraída, você encontrará uma pasta chamada `ffmpeg-X.X.X-essentials_build`
3. Dentro dessa pasta, haverá uma pasta `bin` com os executáveis

### 3. Mover para Local Permanente

1. **Mova a pasta `bin`** para `C:\ffmpeg\bin`
   - Ou mova toda a pasta `ffmpeg-X.X.X-essentials_build` para `C:\ffmpeg`
   - O importante é que o caminho final seja: `C:\ffmpeg\bin\ffmpeg.exe`

### 4. Verificar a Estrutura

Após mover, você deve ter:
```
C:\ffmpeg\
  └── bin\
      ├── ffmpeg.exe
      ├── ffplay.exe
      └── ffprobe.exe
```

### 5. Adicionar ao PATH do Windows

#### Método 1: Via Interface Gráfica (Recomendado)

1. Pressione `Win + S` e digite: **"Variáveis de ambiente"**
2. Clique em **"Editar as variáveis de ambiente do sistema"**
3. Na seção **"Variáveis do sistema"**, encontre e selecione **`Path`**
4. Clique em **"Editar"**
5. Clique em **"Novo"**
6. Adicione: `C:\ffmpeg\bin`
7. Clique em **"OK"** em todas as janelas
8. **Feche e reabra** o terminal/PowerShell para aplicar as mudanças

#### Método 2: Via PowerShell (Como Administrador)

```powershell
# Execute o PowerShell como Administrador
[Environment]::SetEnvironmentVariable("Path", $env:Path + ";C:\ffmpeg\bin", [EnvironmentVariableTarget]::Machine)
```

### 6. Verificar Instalação

Abra um **novo** terminal/PowerShell e execute:

```cmd
ffmpeg -version
```

Se aparecer informações sobre a versão do ffmpeg, **funcionou!** ✅

## 🔍 Verificar se Está Funcionando

Execute no terminal:

```cmd
ffmpeg -version
ffplay -version
ffprobe -version
```

Todos devem mostrar informações de versão.

## ❓ Problemas Comuns

**Erro: "ffmpeg não é reconhecido como comando"**
- Verifique se adicionou `C:\ffmpeg\bin` ao PATH (não `C:\ffmpeg`)
- Feche e reabra o terminal após adicionar ao PATH
- Verifique se o arquivo `ffmpeg.exe` existe em `C:\ffmpeg\bin\`

**Não encontro a pasta bin/**
- Você baixou o código-fonte ao invés dos binários
- Baixe o `ffmpeg-release-essentials.zip` do site gyan.dev

**O yt-dlp ainda não encontra o ffmpeg**
- Reinicie o terminal/PowerShell
- Reinicie o backend Python após instalar o ffmpeg
- Verifique se o PATH está correto: `echo %PATH%` (deve conter `C:\ffmpeg\bin`)

## 📝 Nota

- O ffmpeg não é obrigatório, mas melhora muito a qualidade dos downloads
- Sem ffmpeg, o yt-dlp pode baixar vídeos, mas pode ter limitações em alguns formatos
- O yt-dlp tentará usar o ffmpeg automaticamente se estiver no PATH

---

✨ **Pronto!** Agora o ffmpeg está instalado e pronto para uso! 🎬

