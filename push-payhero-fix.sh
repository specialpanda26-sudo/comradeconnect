#!/data/data/com.termux/files/usr/bin/bash
set -e

cd "$HOME/comradeconnect"

EXPECTED="https://github.com/specialpanda26-sudo/comradeconnect.git"
ACTUAL="$(git remote get-url origin)"

if [ "$ACTUAL" != "$EXPECTED" ]; then
  echo "STOP: Git origin does not match the intended repository."
  echo "$ACTUAL"
  exit 1
fi

echo "Checking current changes..."
git status --short

echo
echo "Running the complete test suite..."
npm test

echo
echo "Tests passed. Checking payment changes..."
git diff --check
git diff -- backend/src/finoq.js backend/src/payouts.js

echo
echo "Staging only the two payment files..."
git add backend/src/finoq.js backend/src/payouts.js

if git diff --cached --quiet; then
  echo "No staged payment changes to commit."
  exit 0
fi

echo
echo "Creating commit..."
git commit -m "Improve PayHero payment and payout handling"

echo
echo "Pushing to GitHub..."
git push origin HEAD

echo
echo "SUCCESS: Payment changes pushed."
