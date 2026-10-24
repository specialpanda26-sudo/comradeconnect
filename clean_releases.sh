#!/bin/sh
REPO=specialpanda26-sudo/comradeconnect-releases
command -v gh >/dev/null || { echo "Install gh first: pkg install gh"; exit 1; }
gh release list -R "$REPO" -L 1000 --json tagName,createdAt -q 'sort_by(.createdAt) | reverse | .[].tagName' > "$HOME/cc_tags.txt" || { echo "Could not list releases. Run: gh auth login"; exit 1; }
TOTAL=$(wc -l < "$HOME/cc_tags.txt")
KEEP=$(head -n 1 "$HOME/cc_tags.txt")
tail -n +2 "$HOME/cc_tags.txt" | grep -v "^desktop-latest$" > "$HOME/cc_old.txt"
OLD=$(wc -l < "$HOME/cc_old.txt")
echo "Releases found  : $TOTAL"
echo "Keeping (newest): $KEEP"
echo "To delete       : $OLD"
[ "$OLD" -eq 0 ] && { echo "Nothing to delete."; exit 0; }
if [ "$1" != "go" ]; then
  cat "$HOME/cc_old.txt"
  echo
  echo "Dry run only. Nothing was deleted. To delete for real:  sh clean_releases.sh go"
  exit 0
fi
while read -r TAG; do
  [ -n "$TAG" ] || continue
  if gh release delete "$TAG" -R "$REPO" --yes --cleanup-tag; then echo "deleted $TAG"; else echo "FAILED $TAG"; fi
done < "$HOME/cc_old.txt"
echo "Done. Kept: $KEEP"
