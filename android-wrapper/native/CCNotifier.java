package ke.co.comradeconnect.app;

import android.annotation.SuppressLint;
import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.os.Build;
import android.os.Bundle;
import android.service.notification.StatusBarNotification;

import androidx.core.app.NotificationCompat;
import androidx.core.app.NotificationManagerCompat;
import androidx.core.app.Person;

import org.json.JSONArray;
import org.json.JSONObject;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * Builds the phone notifications (cc-fix7): one group under the app, a summary line with a count,
 * chat-style (MessagingStyle) for anonymous messages, short title + text for everything else.
 * Channel id stays cc_alerts. Nothing here touches the network.
 */
final class CCNotifier {
    static final String CHANNEL = "cc_alerts";
    static final String GROUP = "cc_group";
    static final int SUMMARY_ID = 1;
    /** true while the app is on screen: then the in-app bell handles it and no banner is shown */
    static volatile boolean foreground = false;
    private static final String PREFS = "cc_notif";
    private static final String[] KEYS = {"view", "kind", "ref_type", "ref_id", "cid"};

    private CCNotifier() {}

    private static String g(Map<String, String> d, String k) {
        String v = d.get(k);
        return v == null ? "" : v;
    }

    static void channel(Context c) {
        if (Build.VERSION.SDK_INT < 26) return;
        NotificationManager nm = (NotificationManager) c.getSystemService(Context.NOTIFICATION_SERVICE);
        if (nm == null || nm.getNotificationChannel(CHANNEL) != null) return;
        NotificationChannel ch = new NotificationChannel(CHANNEL, "Comrade Connect alerts", NotificationManager.IMPORTANCE_HIGH);
        ch.setDescription("Orders, comments, live, events and app updates");
        ch.enableVibration(true);
        ch.enableLights(true);
        nm.createNotificationChannel(ch);
    }

    private static int icon(Context c) {
        int id = c.getResources().getIdentifier("ic_stat_cc", "drawable", c.getPackageName());
        return id != 0 ? id : android.R.drawable.ic_dialog_info;
    }

    private static PendingIntent tap(Context c, int reqCode, Map<String, String> d) {
        Intent in = new Intent(c, MainActivity.class);
        in.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_SINGLE_TOP | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        if (d != null) for (String k : KEYS) in.putExtra("cc_" + k, g(d, k));
        int flags = PendingIntent.FLAG_UPDATE_CURRENT | (Build.VERSION.SDK_INT >= 23 ? PendingIntent.FLAG_IMMUTABLE : 0);
        return PendingIntent.getActivity(c, reqCode, in, flags);
    }

