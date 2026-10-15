#!/usr/bin/env bash
# Run on the existing Linux VPS as root. No arguments means dry-run.
set -euo pipefail
SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
exec python3 "$SCRIPT_DIR/offer_schedule.py" "$@"
