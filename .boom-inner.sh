set -u
say() { echo "boom: $*"; }
REPO_URL="$1"
REPO_NAME="$2"

echo "nameserver 8.8.8.8" > /etc/resolv.conf 2>/dev/null

need_apt=""
for c in node git screen python3; do command -v "$c" >/dev/null 2>&1 || need_apt=1; done
if [ -n "$need_apt" ]; then
  say "installing Node, git, screen (one-time)..."
  apt-get update -y >/tmp/boom-apt.log 2>&1
  apt-get install -y --no-install-recommends nodejs npm git ca-certificates screen python3 >>/tmp/boom-apt.log 2>&1 \
    || { echo "boom: apt install failed, see /tmp/boom-apt.log"; exit 1; }
fi

cd ~ || exit 1
if [ ! -d "$REPO_NAME" ]; then
  say "getting the repository..."
  git clone "$REPO_URL" "$REPO_NAME" || { echo "boom: could not clone $REPO_URL"; exit 1; }
else
  say "updating the repository..."
  git -C "$REPO_NAME" pull --ff-only >/tmp/boom-pull.log 2>&1 || say "(could not update automatically, continuing with what is here)"
fi
cd "$REPO_NAME" || exit 1

if [ ! -d ~/node_modules/playwright ]; then
  say "installing Playwright (one-time)..."
  mkdir -p ~/pwhome
  ( cd ~/pwhome && { [ -f package.json ] || npm init -y >/dev/null 2>&1; } && npm i playwright --no-audit --no-fund >/tmp/boom-npm.log 2>&1 ) \
    || { echo "boom: npm install failed, see /tmp/boom-npm.log"; exit 1; }
  ln -sf ~/pwhome/node_modules ~/node_modules
fi
ln -sf ~/node_modules node_modules

if [ ! -d ~/.cache/ms-playwright ] || ! find ~/.cache/ms-playwright -maxdepth 1 -iname "chromium*" 2>/dev/null | grep -q .; then
  say "installing the Chromium browser (one-time, needs good internet)..."
  npx playwright install --with-deps chromium >/tmp/boom-chromium.log 2>&1 \
    || { echo "boom: Chromium install failed, see /tmp/boom-chromium.log"; exit 1; }
fi

if [ ! -f ref-test.sh ] || grep -q 'adselect.net/register' ref-test.sh || ! grep -q 'awk -v s=' ref-test.sh || ! grep -q 'REFBOT_FLAGS' ref-test.sh; then
  cat > ref-test.sh << 'RTEOF'
#!/bin/bash
# usage: bash ref-test.sh [accounts] [seconds between accounts]
# run from inside the repo folder (the boom script already cd's here first)
LINK="${REFBOT_LINK:-}"
[ -n "$LINK" ] || { echo "ref-test: no link given. Run it like:  REFBOT_LINK='https://...' bash ref-test.sh 1 90"; exit 1; }
COUNT="${1:-1}"
SECS="${2:-90}"
[ "$COUNT" -gt 100 ] && COUNT=100
[ -d referral-bot-out ] && mv referral-bot-out "referral-bot-out-$(date +%d%H%M%S)"
mkdir -p referral-bot-out
echo "=== $COUNT account(s), $SECS seconds apart, started $(date) ===" | tee referral-bot-out/run.log
node scripts/referral-bot.mjs "$LINK" "$COUNT" --yes --delay=$(awk -v s="$SECS" 'BEGIN{printf "%d", s*1000+0.5}') $REFBOT_FLAGS 2>&1 | tee -a referral-bot-out/run.log
echo "=== FINISHED $(date) ===" | tee -a referral-bot-out/run.log
cat referral-bot-out/report.txt >> referral-bot-out/run.log 2>/dev/null
RTEOF
  chmod +x ref-test.sh
fi

screen -wipe >/dev/null 2>&1
if pgrep -f referral-bot >/dev/null 2>&1; then
  say "the bot is already running, reattaching to the live log..."
  screen -r refbot
