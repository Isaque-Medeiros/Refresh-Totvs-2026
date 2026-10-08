@echo off
:: ============================================================================
:: PROJETO FIELD TOTVS REFRESH 2026 - LAUNCHER DE ALTA DISPONIBILIDADE
:: Executa a aplicacao local no Microsoft Edge, Google Chrome ou Navegador Padrao
::
:: MODO PDF SILENCIOSO:
:: As flags --kiosk-printing e --disable-print-preview fazem o window.print()
:: do sistema sair DIRETO, sem abrir o dialogo de impressao e sem cabecalho,
:: rodape ou margem do navegador (equivalente ao "Windows + P" automatico).
:: Configure o impressor padrao como "Microsoft Print to PDF" para baixar o
:: PDF do relatorio automaticamente.
:: ============================================================================

title TOTVS Refresh 2026 - Bancada Field
chcp 65001 >nul
cls

echo ===============================================================================
echo                TOTVS FIELD REFRESH 2026 - BANCADA DE GESTAO
echo ===============================================================================
echo.
echo [INFO] Inicializando o ambiente do sistema local...
echo [INFO] Horario do Sistema: %TIME%
echo.

set "SCRIPT_DIR=%~dp0"
set "APP_INDEX=%SCRIPT_DIR%app\index.html"

if not exist "%APP_INDEX%" (
    echo [ERRO CRITICO] O arquivo "app\index.html" nao foi localizado!
    echo Verifique se a estrutura de pastas esta preservada:
    echo  %SCRIPT_DIR%start.bat
    echo  %SCRIPT_DIR%app\index.html
    echo.
    pause
    exit /b 1
)

set "BROWSER_FLAGS=--kiosk-printing --disable-print-preview --disable-extensions"

:: Tentativa 1: Microsoft Edge 64-bit (Modo Aplicacao)
if exist "%ProgramFiles%\Microsoft\Edge\Application\msedge.exe" (
    echo [INFO] Abrindo via Microsoft Edge Enterprise...
    start "" "%ProgramFiles%\Microsoft\Edge\Application\msedge.exe" %BROWSER_FLAGS% --app="file:///%APP_INDEX%"
    goto :LAUNCH_SUCCESS
)

:: Tentativa 2: Microsoft Edge 32-bit (Modo Aplicacao)
if exist "%ProgramFiles(x86)%\Microsoft\Edge\Application\msedge.exe" (
    echo [INFO] Abrindo via Microsoft Edge (x86)...
    start "" "%ProgramFiles(x86)%\Microsoft\Edge\Application\msedge.exe" %BROWSER_FLAGS% --app="file:///%APP_INDEX%"
    goto :LAUNCH_SUCCESS
)

:: Tentativa 3: Google Chrome 64-bit (Modo Aplicacao)
if exist "%ProgramFiles%\Google\Chrome\Application\chrome.exe" (
    echo [INFO] Abrindo via Google Chrome App Mode...
    start "" "%ProgramFiles%\Google\Chrome\Application\chrome.exe" %BROWSER_FLAGS% --app="file:///%APP_INDEX%"
    goto :LAUNCH_SUCCESS
)

:: Tentativa 4: Google Chrome 32-bit (Modo Aplicacao)
if exist "%ProgramFiles(x86)%\Google\Chrome\Application\chrome.exe" (
    echo [INFO] Abrindo via Google Chrome (x86)...
    start "" "%ProgramFiles(x86)%\Google\Chrome\Application\chrome.exe" %BROWSER_FLAGS% --app="file:///%APP_INDEX%"
    goto :LAUNCH_SUCCESS
)

:: Fallback: Abre no navegador padrao do Windows associado a arquivos .html
echo [AVISO] Navegadores dedicados nao encontrados nas pastas padrao.
echo [INFO] Abrindo no navegador padrao do sistema operacional...
start "" "%APP_INDEX%"

:LAUNCH_SUCCESS
echo.
echo [SUCESSO] Sistema TOTVS Refresh 2026 inicializado.
echo Esta janela de terminal sera encerrada automaticamente.
timeout /t 2 >nul
exit