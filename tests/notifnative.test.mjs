import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const R = (p) => fs.readFileSync(p, 'utf8');

test('native notifications: channel id stays cc_alerts, group + summary + MessagingStyle are built', () => {
  const j = R('android-wrapper/native/CCNotifier.java');
  assert.ok(j.includes('CHANNEL = "cc_alerts"'));
  assert.ok(j.includes('setGroupSummary(true)') && j.includes('new NotificationCompat.InboxStyle()') && j.includes('new NotificationCompat.MessagingStyle('));
  assert.ok(j.includes('new notifications'));
  assert.ok(j.includes('static volatile boolean foreground'), 'no banner while the app is open');
});

test('native notifications: the service only builds our own data-only messages and passes the rest to the Capacitor plugin', () => {
  const j = R('android-wrapper/native/CCMessagingService.java');
  assert.ok(j.includes('"2".equals(d.get("cc"))') && j.includes('!CCNotifier.foreground'));
  assert.ok(j.includes('PushNotificationsPlugin') && j.includes('sendRemoteMessage') && j.includes('onNewToken'));
});

test('native notifications: MainActivity registers the plugin, clears on open, hands taps to the web app', () => {
  const j = R('android-wrapper/native/MainActivity.java');
  assert.ok(j.includes('registerPlugin(GoogleSignInPlugin.class)') && j.includes('registerPlugin(CCNotifPlugin.class)'));
  assert.ok(j.includes('CCNotifier.clearAll(this)') && j.includes('CCNotifPlugin.stash(') && j.includes('CCNotifPlugin.fire()'));
});

test('prepare.py registers the service (priority 100, plugin one removed) only when Firebase is on', () => {
  const p = R('android-wrapper/prepare.py');
  assert.ok(p.includes('def patch_notif_native') && p.includes('patch_notif_icon(); patch_notif_native(); icons()'));
  assert.ok(p.includes('android:priority') && p.includes('tools:node') && p.includes('google-services.json'));
});