else
  LAST_LINK_FILE=~/.boom-last-link
  LAST_SHOWN=""
  [ -f "$LAST_LINK_FILE" ] && LAST_SHOWN="$(cat "$LAST_LINK_FILE")"

  if [ -n "${REFBOT_LINK:-}" ]; then
    RUN_LINK="$REFBOT_LINK"                 # a link you set yourself before running boom is always honoured
  else
    # No silent default, ever: you must paste a real link. A blank or wrong answer asks again; it is never guessed.
    RUN_LINK=""
    while :; do
      if [ -n "$LAST_SHOWN" ]; then
        printf "boom: which referral link are we testing? (last time: %s)\nboom: paste the link - " "$LAST_SHOWN"
      else
        printf "boom: which referral link are we testing? "
      fi
      read -r RUN_LINK || { echo; echo "boom: no keyboard input here, so no link was given. Set it first, e.g.  REFBOT_LINK='https://...' boom"; exit 1; }
      RUN_LINK="$(printf '%s' "$RUN_LINK" | tr -d '\r' | sed "s/^[[:space:]\"']*//; s/[[:space:]\"']*\$//")"
      case "$RUN_LINK" in
        http://*|https://*) break ;;
        "") echo "boom: you have to paste a link - it will not be guessed." ;;
        *)  echo "boom: that does not look like a link (it must start with https://) - paste it again." ;;
      esac
    done
  fi
  case "$RUN_LINK" in
    http://*|https://*) ;;
    *) echo "boom: REFBOT_LINK must start with https:// - nothing was started."; exit 1 ;;
  esac
  case "$RUN_LINK" in
    *\'*|*\ *) echo "boom: the link must not contain a space or a ' character - nothing was started."; exit 1 ;;
  esac
  echo "$RUN_LINK" > "$LAST_LINK_FILE" 2>/dev/null

  if [ -n "${REFBOT_SECS:-}" ]; then
    RUN_SECS="$REFBOT_SECS"
  elif [ -n "${REFBOT_AUTO_YES:-}" ]; then
    RUN_SECS=90
  else
    printf "boom: how many seconds should each account take to create? [90] "
    read -r RUN_SECS
    [ -n "$RUN_SECS" ] || RUN_SECS=90; RUN_SECS="${RUN_SECS//,/.}"
  fi
  case "$RUN_SECS" in
    ""|*[!0-9.,]*|*[.,]*[.,]*|[.,]) RUN_SECS=90 ;;
  esac

  RUN_FLAGS="${REFBOT_FLAGS:-}"
  if [ -z "${REFBOT_FLAGS:-}" ] && [ -z "${REFBOT_AUTO_YES:-}" ]; then
    printf "boom: AI helper on or off? (off is faster) [on] "
    read -r ans_ai
    case "$ans_ai" in off|OFF|Off|n|N|no) RUN_FLAGS="$RUN_FLAGS --no-ai" ;; esac
    printf "boom: fast mode? (skips the welcome card, popups and logout checks after sign-up) [off] "
    read -r ans_fast
    case "$ans_fast" in on|ON|On|y|Y|yes) RUN_FLAGS="$RUN_FLAGS --fast" ;; esac
    printf "boom: how many accounts at once? 1 to 5 [1] "
    read -r ans_par
    case "$ans_par" in [2-5]) RUN_FLAGS="$RUN_FLAGS --parallel=$ans_par" ;; esac
  fi
  case "$RUN_FLAGS" in *[!a-z0-9\ =-]*) RUN_FLAGS="" ;; esac

  if [ -z "${REFBOT_AUTO_YES:-}" ]; then
    echo
    echo "boom: this will open:"
    echo "  $RUN_LINK"
    echo "boom: and create up to 100 real test accounts there, $RUN_SECS seconds apart."
    echo "boom: options:${RUN_FLAGS:- none}"
    echo "boom: only do this on a site you own or have permission to test."
    printf "boom: continue? [y/N] "
    read -r ans
    case "$ans" in
      y|Y|yes|YES) ;;
      *) echo "boom: cancelled. (set REFBOT_AUTO_YES=1 in your shell to skip prompts next time)"; exit 0 ;;
    esac
  fi
  say "starting the bot (100 accounts, $RUN_SECS seconds apart)..."
  screen -dmS refbot bash -lc "cd $PWD && REFBOT_LINK='$RUN_LINK' REFBOT_FLAGS='$RUN_FLAGS' bash ref-test.sh 100 $RUN_SECS"
  sleep 2
  screen -r refbot
fi
