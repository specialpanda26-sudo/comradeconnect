#!/bin/sh
# Keeps the newest app-* release and desktop-latest. Deletes every other release and its tag.
# Dry run by default:  sh clean_all_releases.sh OWNER/REPO        Delete for real:  sh clean_all_releases.sh OWNER/REPO go
REPO="${1:-specialpanda26-sudo/comradeconnect}"
command -v gh >/dev/null || { echo "Install gh first: pkg install gh"; exit 1; }
gh release list -R "$REPO" -L 1000 --json tagName,createdAt -q 'sort_by(.createdAt) | reverse | .[].tagName' > "$HOME/cc_tags.txt" || { echo "Could not list releases. Run: gh auth login"; exit 1; }
KEEP=$(grep '^app-' "$HOME/cc_tags.txt" | head -n 1)
[ -n "$KEEP" ] || { echo "No app-* release found. Nothing deleted."; exit 1; }
grep -v -x -e "$KEEP" -e "desktop-latest" "$HOME/cc_tags.txt" > "$HOME/cc_old.txt"
echo "Repo            : $REPO"
echo "Releases found  : $(wc -l < "$HOME/cc_tags.txt")"
echo "Keeping         : $KEEP (and desktop-latest if present)"
echo "To delete       : $(wc -l < "$HOME/cc_old.txt")"
[ -s "$HOME/cc_old.txt" ] || { echo "Nothing to delete."; exit 0; }
if [ "$2" != "go" ]; then
  cat "$HOME/cc_old.txt"; echo
  echo "Dry run only. Nothing was deleted. To delete for real:  sh clean_all_releases.sh $REPO go"
  exit 0
fi
while read -r TAG; do
  [ -n "$TAG" ] || continue
  if gh release delete "$TAG" -R "$REPO" --yes --cleanup-tag; then echo "deleted $TAG"; else echo "FAILED $TAG"; fi
done < "$HOME/cc_old.txt"
echo "Done. Kept: $KEEP"
