#!/bin/bash

# Script de Deploy Local para KingHost (Linux/Mac)
# Executa build e prepara para upload via FTP

set -e

echo "🚀 Iniciando deploy local..."
echo ""

# Cores
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m'

# Verificar se .env.local existe
if [ ! -f ".env.local" ]; then
    echo -e "${YELLOW}⚠️  Arquivo .env.local não encontrado!${NC}"
    echo ""
    echo "📝 Criando arquivo .env.local..."
    cat > .env.local << EOF
FTP_SERVER=ftp.seusite.com.br
FTP_USERNAME=seu_usuario
FTP_PASSWORD=sua_senha
FTP_SERVER_DIR=/www/
EOF
    echo -e "${GREEN}✅ Arquivo .env.local criado!${NC}"
    echo -e "${YELLOW}⚠️  Configure as credenciais FTP no arquivo .env.local antes de continuar${NC}"
    exit 1
fi

# Carregar variáveis do .env.local
source .env.local

# Verificar se variáveis estão configuradas
if [ -z "$FTP_SERVER" ] || [ -z "$FTP_USERNAME" ] || [ -z "$FTP_PASSWORD" ]; then
    echo -e "${RED}❌ Variáveis FTP não configuradas no .env.local${NC}"
    exit 1
fi

# 1. Verificar dependências
echo -e "${BLUE}📦 Verificando dependências...${NC}"
if [ ! -d "node_modules" ]; then
    echo "📥 Instalando dependências..."
    npm install
fi
echo -e "${GREEN}✅ Dependências OK${NC}"
echo ""

# 2. Gerar build
echo -e "${BLUE}🔨 Gerando build de produção...${NC}"
npm run build
if [ $? -ne 0 ]; then
    echo -e "${RED}❌ Erro ao gerar build${NC}"
    exit 1
fi
echo -e "${GREEN}✅ Build gerado com sucesso${NC}"
echo ""

# 3. Verificar dist
if [ ! -d "dist" ]; then
    echo -e "${RED}❌ Pasta dist/ não foi criada!${NC}"
    exit 1
fi

# 4. Upload via FTP usando lftp (se disponível)
if command -v lftp &> /dev/null; then
    echo -e "${BLUE}📤 Fazendo upload via FTP (lftp)...${NC}"
    lftp -c "
    set ftp:list-options -a;
    open -u $FTP_USERNAME,$FTP_PASSWORD $FTP_SERVER;
    cd $FTP_SERVER_DIR;
    lcd dist;
    mirror --reverse --delete --verbose --exclude-glob .git* --exclude-glob node_modules --exclude-glob admin --exclude-glob admin/** --exclude-glob sistema --exclude-glob sistema/** --exclude-glob api --exclude-glob api/** --exclude-glob social --exclude-glob social/**;
    "
    echo -e "${GREEN}✅ Upload concluído!${NC}"
elif command -v ftp &> /dev/null; then
    echo -e "${YELLOW}⚠️  lftp não encontrado. Usando ftp básico...${NC}"
    echo -e "${BLUE}📤 Preparando upload via FTP...${NC}"
    echo ""
    echo "Para fazer upload manualmente:"
    echo "1. Conecte via FileZilla ou cliente FTP"
    echo "2. Servidor: $FTP_SERVER"
    echo "3. Usuário: $FTP_USERNAME"
    echo "4. Diretório: $FTP_SERVER_DIR"
    echo "5. Faça upload de todos os arquivos da pasta dist/"
else
    echo -e "${YELLOW}⚠️  Ferramentas FTP não encontradas${NC}"
    echo ""
    echo "📤 OPÇÕES DE UPLOAD:"
    echo ""
    echo "Opção 1: Instalar lftp e executar novamente"
    echo "  Ubuntu/Debian: sudo apt-get install lftp"
    echo "  macOS: brew install lftp"
    echo ""
    echo "Opção 2: Upload manual via FileZilla"
    echo "  1. Abra FileZilla"
    echo "  2. Conecte ao servidor: $FTP_SERVER"
    echo "  3. Usuário: $FTP_USERNAME"
    echo "  4. Navegue até: $FTP_SERVER_DIR"
    echo "  5. Faça upload de TODOS os arquivos da pasta dist/"
    echo ""
    echo "Opção 3: Usar script Node.js"
    echo "  npm install --save-dev basic-ftp"
    echo "  npm run deploy:local"
fi

echo ""
echo "============================================================"
echo -e "${GREEN}✅ BUILD PRONTO PARA DEPLOY!${NC}"
echo "============================================================"
echo ""
echo "📁 Pasta de build: dist/"
echo ""
