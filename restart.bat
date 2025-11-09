@echo off
echo Parando servidores Node...
taskkill /F /IM node.exe 2>nul
timeout /t 2 /nobreak >nul
echo Iniciando servidor...
start "React Server" cmd /k npm start
echo Servidor iniciado! Aguarde alguns segundos e recarregue a pagina no navegador.



