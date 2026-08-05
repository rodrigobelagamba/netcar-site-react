#!/bin/bash
# Atribuicao diaria WhatsApp -> Evolution -> enrich (venda+CRM) -> CSV
set -e
ROOT="/Users/marcelomarchis/Library/CloudStorage/Dropbox/DEPTO. TI/SITE REACT"
cd "$ROOT"
LOG="$ROOT/docs/atribuicao_diaria.log"
echo "=== $(date '+%Y-%m-%d %H:%M:%S') ===" >> "$LOG"
python3 scripts/evolution_attribution.py >> "$LOG" 2>&1
python3 scripts/atribuicao_enrich.py >> "$LOG" 2>&1
python3 scripts/campanhas_snapshot.py >> "$LOG" 2>&1
python3 scripts/wa_clicks_sync.py >> "$LOG" 2>&1
echo "OK" >> "$LOG"
