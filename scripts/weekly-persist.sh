#!/usr/bin/env bash
# Rodada semanal SEO na VPS: pull → weekly (Docker) → persiste blog-auto no git.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

git pull --ff-only

SECRETS="${NETCAR_SECRETS:-/opt/netcar-secrets}"

docker run --rm \
  -v "$ROOT:/app" \
  -v "$SECRETS/.env.local:/app/.env.local:ro" \
  -v "$SECRETS/.env.production:/app/.env.production:ro" \
  -v "$SECRETS/id_ed25519:/root/.ssh/id_ed25519:ro" \
  -w /app node:20-alpine \
  sh -c 'apk add --no-cache git openssh-client tar >/dev/null \
    && mkdir -p /root/.ssh && chmod 600 /root/.ssh/id_ed25519 \
    && ssh-keyscan -H netcarmultimarcas.com.br >> /root/.ssh/known_hosts 2>/dev/null \
    && npm run weekly'

bash "$ROOT/scripts/commit-blog-auto.sh"
