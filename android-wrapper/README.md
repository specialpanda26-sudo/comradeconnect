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
The app opens Google's own account chooser in a secure browser tab and comes back signed in.
In Google Cloud > Credentials > your Web client > **Authorized redirect URIs** add `https://comradeconnect.co.ke/google-callback.html`.
In Google Auth Platform > Branding set the app name to `Comrade Connect` and upload the logo, so the chooser shows them instead of the website link.
On your API host (Render) add `https://localhost` to `ALLOWED_ORIGINS` (comma separated) so the app may call the server.

## What the app can do
Camera and microphone (Live, ticket scanning), location (Wi-Fi map), notifications, and opening WhatsApp, calls and maps outside the app.
