#!/bin/bash

# Script para build e gerenciar o container Docker do NetCar Frontend

set -e

# Cores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Função para exibir ajuda
show_help() {
    echo "Uso: ./docker/build.sh [comando]"
    echo ""
    echo "Se nenhum comando for especificado, executa 'up' por padrão."
    echo ""
    echo "Comandos disponíveis:"
    echo "  (padrão)   - Inicia o container (build + start) - executado quando não há argumentos"
    echo "  build      - Constrói a imagem Docker"
    echo "  up         - Inicia o container (build + start)"
    echo "  start      - Inicia o container existente"
    echo "  stop       - Para o container"
    echo "  restart    - Reinicia o container"
    echo "  down       - Para e remove o container"
    echo "  logs       - Exibe os logs do container"
    echo "  status     - Mostra o status do container"
    echo "  shell      - Abre um shell no container"
    echo "  clean      - Remove container e imagens"
    echo "  help       - Exibe esta ajuda"
    echo ""
}

# Verifica se o Docker está instalado
check_docker() {
    if ! command -v docker &> /dev/null; then
        echo -e "${RED}Erro: Docker não está instalado${NC}"
        exit 1
    fi

    if ! command -v docker-compose &> /dev/null; then
        echo -e "${RED}Erro: Docker Compose não está instalado${NC}"
        exit 1
    fi
}

# Navega para o diretório raiz do projeto
cd "$(dirname "$0")/.."

# Verifica Docker
check_docker

# Processa o comando
# Se não houver argumento, executa 'up' por padrão
case "${1:-up}" in
    build)
        echo -e "${GREEN}Construindo a imagem Docker...${NC}"
        docker-compose -f docker/docker-compose.yml build
        echo -e "${GREEN}Build concluído!${NC}"
        ;;
    
    up)
        echo -e "${GREEN}Iniciando o container...${NC}"
        docker-compose -f docker/docker-compose.yml up -d
        echo -e "${GREEN}Container iniciado!${NC}"
        echo -e "${YELLOW}Acesse: http://localhost:8080${NC}"
        ;;
    
    start)
        echo -e "${GREEN}Iniciando o container...${NC}"
        docker-compose -f docker/docker-compose.yml start
        echo -e "${GREEN}Container iniciado!${NC}"
        ;;
    
    stop)
        echo -e "${YELLOW}Parando o container...${NC}"
        docker-compose -f docker/docker-compose.yml stop
        echo -e "${GREEN}Container parado!${NC}"
        ;;
    
    restart)
        echo -e "${YELLOW}Reiniciando o container...${NC}"
        docker-compose -f docker/docker-compose.yml restart
        echo -e "${GREEN}Container reiniciado!${NC}"
        ;;
    
    down)
        echo -e "${YELLOW}Parando e removendo o container...${NC}"
        docker-compose -f docker/docker-compose.yml down
        echo -e "${GREEN}Container removido!${NC}"
        ;;
    
    logs)
        docker-compose -f docker/docker-compose.yml logs -f
        ;;
    
    status)
        echo -e "${GREEN}Status do container:${NC}"
        docker-compose -f docker/docker-compose.yml ps
        ;;
    
    shell)
        echo -e "${GREEN}Abrindo shell no container...${NC}"
        docker-compose -f docker/docker-compose.yml exec web sh
        ;;
    
    clean)
        echo -e "${YELLOW}Removendo container e imagens...${NC}"
        docker-compose -f docker/docker-compose.yml down --rmi all
        echo -e "${GREEN}Limpeza concluída!${NC}"
        ;;
    
    help|--help|-h)
        show_help
        ;;
    
    *)
        echo -e "${RED}Comando desconhecido: $1${NC}"
        echo ""
        show_help
        exit 1
        ;;
esac