    @SuppressLint("MissingPermission")
    static void show(Context c, Map<String, String> d) {
        NotificationManager nm = (NotificationManager) c.getSystemService(Context.NOTIFICATION_SERVICE);
        if (nm == null || !NotificationManagerCompat.from(c).areNotificationsEnabled()) return;
        channel(c);
        String kind = g(d, "kind"), title = g(d, "title"), body = g(d, "body"), cid = g(d, "cid"), rep = g(d, "rep");
        if (title.isEmpty()) title = "Comrade Connect";
        long ts;
        try { ts = Long.parseLong(g(d, "ts")); } catch (Exception e) { ts = System.currentTimeMillis(); }
        boolean chat = "message".equals(kind) && !cid.isEmpty();
        String key = chat ? cid : (!rep.isEmpty() ? rep : UUID.randomUUID().toString());
        int id = 100 + ((key.hashCode() & 0x3fffffff) % 900000);

        NotificationCompat.Builder b = new NotificationCompat.Builder(c, CHANNEL)
                .setSmallIcon(icon(c))
                .setColor(0xFF101422)
                .setAutoCancel(true)
                .setPriority(NotificationCompat.PRIORITY_HIGH)
                .setDefaults(NotificationCompat.DEFAULT_ALL)
                .setWhen(ts)
                .setShowWhen(true)
                .setGroup(GROUP)
                .setGroupAlertBehavior(NotificationCompat.GROUP_ALERT_CHILDREN)
                .setContentIntent(tap(c, id, d));

        int n = 1;
        String line;
        if (chat) {
            String sender = g(d, "sender");
            if (sender.isEmpty()) sender = "Anonymous";
            SharedPreferences sp = c.getSharedPreferences(PREFS, Context.MODE_PRIVATE);
            JSONArray hist = new JSONArray();
            try { hist = new JSONArray(sp.getString("h:" + cid, "[]")); } catch (Exception e) { /* start fresh */ }
            try { hist.put(new JSONObject().put("t", body).put("ts", ts)); } catch (Exception e) { /* ignore */ }
            JSONArray keep = new JSONArray();
            for (int i = Math.max(0, hist.length() - 7); i < hist.length(); i++) {
                try { keep.put(hist.get(i)); } catch (Exception e) { /* ignore */ }
            }
            sp.edit().putString("h:" + cid, keep.toString()).apply();
            Person me = new Person.Builder().setName("You").build();
            Person from = new Person.Builder().setName(sender).build();
            NotificationCompat.MessagingStyle ms = new NotificationCompat.MessagingStyle(me);
            for (int i = 0; i < keep.length(); i++) {
                JSONObject o = keep.optJSONObject(i);
                if (o != null) ms.addMessage(o.optString("t"), o.optLong("ts"), from);
            }
            n = keep.length();
            b.setStyle(ms).setContentTitle(sender).setContentText(body).setCategory(NotificationCompat.CATEGORY_MESSAGE);
            line = sender + ": " + body;
        } else {
            b.setContentTitle(title).setContentText(body).setStyle(new NotificationCompat.BigTextStyle().bigText(body));
            line = body.isEmpty() ? title : title + ": " + body;
        }
        Bundle ex = new Bundle();
        ex.putInt("cc_n", n);
        ex.putString("cc_line", line);
        b.addExtras(ex);
        try { nm.notify(id, b.build()); } catch (Exception e) { return; }
        summary(c, nm, id, n, line);
    }

    /** the one line that groups everything: "3 new notifications", expands to the individual ones */
    @SuppressLint("MissingPermission")
    private static void summary(Context c, NotificationManager nm, int skipId, int curN, String curLine) {
        int total = curN;
        List<String> lines = new ArrayList<>();
        lines.add(curLine);
        if (Build.VERSION.SDK_INT >= 23) {
            try {
                for (StatusBarNotification s : nm.getActiveNotifications()) {
                    if (s.getId() == SUMMARY_ID || s.getId() == skipId) continue;
                    Notification nt = s.getNotification();
                    if (nt == null || !GROUP.equals(nt.getGroup()) || nt.extras == null) continue;
                    total += Math.max(1, nt.extras.getInt("cc_n", 1));
                    String l = nt.extras.getString("cc_line");
                    if (l != null && lines.size() < 6) lines.add(l);
                }
            } catch (Exception e) { /* the count just stays smaller */ }
        }
        String text = total == 1 ? "1 new notification" : total + " new notifications";
        NotificationCompat.InboxStyle ib = new NotificationCompat.InboxStyle();
        for (String l : lines) ib.addLine(l);
        ib.setSummaryText(text);
        NotificationCompat.Builder sb = new NotificationCompat.Builder(c, CHANNEL)
                .setSmallIcon(icon(c))
                .setColor(0xFF101422)
                .setContentTitle("Comrade Connect")
                .setContentText(text)
                .setStyle(ib)
                .setNumber(total)
                .setGroup(GROUP)
                .setGroupSummary(true)
                .setAutoCancel(true)
                .setGroupAlertBehavior(NotificationCompat.GROUP_ALERT_CHILDREN)
                .setContentIntent(tap(c, SUMMARY_ID, null));
        try { nm.notify(SUMMARY_ID, sb.build()); } catch (Exception e) { /* ignore */ }
    }

    /** opening the app or the bell: take away every phone notification of the app and forget the chat history */
    static void clearAll(Context c) {
        try {
            NotificationManager nm = (NotificationManager) c.getSystemService(Context.NOTIFICATION_SERVICE);
            if (nm != null) nm.cancelAll();
            c.getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit().clear().apply();
        } catch (Exception e) { /* ignore */ }
    }
}
