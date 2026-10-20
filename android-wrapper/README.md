# Comrade Connect Android app

A small Android shell (Capacitor) that opens https://comradeconnect.co.ke. Website updates reach the app at once, with no rebuild.

## Get the APK
1. GitHub > Actions > **Build Android APK** > Run workflow.
2. Wait for it to finish (it usually takes several minutes). Open the repo's **Releases** page and download `comrade-connect.apk`.
3. On the phone, open the file and allow "Install unknown apps" for your browser when asked.

## Make updates install over the old app (do this once)
Without a permanent key, every build is signed with a temporary one and Android refuses to update over the old app.
1. In Termux: `pkg install openjdk-17` then `sh android-wrapper/make-keystore.sh`.
2. Add the 4 values it prints as GitHub secrets (Settings > Secrets and variables > Actions).
3. Back the key file up somewhere private. Never commit it.

## What the app can do
Camera and microphone (Live, ticket scanning), location (Wi-Fi map), notifications, and opening WhatsApp, calls and maps outside the app.
Google sign-in can be blocked inside Android web views, so use username and password in the app.
