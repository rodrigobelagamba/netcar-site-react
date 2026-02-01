@echo off
REM Script de Deploy Local para KingHost (Windows)
REM Executa build e prepara para upload via FTP

echo 🚀 Iniciando deploy local...
echo.

REM Verificar se .env.local existe
if not exist ".env.local" (
    echo ⚠️  Arquivo .env.local não encontrado!
    echo.
    echo 📝 Criando arquivo .env.local...
    echo FTP_SERVER=ftp.seusite.com.br > .env.local
    echo FTP_USERNAME=seu_usuario >> .env.local
    echo FTP_PASSWORD=sua_senha >> .env.local
    echo FTP_SERVER_DIR=/www/ >> .env.local
    echo.
    echo ✅ Arquivo .env.local criado!
    echo ⚠️  Configure as credenciais FTP no arquivo .env.local antes de continuar
    pause
    exit /b 1
)

REM Carregar variáveis do .env.local
for /f "tokens=1,2 delims==" %%a in (.env.local) do (
    if "%%a"=="FTP_SERVER" set FTP_SERVER=%%b
    if "%%a"=="FTP_USERNAME" set FTP_USERNAME=%%b
    if "%%a"=="FTP_PASSWORD" set FTP_PASSWORD=%%b
    if "%%a"=="FTP_SERVER_DIR" set FTP_SERVER_DIR=%%b
)

REM Verificar se variáveis estão configuradas
if "%FTP_SERVER%"=="" (
    echo ❌ FTP_SERVER não configurado no .env.local
    pause
    exit /b 1
)
if "%FTP_USERNAME%"=="" (
    echo ❌ FTP_USERNAME não configurado no .env.local
    pause
    exit /b 1
)
if "%FTP_PASSWORD%"=="" (
    echo ❌ FTP_PASSWORD não configurado no .env.local
    pause
    exit /b 1
)

REM 1. Verificar dependências
echo 📦 Verificando dependências...
if not exist "node_modules" (
    echo 📥 Instalando dependências...
    call npm install
)
echo ✅ Dependências OK
echo.

REM 2. Gerar build
echo 🔨 Gerando build de produção...
call npm run build
if %errorlevel% neq 0 (
    echo ❌ Erro ao gerar build
    pause
    exit /b 1
)
echo ✅ Build gerado com sucesso
echo.

REM 3. Verificar dist
if not exist "dist" (
    echo ❌ Pasta dist/ não foi criada!
    pause
    exit /b 1
)

REM 4. Criar script FTP temporário
echo 📤 Preparando upload via FTP...
set FTP_SCRIPT=%TEMP%\ftp_upload_%RANDOM%.txt

(
    echo open %FTP_SERVER%
    echo %FTP_USERNAME%
    echo %FTP_PASSWORD%
    echo binary
    echo cd %FTP_SERVER_DIR%
    echo lcd dist
    echo prompt
    echo mput *.*
    echo quit
) > %FTP_SCRIPT%

echo.
echo ============================================================
echo ✅ BUILD PRONTO PARA DEPLOY!
echo ============================================================
echo.
echo 📁 Pasta de build: dist\
echo.
echo 📤 OPÇÕES DE UPLOAD:
echo.
echo Opção 1: Upload manual via FileZilla
echo   1. Abra FileZilla
echo   2. Conecte ao servidor: %FTP_SERVER%
echo   3. Usuário: %FTP_USERNAME%
echo   4. Navegue até: %FTP_SERVER_DIR%
echo   5. Faça upload de TODOS os arquivos da pasta dist/
echo.
echo Opção 2: Upload via FTP nativo do Windows
echo   Execute: ftp -s:%FTP_SCRIPT%
echo   (Nota: Pode não funcionar bem com muitos arquivos)
echo.
echo Opção 3: Usar script Node.js (recomendado)
echo   Execute: npm run deploy:local
echo.
echo ============================================================
echo.
echo 💡 DICA: Para upload automático, instale basic-ftp:
echo    npm install --save-dev basic-ftp
echo    E então execute: npm run deploy:local
echo.

REM Limpar script FTP temporário
del %FTP_SCRIPT% 2>nul

pause
