# Comrade Connect Android app

The whole website is packed inside the app, so it opens with no internet and shows the data it saved last time.
Reads are saved on the phone; saving, paying and posting need data and say so clearly.

## Get the APK
1. GitHub > Actions > **Build Android APK** > Run workflow (run it again after every website change you want inside the app).
2. When it finishes, the file is on the repo's **Releases** page as `comrade-connect.apk`.
3. The website's "Download the app" button always points to the newest release (the repo must be public).

## Make updates install over the old app (do this once)
1. In Termux: `pkg install openjdk-17` then `sh android-wrapper/make-keystore.sh`.
2. Add the 4 values it prints as GitHub secrets (Settings > Secrets and variables > Actions).
3. Back the key file up privately. Never commit it.

## Google sign-in in the app
The app shows Google's own **"Choose an account"** bottom sheet on top of the app (Android Credential Manager). The user is not sent to account.google.com.
Code: `android-wrapper/native/GoogleSignInPlugin.kt` (registered in `native/MainActivity.java`). `prepare.py` adds Kotlin and the libraries during the build.

One-time setup in Google Cloud (same project as the Web client):
1. Credentials > Create credentials > OAuth client ID > **Android**. Package name `ke.co.comradeconnect.app`. SHA-1 = the SHA-1 of the key that signs the APK
   (each Actions run prints it in the summary under "Check the APK"; it only stays the same if the 4 signing secrets above are set).
2. Keep the **Web application** client. Its ID is `CC_GOOGLE_ID` in `frontend/config.js`, `frontend/app/config.js`, and `GOOGLE_CLIENT_ID` on the server.
   The sheet asks Google for a token for that Web client, so the server check does not change.
3. Google Auth Platform > Branding: app name `Comrade Connect` and the logo.

If the sheet cannot open (no SHA-1 registered, no Google account on the phone) the app quietly uses the old browser-tab sign-in instead, so nobody is locked out.
That fallback still needs `https://comradeconnect.co.ke/google-callback.html` in the Web client's Authorized redirect URIs, and `https://localhost` in `ALLOWED_ORIGINS` on Render.
Swiping the sheet away is treated as "cancel" and nothing else opens. Set `CC_NATIVE_GOOGLE = false` in the two config.js files to turn the sheet off.

## What the app can do
Camera and microphone (Live, ticket scanning), location (Wi-Fi map), notifications, and opening WhatsApp, calls and maps outside the app.

## About the earlier in-app picker
An older native picker plugin closed the whole app on some phones (Play services or SHA-1 mismatch). The new one is wrapped so every native error is caught
and handed to the browser-tab sign-in instead of crashing.

## "App not installed" / "keeps stopping" (fixed)
- Cause 1: builds without the signing secrets get a NEW random key every time, so Android refuses to update the old app. Run `bash android-wrapper/setup-signing.sh` once, then uninstall the old app ONE last time and install the new APK.
- Cause 2: a build number lower than the installed one is refused as a downgrade. Build numbers now always go up (they come from the clock).
- Cause 3: the main activity now always has `android:exported="true"` (needed on Android 12+).
- Each build prints its package, version and signing fingerprint in the Actions run summary.
