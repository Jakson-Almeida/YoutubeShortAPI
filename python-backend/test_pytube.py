from pytube import YouTube

url = 'https://youtu.be/2lAe1cqCOXo'
print('Usando pytube versao:', YouTube.__module__)
try:
    yt = YouTube(url, use_oauth=False, allow_oauth_cache=False)
    print('Titulo:', yt.title)
    stream = yt.streams.filter(progressive=True, file_extension='mp4').order_by('resolution').desc().first()
    print('Stream selecionada:', stream)
    stream.download(output_path='.', filename='sample_test.mp4')
    print('Download concluido sem OAuth')
except Exception as exc:
    print('Falha no modo sem OAuth:', exc)
    print('Tentando com OAuth (sera necessario autorizar uma vez)')
    yt = YouTube(url, use_oauth=True, allow_oauth_cache=True)
    stream = yt.streams.filter(progressive=True, file_extension='mp4').order_by('resolution').desc().first()
    print('Stream selecionada com OAuth:', stream)
    stream.download(output_path='.', filename='sample_test.mp4')
    print('Download concluido com OAuth')
