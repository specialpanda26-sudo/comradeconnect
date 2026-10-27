#!/data/data/com.termux/files/usr/bin/bash
A=https://comradeconnectback.onrender.com
printf "Paste your ADMIN_KEY, then press Enter (nothing will show): "
read -rs K
echo
echo "characters received: ${#K}"
for p in health mail-test live-check; do
  echo
  echo "== $p"
  curl -s --max-time 90 -H "X-Admin-Key: $K" "$A/api/admin/$p"
  echo
done
unset K
