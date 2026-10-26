package ke.co.comradeconnect.app;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        // Local plugins are not auto-registered. This must come BEFORE super.onCreate.
        registerPlugin(GoogleSignInPlugin.class);
        super.onCreate(savedInstanceState);
    }
}
