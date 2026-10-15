#!/usr/bin/env bash
# Existing Netcar cron entry point: reconcile offers, build, deploy, persist.
# Schedule is managed separately by install-offer-schedule.sh.
set -euo pipefail
umask 077
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
MODE="${1:---apply}"
if [ "$#" -gt 1 ] || { [ "$MODE" != "--apply" ] && [ "$MODE" != "--dry-run" ]; }; then
  echo "invalid_offer_schedule_argument" >&2
  exit 1
fi
source "$ROOT/scripts/lib/site-publish-lock.sh"
netcar_site_lock_acquire "$ROOT" 0
trap 'rc=$?; netcar_site_lock_release; exit "$rc"' EXIT
# On interruption leave the lock closed: an upload child may still be running.
trap 'trap - EXIT; exit 143' TERM
trap 'trap - EXIT; exit 130' INT
if [ -f "$ROOT/.devops/offer-reconciliation/pending-push.json" ]; then
  echo "previous_offer_commit_needs_push" >&2
  exit 1
fi
if [ "$MODE" = "--apply" ]; then
  git pull --ff-only
fi
SECRETS="${NETCAR_SECRETS:-/opt/netcar-secrets}"
docker run --rm \
  -v "$ROOT:/app" \
  -v "$SECRETS/.env.local:/app/.env.local:ro" \
  -v "$SECRETS/.env.production:/app/.env.production:ro" \
  -v "$SECRETS/id_ed25519:/root/.ssh/id_deploy:ro" \
  -e NETCAR_SITE_LOCK_TOKEN \
  -e NETCAR_OFFER_RUN_MODE="$MODE" \
  -w /app node:20-alpine \
  sh -c 'apk add --no-cache git openssh-client tar >/dev/null \
    && mkdir -p /root/.ssh \
    && cp /root/.ssh/id_deploy /root/.ssh/id_ed25519 \
    && chmod 600 /root/.ssh/id_ed25519 \
    && ssh-keyscan -H netcarmultimarcas.com.br >> /root/.ssh/known_hosts 2>/dev/null \
    && node scripts/run-offer-reconciliation.mjs "$NETCAR_OFFER_RUN_MODE"'

if [ "$MODE" = "--apply" ]; then
  python3 "$ROOT/scripts/persist-reconciled-offers.py" --apply
fi
