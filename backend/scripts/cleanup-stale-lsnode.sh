#!/bin/bash
# Kill stale lsnode workers for this app (cPanel / CloudLinux).
# cPanel cron example (every hour):
#   0 * * * * /bin/bash $HOME/public_html/backend/scripts/cleanup-stale-lsnode.sh >> $HOME/tmp/lsnode-cleanup.log 2>&1

set -euo pipefail

APP_MARKER="${LSNODE_APP_MARKER:-lsnode:/home/${USER}/public_html/backend/}"
MAX_AGE_MINUTES="${LSNODE_MAX_AGE_MINUTES:-30}"
DRY_RUN=false
[[ "${1:-}" == "--dry-run" ]] && DRY_RUN=true

killed=0
kept=0

while IFS= read -r line; do
  pid=$(echo "$line" | awk '{print $1}')
  etime=$(ps -p "$pid" -o etimes= 2>/dev/null | tr -d ' ')
  [[ -z "$etime" ]] && continue

  age_min=$((etime / 60))
  if (( age_min >= MAX_AGE_MINUTES )); then
    if $DRY_RUN; then
      echo "[dry-run] would kill PID $pid (age ${age_min}m)"
    else
      kill -TERM "$pid" 2>/dev/null || kill -9 "$pid" 2>/dev/null || true
      echo "killed PID $pid (age ${age_min}m)"
    fi
    killed=$((killed + 1))
  else
    kept=$((kept + 1))
  fi
done < <(ps -u "$USER" -o pid=,args= 2>/dev/null | grep "$APP_MARKER" | grep -v grep || true)

echo "$(date -Iseconds) marker=$APP_MARKER kept=$kept killed=$killed dry_run=$DRY_RUN"
