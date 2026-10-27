package ke.co.comradeconnect.app;

import android.content.Intent;
import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        // Local plugins are not auto-registered. This must come BEFORE super.onCreate.
        registerPlugin(GoogleSignInPlugin.class);
        registerPlugin(CCNotifPlugin.class);
        super.onCreate(savedInstanceState);
        CCNotifPlugin.stash(getIntent());   // app was closed and a notification was tapped
    }

    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        setIntent(intent);
        CCNotifPlugin.stash(intent);        // app was running and a notification was tapped
        CCNotifPlugin.fire();
    }

    @Override
    public void onStart() {
        super.onStart();
        CCNotifier.foreground = true;       // the in-app bell handles alerts while the app is open
        CCNotifier.clearAll(this);          // opening the app clears the phone notifications
    }

    @Override
    public void onStop() {
        super.onStop();
        CCNotifier.foreground = false;
    }
}
