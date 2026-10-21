#!/data/data/com.termux/files/usr/bin/bash
# ONE-TIME: makes the permanent app signing key and saves the 4 secrets into GitHub for you.
# Run in Termux:  pkg install openjdk-17 gh -y && gh auth login && bash android-wrapper/setup-signing.sh
# After this, every APK is signed with the same key, so updates install over the old app ("App not installed" stops).
set -e
REPO="specialpanda26-sudo/comradeconnect"
command -v keytool >/dev/null || { echo "Run: pkg install openjdk-17"; exit 1; }
command -v gh >/dev/null || { echo "Run: pkg install gh && gh auth login"; exit 1; }
KS="$HOME/comrade-release.jks"
if [ ! -f "$KS" ]; then
  PASS=$(head -c 48 /dev/urandom | base64 | tr -dc 'A-Za-z0-9' | head -c 24)
  keytool -genkeypair -keystore "$KS" -alias comrade -keyalg RSA -keysize 2048 -validity 10000 \
    -storepass "$PASS" -keypass "$PASS" -dname "CN=Comrade Connect, O=Comrade Connect, C=KE" >/dev/null 2>&1
  echo "$PASS" > "$HOME/comrade-release.pass"; chmod 600 "$HOME/comrade-release.pass" "$KS"
else
  PASS=$(cat "$HOME/comrade-release.pass") || { echo "Key exists but no password file. Stop."; exit 1; }
fi
gh secret set ANDROID_KEYSTORE_PASSWORD -R "$REPO" -b "$PASS"
gh secret set ANDROID_KEY_PASSWORD      -R "$REPO" -b "$PASS"
gh secret set ANDROID_KEY_ALIAS         -R "$REPO" -b "comrade"
base64 -w0 "$KS" | gh secret set ANDROID_KEYSTORE_BASE64 -R "$REPO"
echo "Done. BACK UP $KS and $HOME/comrade-release.pass somewhere private. Never commit them."
