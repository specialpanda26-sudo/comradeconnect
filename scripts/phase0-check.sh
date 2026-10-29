#!/usr/bin/env bash
# Phase 0 check. Never prints secret values.
# Usage: API=https://your-api.onrender.com ./scripts/phase0-check.sh
# Reads vars from .env if present (local) or from the current environment.
[ -f .env ] && set -a && . ./.env && set +a
ok=1
for v in PAYHERO_API_KEY PAYHERO_API_SECRET PAYHERO_CHANNEL_ID PAYHERO_CALLBACK_SECRET CALLBACK_URL CRON_SECRET; do
  if [ -z "${!v}" ]; then echo "MISSING  $v"; ok=0; else echo "set      $v"; fi
done
if [ -n "$CALLBACK_URL" ] && [ -n "$PAYHERO_CALLBACK_SECRET" ]; then
  case "$CALLBACK_URL" in
    *"?s=$PAYHERO_CALLBACK_SECRET") echo "ok       CALLBACK_URL ends with the secret" ;;
    *) echo "BAD      CALLBACK_URL must end with ?s=<PAYHERO_CALLBACK_SECRET>"; ok=0 ;;
  esac
fi
if [ -n "$PAYHERO_CALLBACK_SECRET" ] && [ ${#PAYHERO_CALLBACK_SECRET} -lt 32 ]; then
  echo "WEAK     PAYHERO_CALLBACK_SECRET under 32 chars"; ok=0
fi
if [ -n "$API" ] && [ -n "$CRON_SECRET" ]; then
  echo "cron     calling $API/internal/cron ..."
  curl -s -m 60 -H "x-cron-secret: $CRON_SECRET" "$API/internal/cron"; echo
fi
echo "Manual:  PayHero deposits land in the PAYMENTS wallet, and the withdrawal wallet is funded."
echo "Manual:  Render cron or cron-job.org hits /internal/cron every 15 min."
[ $ok = 1 ] && echo "PHASE 0 OK" || { echo "PHASE 0 INCOMPLETE"; exit 1; }
