#!/usr/bin/env bash
# Pipeline diario: log proprio -> Evolution -> CRM/ERP -> relatorio auditavel.
set -Eeuo pipefail
umask 077

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd -P)"
REPO_ROOT="$(cd -- "$SCRIPT_DIR/.." && pwd -P)"
ENV_FILE="$REPO_ROOT/.env.attribution"
DRY_RUN=0

usage() {
  printf '%s\n' \
    "Uso: $0 [--env-file CAMINHO] [--dry-run]" \
    "  --dry-run  valida arquivos, credenciais e transporte sem acessar APIs/bancos"
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --env-file)
      [[ $# -ge 2 ]] || { printf 'erro: --env-file exige caminho\n' >&2; exit 2; }
      ENV_FILE="$2"
      shift 2
      ;;
    --dry-run)
      DRY_RUN=1
      shift
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      printf 'erro: argumento desconhecido: %s\n' "$1" >&2
      usage >&2
      exit 2
      ;;
  esac
done

trim() {
  local value="$1"
  while [[ "$value" =~ ^[[:space:]] ]]; do value="${value:1}"; done
  while [[ "$value" =~ [[:space:]]$ ]]; do value="${value:0:${#value}-1}"; done
  printf '%s' "$value"
}

load_env_safely() {
  local file="$1" line key value first last
  [[ -f "$file" ]] || { printf 'erro: arquivo de ambiente ausente: %s\n' "$file" >&2; exit 1; }
  while IFS= read -r line || [[ -n "$line" ]]; do
    line="$(trim "$line")"
    [[ -z "$line" || "${line:0:1}" == "#" ]] && continue
    if [[ "$line" == export\ * ]]; then line="$(trim "${line#export }")"; fi
    [[ "$line" == *=* ]] || { printf 'erro: linha invalida no arquivo de ambiente\n' >&2; exit 1; }
    key="$(trim "${line%%=*}")"
    value="$(trim "${line#*=}")"
    [[ "$key" =~ ^[A-Za-z_][A-Za-z0-9_]*$ ]] || {
      printf 'erro: chave invalida no arquivo de ambiente\n' >&2
      exit 1
    }
    case "$key" in
      PATH|HOME|CODEX_HOME|BASH_ENV|ENV|IFS|CDPATH|SHELLOPTS|PYTHONPATH|PYTHONHOME|LD_*|DYLD_*)
        printf 'erro: chave de ambiente nao permitida no runner: %s\n' "$key" >&2
        exit 1
        ;;
    esac
    if [[ ${#value} -ge 2 ]]; then
      first="${value:0:1}"
      last="${value:${#value}-1:1}"
      if [[ ( "$first" == '"' && "$last" == '"' ) || ( "$first" == "'" && "$last" == "'" ) ]]; then
        value="${value:1:${#value}-2}"
      fi
    fi
    # O arquivo nunca e avaliado como shell: $(), crases e $VAR ficam literais.
    if [[ -z "${!key:-}" ]]; then
      printf -v "$key" '%s' "$value"
      export "$key"
    fi
  done < "$file"
}

bool_true() {
  case "${1:-}" in 1|true|TRUE|yes|YES|on|ON|sim|SIM) return 0 ;; esac
  return 1
}

integer_between() {
  local value="$1" minimum="$2" maximum="$3" label="$4"
  [[ "$value" =~ ^[0-9]+$ ]] && (( value >= minimum && value <= maximum )) || {
    printf 'erro: %s deve estar entre %s e %s\n' "$label" "$minimum" "$maximum" >&2
    exit 1
  }
}

load_env_safely "$ENV_FILE"
export NETCAR_ATTRIBUTION_ENV_FILE="$ENV_FILE"

PYTHON_BIN="${ATTRIBUTION_PYTHON:-python3}"
command -v "$PYTHON_BIN" >/dev/null 2>&1 || {
  printf 'erro: Python nao encontrado: %s\n' "$PYTHON_BIN" >&2
  exit 1
}

DATA_DIR="${ATTRIBUTION_DATA_DIR:-$HOME/Library/Application Support/Netcar/attribution}"
LOG_DIR="${ATTRIBUTION_LOG_DIR:-$HOME/Library/Logs/Netcar Attribution}"
[[ "$DATA_DIR" == /* && "$LOG_DIR" == /* ]] || {
  printf 'erro: ATTRIBUTION_DATA_DIR e ATTRIBUTION_LOG_DIR devem ser absolutos\n' >&2
  exit 1
}
[[ "$DATA_DIR" != "/" && "$LOG_DIR" != "/" ]] || {
  printf 'erro: diretorio amplo demais para dados/logs\n' >&2
  exit 1
}
mkdir -p "$DATA_DIR" "$LOG_DIR"
chmod 700 "$DATA_DIR" "$LOG_DIR" 2>/dev/null || true

TUNNEL_PID=""
LOCK_DIR="$DATA_DIR/.daily.lock"
LOCK_ACQUIRED=0
cleanup() {
  local status=$?
  local lock_owner=""
  trap - EXIT INT TERM HUP
  if [[ -n "$TUNNEL_PID" ]] && kill -0 "$TUNNEL_PID" 2>/dev/null; then
    kill "$TUNNEL_PID" 2>/dev/null || true
    wait "$TUNNEL_PID" 2>/dev/null || true
  fi
  if (( LOCK_ACQUIRED )) && [[ -d "$LOCK_DIR" ]]; then
    lock_owner="$(cat -- "$LOCK_DIR/pid" 2>/dev/null || true)"
    if [[ -z "$lock_owner" || "$lock_owner" == "$$" ]]; then
      rm -f -- "$LOCK_DIR/pid"
      rmdir -- "$LOCK_DIR" 2>/dev/null || true
    fi
  fi
  exit "$status"
}
trap cleanup EXIT INT TERM HUP

if ! mkdir "$LOCK_DIR" 2>/dev/null; then
  previous_pid="$(cat -- "$LOCK_DIR/pid" 2>/dev/null || true)"
  if [[ "$previous_pid" =~ ^[0-9]+$ ]] && kill -0 "$previous_pid" 2>/dev/null; then
    printf 'pipeline ja esta em execucao (pid %s)\n' "$previous_pid"
    exit 0
  fi
  rm -f "$LOCK_DIR/pid"
  rmdir "$LOCK_DIR" 2>/dev/null || true
  mkdir "$LOCK_DIR" || { printf 'erro: nao foi possivel adquirir lock\n' >&2; exit 1; }
fi
LOCK_ACQUIRED=1
printf '%s\n' "$$" > "$LOCK_DIR/pid"

if [[ -n "${EVO_SSH_TARGET:-}" ]]; then
  [[ "$EVO_SSH_TARGET" != -* && "$EVO_SSH_TARGET" =~ ^[A-Za-z0-9._%+@:-]+$ ]] || {
    printf 'erro: EVO_SSH_TARGET invalido\n' >&2
    exit 1
  }
  EVO_SSH_LOCAL_PORT="${EVO_SSH_LOCAL_PORT:-18080}"
  EVO_SSH_REMOTE_PORT="${EVO_SSH_REMOTE_PORT:-8080}"
  EVO_SSH_PORT="${EVO_SSH_PORT:-22}"
  integer_between "$EVO_SSH_LOCAL_PORT" 1024 65535 EVO_SSH_LOCAL_PORT
  integer_between "$EVO_SSH_REMOTE_PORT" 1 65535 EVO_SSH_REMOTE_PORT
  integer_between "$EVO_SSH_PORT" 1 65535 EVO_SSH_PORT
  export EVO_BASE_URL="http://127.0.0.1:$EVO_SSH_LOCAL_PORT"
fi

PYTHONPATH="$SCRIPT_DIR" "$PYTHON_BIN" - <<'PY'
import os
from offline_config import ConfigError, env_bool, required_env, service_url

required_env("EVO_API_KEY")
required_env("EVO_INSTANCE")
service_url(
    "EVO_BASE_URL",
    allow_insecure_flag="EVO_ALLOW_INSECURE_HTTP",
    allow_loopback_when_env="EVO_SSH_TARGET",
)
required_env("WA_LOG_TOKEN")
service_url("WA_LOG_BASE_URL", allow_insecure_flag="WA_LOG_ALLOW_INSECURE_HTTP")
skip_all = env_bool("ATTRIBUTION_SKIP_DATABASES", False)
skip_crm = skip_all or env_bool("ATTRIBUTION_SKIP_CRM", False)
skip_sales = skip_all or env_bool("ATTRIBUTION_SKIP_SALES", False)
if not skip_crm and not os.environ.get("ATTRIBUTION_CRM_SNAPSHOT_CSV"):
    required_env("CRM_DATABASE_URL")
if not skip_sales and not os.environ.get("ATTRIBUTION_SALES_SNAPSHOT_CSV"):
    required_env("PG_CONNECTION_STRING")
if env_bool("ATTRIBUTION_RUN_CAMPAIGN_SNAPSHOT", False):
    platforms = {
        item.strip().lower()
        for item in os.environ.get("CAMPAIGN_SNAPSHOT_PLATFORMS", "meta,google").split(",")
        if item.strip()
    }
    if "meta" in platforms:
        required_env("META_ACCESS_TOKEN")
        required_env("META_AD_ACCOUNT")
    if "google" in platforms:
        for name in (
            "GOOGLE_ADS_CLIENT_ID",
            "GOOGLE_ADS_CLIENT_SECRET",
            "GOOGLE_ADS_REFRESH_TOKEN",
            "GOOGLE_ADS_DEVELOPER_TOKEN",
            "GOOGLE_ADS_CUSTOMER_ID",
        ):
            required_env(name)
print("configuracao validada; segredos nao exibidos")
PY

if (( DRY_RUN )); then
  printf 'dry-run OK: checkout=%s data=%s logs=%s\n' "$REPO_ROOT" "$DATA_DIR" "$LOG_DIR"
  exit 0
fi

LOG_FILE="$LOG_DIR/attribution-$(date '+%Y-%m-%d').log"
touch "$LOG_FILE"
chmod 600 "$LOG_FILE" 2>/dev/null || true
exec >> "$LOG_FILE" 2>&1
printf '\n=== %s ===\n' "$(date '+%Y-%m-%d %H:%M:%S %z')"

if [[ -n "${EVO_SSH_TARGET:-}" ]]; then
  command -v ssh >/dev/null 2>&1 || { printf 'erro: ssh nao encontrado\n' >&2; exit 1; }
  ssh_args=(
    -N -T
    -o BatchMode=yes
    -o ExitOnForwardFailure=yes
    -o ServerAliveInterval=30
    -o ServerAliveCountMax=3
    -p "$EVO_SSH_PORT"
    -L "127.0.0.1:$EVO_SSH_LOCAL_PORT:127.0.0.1:$EVO_SSH_REMOTE_PORT"
  )
  if [[ -n "${EVO_SSH_IDENTITY_FILE:-}" ]]; then
    [[ -f "$EVO_SSH_IDENTITY_FILE" ]] || {
      printf 'erro: EVO_SSH_IDENTITY_FILE ausente\n' >&2
      exit 1
    }
    ssh_args+=( -i "$EVO_SSH_IDENTITY_FILE" )
  fi
  ssh "${ssh_args[@]}" "$EVO_SSH_TARGET" &
  TUNNEL_PID=$!
  sleep 1
  kill -0 "$TUNNEL_PID" 2>/dev/null || {
    wait "$TUNNEL_PID" || true
    printf 'erro: tunel SSH Evolution nao iniciou\n' >&2
    exit 1
  }
  printf 'tunel SSH Evolution ativo em loopback:%s\n' "$EVO_SSH_LOCAL_PORT"
fi

MAX_ATTEMPTS="${ATTRIBUTION_RETRY_ATTEMPTS:-3}"
RETRY_DELAY="${ATTRIBUTION_RETRY_DELAY_SECONDS:-5}"
integer_between "$MAX_ATTEMPTS" 1 10 ATTRIBUTION_RETRY_ATTEMPTS
integer_between "$RETRY_DELAY" 0 300 ATTRIBUTION_RETRY_DELAY_SECONDS

run_stage() {
  local label="$1" attempt=1 status
  shift
  while (( attempt <= MAX_ATTEMPTS )); do
    printf '[%s] tentativa %s/%s\n' "$label" "$attempt" "$MAX_ATTEMPTS"
    set +e
    "$@"
    status=$?
    set -e
    if (( status == 0 )); then
      printf '[%s] OK\n' "$label"
      return 0
    fi
    printf '[%s] falhou (status %s)\n' "$label" "$status" >&2
    (( attempt += 1 ))
    if (( attempt <= MAX_ATTEMPTS && RETRY_DELAY > 0 )); then sleep "$RETRY_DELAY"; fi
  done
  return "$status"
}

run_stage wa_clicks "$PYTHON_BIN" "$SCRIPT_DIR/wa_clicks_sync.py"
run_stage evolution "$PYTHON_BIN" "$SCRIPT_DIR/evolution_attribution.py"

enrich_args=( "$PYTHON_BIN" "$SCRIPT_DIR/atribuicao_enrich.py" )
if bool_true "${ATTRIBUTION_SKIP_DATABASES:-}"; then enrich_args+=( --skip-databases ); fi
if bool_true "${ATTRIBUTION_SKIP_CRM:-}"; then enrich_args+=( --skip-crm ); fi
if bool_true "${ATTRIBUTION_SKIP_SALES:-}"; then enrich_args+=( --skip-sales ); fi
if bool_true "${ATTRIBUTION_ALLOW_MISSING_CLICK_LOG:-}"; then
  enrich_args+=( --allow-missing-click-log )
fi
if [[ -n "${ATTRIBUTION_CRM_SNAPSHOT_CSV:-}" ]]; then
  enrich_args+=( --crm-csv "$ATTRIBUTION_CRM_SNAPSHOT_CSV" )
fi
if [[ -n "${ATTRIBUTION_SALES_SNAPSHOT_CSV:-}" ]]; then
  enrich_args+=( --sales-csv "$ATTRIBUTION_SALES_SNAPSHOT_CSV" )
fi
run_stage enrich "${enrich_args[@]}"

if bool_true "${ATTRIBUTION_RUN_CAMPAIGN_SNAPSHOT:-}"; then
  run_stage campaigns "$PYTHON_BIN" "$SCRIPT_DIR/campanhas_snapshot.py"
fi

LOG_RETENTION_DAYS="${ATTRIBUTION_LOG_RETENTION_DAYS:-30}"
integer_between "$LOG_RETENTION_DAYS" 1 3650 ATTRIBUTION_LOG_RETENTION_DAYS
"$PYTHON_BIN" - "$LOG_DIR" "$LOG_RETENTION_DAYS" <<'PY'
import pathlib
import sys
import time

directory = pathlib.Path(sys.argv[1]).resolve()
cutoff = time.time() - int(sys.argv[2]) * 86400
for path in directory.glob("attribution-*.log"):
    if path.is_file() and path.stat().st_mtime < cutoff:
        path.unlink()
PY

printf 'pipeline concluido com sucesso\n'
