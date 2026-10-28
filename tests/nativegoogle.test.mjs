import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const R = (p) => fs.readFileSync(p, 'utf8');
const WEB = '628050649968-umh0eflaigqqet517sj7te2oa9h0bsmq.apps.googleusercontent.com';

test('native sheet: Credential Manager with GetGoogleIdOption and the Web client ID', () => {
  const kt = R('android-wrapper/native/GoogleSignInPlugin.kt');
  assert.ok(kt.includes('GetGoogleIdOption.Builder()') && kt.includes('.setServerClientId(serverClientId)'));
  assert.ok(kt.includes(WEB), 'default Web client ID must be in the plugin');
  assert.ok(kt.includes('GoogleIdTokenCredential.createFrom(credential.data)') && kt.includes('google.idToken'));
  assert.ok(kt.includes('GetSignInWithGoogleOption'), 'retry with the Sign in with Google sheet when no credential is found');
  assert.ok(kt.includes('CANCELLED') && kt.includes('NO_ACCOUNT'));
});

test('the same Web client ID is used by the website, the app config and the plugin', () => {
  for (const f of ['frontend/config.js', 'frontend/app/config.js']) {
    const c = R(f);
    assert.ok(c.includes("CC_GOOGLE_ID = '" + WEB + "'"), f + ' has a different Web client ID');
    assert.ok(/CC_NATIVE_GOOGLE\s*=\s*true/.test(c), f + ' must turn the native sheet on');
  }
});

test('when the sheet cannot open, the real reason is kept and shown, then the browser tab is used', () => {
  const js = R('frontend/cc-native.js');
  assert.ok(js.includes('cc-native-why') && js.includes('lastGoogleError') && js.includes('cc_g_why'));
  assert.ok(js.indexOf('cc-native-why') < js.indexOf('return browserGoogle();', js.indexOf('cc-native-why')));
  assert.ok(/CANCELLED[^]*cancelled: true/.test(js), 'swiping the sheet away must stay a cancel');
});

test('Render lets the Android app (https://localhost) call the API', () => {
  assert.ok(R('render.yaml').includes('https://localhost'));
  assert.ok(R('RENDER.md').includes('https://localhost'));
});
