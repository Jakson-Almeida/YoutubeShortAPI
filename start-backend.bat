@echo off
REM Inicializa o backend Python baseado em Flask + pytube
cd python-backend
echo ============================================
echo Backend Python (Flask + pytube)
echo Porta padrao: 5000
echo ============================================
echo.
echo Certifique-se de ter executado:
echo    pip install -r requirements.txt
echo (de preferência dentro de um ambiente virtual)
echo.
python app.py
pause

