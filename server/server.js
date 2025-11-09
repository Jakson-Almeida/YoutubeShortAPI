// Servidor backend opcional para downloads
// NOTA: Este é um exemplo básico. Para produção, adicione autenticação, rate limiting, etc.
// AVISO: O download de vídeos do YouTube pode violar os Termos de Serviço

const express = require('express');
const cors = require('cors');
const ytdl = require('ytdl-core');

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

// Rota para download de vídeos
app.get('/api/download', async (req, res) => {
  try {
    const { videoId } = req.query;

    if (!videoId) {
      return res.status(400).json({ error: 'ID do vídeo não fornecido' });
    }

    const videoUrl = `https://www.youtube.com/watch?v=${videoId}`;
    
    // Verificar se o vídeo é válido
    const info = await ytdl.getInfo(videoUrl);
    
    // Configurar headers para download
    res.setHeader('Content-Disposition', `attachment; filename="video_${videoId}.mp4"`);
    res.setHeader('Content-Type', 'video/mp4');

    // Stream do vídeo
    ytdl(videoUrl, {
      quality: 'highest',
      filter: 'audioandvideo'
    }).pipe(res);

  } catch (error) {
    console.error('Erro ao baixar vídeo:', error);
    res.status(500).json({ 
      error: 'Erro ao baixar vídeo',
      message: error.message 
    });
  }
});

// Rota de health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', message: 'Servidor backend está rodando' });
});

app.listen(PORT, () => {
  console.log(`🚀 Servidor backend rodando na porta ${PORT}`);
  console.log(`📝 Para usar, configure o proxy no package.json do frontend`);
});



