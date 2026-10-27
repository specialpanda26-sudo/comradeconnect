package ke.co.comradeconnect.app;

import android.content.Intent;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/**
 * cc-fix7: the bridge between the phone notification and the web app.
 *  takeTap()  gives the screen the user asked for by tapping a notification (app was closed), once.
 *  ccTap      event, same data, when the app was already running.
 *  clear()    removes the app's phone notifications (the bell was opened).
 */
@CapacitorPlugin(name = "CCNotif")
public class CCNotifPlugin extends Plugin {
    private static CCNotifPlugin inst;
    private static JSObject pending;
    private static final String[] KEYS = {"view", "kind", "ref_type", "ref_id", "cid"};

    @Override
    public void load() {
        inst = this;
    }

    static void stash(Intent in) {
        if (in == null || !in.hasExtra("cc_view")) return;
        JSObject o = new JSObject();
        for (String k : KEYS) {
            String v = in.getStringExtra("cc_" + k);
            o.put(k, v == null ? "" : v);
            in.removeExtra("cc_" + k);
        }
        pending = o;
    }

    static void fire() {
        if (inst == null || pending == null) return;
        JSObject o = pending;
        pending = null;
        inst.notifyListeners("ccTap", o, true);
    }

    @PluginMethod
    public void takeTap(PluginCall call) {
        JSObject r = new JSObject();
        if (pending != null) {
            r.put("tap", pending);
            pending = null;
        }
        call.resolve(r);
    }

    @PluginMethod
    public void clear(PluginCall call) {
        CCNotifier.clearAll(getContext());
        call.resolve();
    }
}
