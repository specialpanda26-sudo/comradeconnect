#!/bin/sh
# Makes the permanent signing key for the Android app. Run it ONCE, in Termux:   sh android-wrapper/make-keystore.sh
# Then copy the 4 values it prints into GitHub: repo > Settings > Secrets and variables > Actions > New repository secret.
# Keep ~/comrade-release.jks safe (back it up somewhere private). If you lose it, everyone must uninstall the app to update.
set -e
command -v keytool >/dev/null 2>&1 || { echo "Install Java first:  pkg install openjdk-17"; exit 1; }
KS="$HOME/comrade-release.jks"
[ -f "$KS" ] && { echo "$KS already exists. Not overwriting it."; exit 1; }
PASS=$(head -c 48 /dev/urandom | base64 | tr -dc 'A-Za-z0-9' | head -c 24)
keytool -genkeypair -keystore "$KS" -alias comrade -keyalg RSA -keysize 2048 -validity 10000 \
  -storepass "$PASS" -keypass "$PASS" -dname "CN=Comrade Connect, O=Comrade Connect, C=KE" >/dev/null 2>&1
echo
echo "Key saved to $KS"
echo
echo "Add these 4 GitHub secrets (names on the left, values on the right):"
echo "ANDROID_KEYSTORE_PASSWORD = $PASS"
echo "ANDROID_KEY_ALIAS         = comrade"
echo "ANDROID_KEY_PASSWORD      = $PASS"
echo "ANDROID_KEYSTORE_BASE64   = (the long text below)"
echo
base64 -w0 "$KS"
echo
