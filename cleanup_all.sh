#!/bin/bash
# Keeps the newest app-* release (and desktop-latest). Deletes every other release and its tag,
# then deletes old finished build runs, keeping the newest one.
# Dry run:  bash cleanup_all.sh        Delete for real:  bash cleanup_all.sh go
command -v gh >/dev/null || pkg install -y gh
gh auth status >/dev/null 2>&1 || gh auth login
MAIN=specialpanda26-sudo/comradeconnect
OTHER=specialpanda26-sudo/comradeconnect-releases
GO="$1"

clean_repo() {
  R="$1"
  gh repo view "$R" >/dev/null 2>&1 || { echo "Skipping $R (not found)"; return; }
  gh release list -R "$R" -L 1000 --json tagName,createdAt -q 'sort_by(.createdAt) | reverse | .[].tagName' > "$HOME/cc_tags.txt"
  KEEP=$(grep '^app-' "$HOME/cc_tags.txt" | head -n 1)
  [ -n "$KEEP" ] || { echo "$R: no app-* release found, nothing deleted"; return; }
  grep -v -x -e "$KEEP" -e desktop-latest "$HOME/cc_tags.txt" > "$HOME/cc_old.txt"
  echo "$R: keeping $KEEP, to delete: $(wc -l < "$HOME/cc_old.txt") releases"
  [ "$GO" = "go" ] || return
  while read -r TAG; do
    [ -n "$TAG" ] || continue
    gh release delete "$TAG" -R "$R" --yes --cleanup-tag >/dev/null && echo "deleted release $TAG"
  done < "$HOME/cc_old.txt"
}

clean_repo "$MAIN"
clean_repo "$OTHER"

gh run list -R "$MAIN" -L 1000 --json databaseId,status -q '.[] | select(.status=="completed") | .databaseId' | tail -n +2 > "$HOME/cc_runs.txt"
echo "$MAIN: old build runs to delete: $(wc -l < "$HOME/cc_runs.txt")"
if [ "$GO" = "go" ]; then
  while read -r ID; do
    [ -n "$ID" ] || continue
    gh run delete "$ID" -R "$MAIN" >/dev/null && echo "deleted run $ID"
  done < "$HOME/cc_runs.txt"
  echo "Done."
else
  echo "Dry run only. Nothing was deleted. To delete for real:  bash cleanup_all.sh go"
fi
