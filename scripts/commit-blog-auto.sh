#!/usr/bin/env bash
# Commita/pusha blog-auto.json se mudou (após generate-blog / weekly).
# Usado no fim do cron da VPS pra histórico não morrer no próximo git pull.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

if ! git status --porcelain -- src/data/seo/blog-auto.json | grep -q .; then
  echo "[commit-blog-auto] sem mudança em blog-auto.json"
  exit 0
fi

git add src/data/seo/blog-auto.json
git commit -m "chore(blog): rodada semanal automática"
git push
echo "[commit-blog-auto] enviado."
