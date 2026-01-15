# Docker Deployment

Este projeto está configurado para ser executado em um VPS usando Docker e Nginx.

## Pré-requisitos

- Docker (versão 20.10 ou superior)
- Docker Compose (versão 2.0 ou superior)

## Build e Execução

### Usando o Script (Recomendado)

```bash
# Dar permissão de execução (apenas na primeira vez)
chmod +x docker/build.sh

# Build e iniciar o container
./docker/build.sh up

# Ver logs
./docker/build.sh logs

# Parar o container
./docker/build.sh stop

# Reiniciar o container
./docker/build.sh restart

# Ver status
./docker/build.sh status

# Parar e remover o container
./docker/build.sh down

# Limpar tudo (container e imagens)
./docker/build.sh clean
```

### Usando Docker Compose diretamente

```bash
# Build e iniciar o container
docker-compose -f docker/docker-compose.yml up -d

# Ver logs
docker-compose -f docker/docker-compose.yml logs -f

# Parar o container
docker-compose -f docker/docker-compose.yml down
```

### Usando Docker diretamente

```bash
# Build da imagem (a partir da raiz do projeto)
docker build -f docker/Dockerfile -t netcar-frontend .

# Executar o container
docker run -d -p 8080:80 --name netcar-frontend netcar-frontend

# Ver logs
docker logs -f netcar-frontend

# Parar o container
docker stop netcar-frontend
docker rm netcar-frontend
```

## Configuração

### Variáveis de Ambiente

Você pode configurar o base path da aplicação através da variável de ambiente `VITE_BASE_PATH`:

```bash
# No Dockerfile ou docker-compose.yml
ENV VITE_BASE_PATH=/app/
```

Ou durante o build:

```bash
docker build --build-arg VITE_BASE_PATH=/app/ -t netcar-frontend .
```

### Portas

Por padrão, o container expõe a porta 8080 no host (mapeada para porta 80 dentro do container):

```yaml
ports:
  - "8080:80"  # Mapeia porta 8080 do host para porta 80 do container
```

A aplicação estará disponível em: `http://localhost:8080`

## Health Check

O container inclui um endpoint de health check em `/health`:

```bash
curl http://localhost:8080/health
# Retorna: healthy
```

## Estrutura

- `docker/Dockerfile`: Define o processo de build multi-stage
- `docker/docker-compose.yml`: Configuração do Docker Compose
- `docker/nginx.conf`: Configuração do Nginx para servir a aplicação SPA
- `docker/build.sh`: Script para build e gerenciar o container Docker
- `.dockerignore`: Arquivos ignorados no build

## Troubleshooting

### Container não inicia

```bash
# Verificar logs
docker-compose logs web

# Verificar se a porta está em uso
netstat -tulpn | grep 8080
```

### Aplicação não carrega

1. Verifique se o build foi concluído com sucesso
2. Verifique os logs do Nginx: `docker-compose logs web`
3. Teste o health check: `curl http://localhost:8080/health`

### Problemas com rotas

Certifique-se de que o `nginx.conf` está configurado corretamente com o fallback para `index.html`.

