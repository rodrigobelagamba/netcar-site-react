#!/usr/bin/env bash
# Instala o pipeline diario como LaunchAgent do usuario atual.
set -Eeuo pipefail
umask 077

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd -P)"
REPO_ROOT="$(cd -- "$SCRIPT_DIR/.." && pwd -P)"
RUNNER="$SCRIPT_DIR/atribuicao_diaria.sh"
ENV_FILE="$REPO_ROOT/.env.attribution"
LABEL="com.netcar.atribuicao"
HOUR=3
MINUTE=15
RUN_NOW=0
UNINSTALL=0
DRY_RUN=0

usage() {
  printf '%s\n' \
    "Uso: $0 [--env-file PATH] [--hour 0-23] [--minute 0-59] [--dry-run] [--run-now]" \
    "       $0 [--label LABEL] --uninstall"
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --env-file) [[ $# -ge 2 ]] || exit 2; ENV_FILE="$2"; shift 2 ;;
    --label) [[ $# -ge 2 ]] || exit 2; LABEL="$2"; shift 2 ;;
    --hour) [[ $# -ge 2 ]] || exit 2; HOUR="$2"; shift 2 ;;
    --minute) [[ $# -ge 2 ]] || exit 2; MINUTE="$2"; shift 2 ;;
    --run-now) RUN_NOW=1; shift ;;
    --dry-run) DRY_RUN=1; shift ;;
    --uninstall) UNINSTALL=1; shift ;;
    -h|--help) usage; exit 0 ;;
    *) printf 'erro: argumento desconhecido: %s\n' "$1" >&2; usage >&2; exit 2 ;;
  esac
done

case "$REPO_ROOT" in
  *Dropbox*|*/Library/CloudStorage/*|*iCloud*)
    printf 'erro: mova/clone o checkout para disco local antes de instalar: %s\n' "$REPO_ROOT" >&2
    exit 1
    ;;
esac
[[ "$LABEL" =~ ^[A-Za-z0-9.-]+$ ]] || { printf 'erro: label invalido\n' >&2; exit 1; }
[[ "$HOUR" =~ ^[0-9]+$ ]] && (( HOUR >= 0 && HOUR <= 23 )) || {
  printf 'erro: --hour deve estar entre 0 e 23\n' >&2
  exit 1
}
[[ "$MINUTE" =~ ^[0-9]+$ ]] && (( MINUTE >= 0 && MINUTE <= 59 )) || {
  printf 'erro: --minute deve estar entre 0 e 59\n' >&2
  exit 1
}

LAUNCH_DIR="$HOME/Library/LaunchAgents"
PLIST="$LAUNCH_DIR/$LABEL.plist"
DOMAIN="gui/$(id -u)"

if (( UNINSTALL )); then
  launchctl bootout "$DOMAIN/$LABEL" 2>/dev/null || true
  launchctl bootout "$DOMAIN" "$PLIST" 2>/dev/null || true
  if [[ -f "$PLIST" ]]; then rm -f "$PLIST"; fi
  printf 'LaunchAgent removido: %s\n' "$LABEL"
  exit 0
fi

[[ -f "$ENV_FILE" ]] || {
  printf 'erro: crie o arquivo de ambiente antes de instalar: %s\n' "$ENV_FILE" >&2
  exit 1
}
[[ -x "$RUNNER" ]] || {
  printf 'erro: runner nao executavel: %s\n' "$RUNNER" >&2
  exit 1
}
DATA_DIR="$HOME/Library/Application Support/Netcar/attribution"
LOG_DIR="$HOME/Library/Logs/Netcar Attribution"
if (( DRY_RUN )); then
  "$RUNNER" --env-file "$ENV_FILE" --dry-run
  printf 'instalacao validada: label=%s agenda=%02d:%02d checkout=%s\n' \
    "$LABEL" "$HOUR" "$MINUTE" "$REPO_ROOT"
  exit 0
fi
mkdir -p "$LAUNCH_DIR" "$DATA_DIR" "$LOG_DIR"
chmod 700 "$DATA_DIR" "$LOG_DIR" 2>/dev/null || true
chmod 600 "$ENV_FILE"

launchctl bootout "$DOMAIN/$LABEL" 2>/dev/null || true
launchctl bootout "$DOMAIN" "$PLIST" 2>/dev/null || true

python3 - "$PLIST" "$LABEL" "$RUNNER" "$ENV_FILE" "$REPO_ROOT" "$LOG_DIR" "$HOUR" "$MINUTE" <<'PY'
import os
import plistlib
import sys
import tempfile
from pathlib import Path

destination = Path(sys.argv[1])
label, runner, env_file, root, log_dir_raw = sys.argv[2:7]
hour, minute = int(sys.argv[7]), int(sys.argv[8])
log_dir = Path(log_dir_raw)
payload = {
    "Label": label,
    "ProgramArguments": ["/bin/bash", runner, "--env-file", env_file],
    "WorkingDirectory": root,
    "StartCalendarInterval": {"Hour": hour, "Minute": minute},
    "RunAtLoad": False,
    "ProcessType": "Background",
    "StandardOutPath": str(log_dir / "launchagent.out.log"),
    "StandardErrorPath": str(log_dir / "launchagent.err.log"),
}
fd, temporary = tempfile.mkstemp(prefix=f".{destination.name}.", dir=str(destination.parent))
try:
    with os.fdopen(fd, "wb") as handle:
        plistlib.dump(payload, handle, fmt=plistlib.FMT_XML, sort_keys=False)
    os.chmod(temporary, 0o600)
    os.replace(temporary, destination)
except Exception:
    try:
        os.unlink(temporary)
    except OSError:
        pass
    raise
PY

launchctl bootstrap "$DOMAIN" "$PLIST"
launchctl enable "$DOMAIN/$LABEL"
if (( RUN_NOW )); then launchctl kickstart -k "$DOMAIN/$LABEL"; fi

printf 'LaunchAgent instalado: %s\n' "$PLIST"
printf 'Agenda: %02d:%02d | checkout local: %s\n' "$HOUR" "$MINUTE" "$REPO_ROOT"
printf 'Valide antes com: %s --env-file %s --dry-run\n' "$RUNNER" "$ENV_FILE"
