package ke.co.comradeconnect.app;

import com.google.firebase.messaging.FirebaseMessagingService;
import com.google.firebase.messaging.RemoteMessage;

import java.util.Map;

/**
 * cc-fix7: receives our data-only push messages (data.cc == "2").
 *  App closed or in the background: builds the grouped / chat-style notification itself.
 *  App open: shows nothing (the in-app bell handles it) and hands the message to the Capacitor push plugin,
 *            which tells the web app to refresh the bell.
 * Anything else, and new tokens, go to the Capacitor push plugin exactly as before.
 */
public class CCMessagingService extends FirebaseMessagingService {
    @Override
    public void onMessageReceived(RemoteMessage message) {
        Map<String, String> d = message.getData();
        if (d != null && "2".equals(d.get("cc"))) {
            // cc-fix10: every alert goes to the notification bar, also while the app is open
            try { CCNotifier.show(this, d); } catch (Throwable e) { /* never crash the push service */ }
            if (CCNotifier.foreground) forward("sendRemoteMessage", RemoteMessage.class, message);
            return;
        }
        forward("sendRemoteMessage", RemoteMessage.class, message);
    }

    @Override
    public void onNewToken(String token) {
        super.onNewToken(token);
        forward("onNewToken", String.class, token);
    }

    private static void forward(String method, Class<?> type, Object arg) {
        try {
            Class.forName("com.capacitorjs.plugins.pushnotifications.PushNotificationsPlugin").getMethod(method, type).invoke(null, arg);
        } catch (Throwable e) { /* the plugin is not ready: the app refreshes by itself when opened */ }
    }
}
