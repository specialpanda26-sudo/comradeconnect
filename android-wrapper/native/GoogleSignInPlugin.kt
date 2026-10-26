package ke.co.comradeconnect.app

import androidx.credentials.CredentialManager
import androidx.credentials.CustomCredential
import androidx.credentials.GetCredentialRequest
import androidx.credentials.exceptions.GetCredentialCancellationException
import androidx.credentials.exceptions.GetCredentialException
import androidx.credentials.exceptions.NoCredentialException
import com.getcapacitor.JSObject
import com.getcapacitor.Plugin
import com.getcapacitor.PluginCall
import com.getcapacitor.PluginMethod
import com.getcapacitor.annotation.CapacitorPlugin
import com.google.android.libraries.identity.googleid.GetGoogleIdOption
import com.google.android.libraries.identity.googleid.GoogleIdTokenCredential
import com.google.android.libraries.identity.googleid.GoogleIdTokenParsingException
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.cancel
import kotlinx.coroutines.launch

/**
 * Native "Choose an account" bottom sheet (Android Credential Manager).
 * It slides up over the app. The user is never sent to account.google.com.
 *
 * JS:  Capacitor.registerPlugin('GoogleSignIn').signIn({ serverClientId, nonce? })
 *      -> { idToken, email, displayName, givenName, familyName, photoUrl }
 *
 * Rejection codes (err.code in JS):
 *   CANCELLED  the user swiped the sheet away. Do nothing.
 *   NO_ACCOUNT no Google account on the phone, or this build's SHA-1 is not registered
 *              as an Android OAuth client. The web layer falls back to the browser flow.
 *   FAILED     anything else (also falls back).
 */
@CapacitorPlugin(name = "GoogleSignIn")
class GoogleSignInPlugin : Plugin() {

    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.Main)

    @PluginMethod
    fun signIn(call: PluginCall) {
        val serverClientId = call.getString("serverClientId")?.trim().orEmpty().ifEmpty { WEB_CLIENT_ID }
        val nonce = call.getString("nonce")
        val act = activity
        if (act == null || act.isFinishing) {
            call.reject("The app is not ready yet. Try again.", "FAILED")
            return
        }

        scope.launch {
            try {
                // 1) Ask for a Google ID token for OUR server (the Web client ID).
                //    false = list every Google account on the phone, so new users can sign up too.
                val googleIdOption = GetGoogleIdOption.Builder()
                    .setServerClientId(serverClientId)
                    .setFilterByAuthorizedAccounts(false)
                    .setAutoSelectEnabled(false)
                    .apply { if (!nonce.isNullOrEmpty()) setNonce(nonce) }
                    .build()

                val request = GetCredentialRequest.Builder()
                    .addCredentialOption(googleIdOption)
                    .build()

                // 2) Shows the bottom sheet and suspends until the user picks an account or dismisses it.
                val result = CredentialManager.create(act).getCredential(act, request)

                // 3) Pull the Google ID token out of the result.
                val credential = result.credential
                if (credential is CustomCredential &&
                    credential.type == GoogleIdTokenCredential.TYPE_GOOGLE_ID_TOKEN_CREDENTIAL
                ) {
                    val google = GoogleIdTokenCredential.createFrom(credential.data)
                    val out = JSObject()
                    out.put("idToken", google.idToken)            // send THIS to your server
                    out.put("email", google.id)                   // for Google, id is the email
                    out.put("displayName", google.displayName ?: "")
                    out.put("givenName", google.givenName ?: "")
                    out.put("familyName", google.familyName ?: "")
                    out.put("photoUrl", google.profilePictureUri?.toString() ?: "")
                    call.resolve(out)
                } else {
                    call.reject("Unexpected sign-in result.", "FAILED")
                }
            } catch (e: GetCredentialCancellationException) {
                call.reject("cancelled", "CANCELLED")
            } catch (e: NoCredentialException) {
                call.reject("No Google account available on this phone.", "NO_ACCOUNT")
            } catch (e: GetCredentialException) {
                call.reject(e.message ?: "Google sign-in failed.", "FAILED")
            } catch (e: GoogleIdTokenParsingException) {
                call.reject("Could not read the Google sign-in.", "FAILED")
            } catch (e: Throwable) {
                // Never let a native problem close the app. The web layer falls back to the browser flow.
                call.reject(e.message ?: "Google sign-in failed.", "FAILED")
            }
        }
    }

    override fun handleOnDestroy() {
        scope.cancel()
        super.handleOnDestroy()
    }

    companion object {
        // Web client ID (type "Web application"). Must be the SAME ID your server checks in GOOGLE_CLIENT_ID.
        const val WEB_CLIENT_ID =
            "628050649968-umh0eflaigqqet517sj7te2oa9h0bsmq.apps.googleusercontent.com"
    }
}
