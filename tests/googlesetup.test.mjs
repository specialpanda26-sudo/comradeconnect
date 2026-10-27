import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const F = (n) => fs.readFileSync('frontend/' + n, 'utf8');

test('new Google account: the username prompt is forced, offers clean names, and Cancel continues', () => {
  const core = F('cc-core.js'), su = F('cc-setup.js');
  assert.ok(/if \(d\.created\)[^}]*cc_setup_new/.test(core), 'a created Google account must set the ask-now flag');
  assert.ok(su.includes("cc_setup_new") && su.includes("fresh ? 'Cancel'"), 'prompt must read the flag and offer Cancel');
  assert.ok(!/animal|funny|Math\.random\(\) \* ADJ/i.test(su), 'no joke-name generator');
  const ideas = su.match(/function ideas\(\)[\s\S]*?\n  }/)[0];
  assert.ok(ideas.includes("'comrade_'") && ideas.includes('gfirst'), 'suggestions come from the first name or comrade_ + digits');
});

test('dropdown panel opens in front of share and post forms', () => {
  const pk = F('cc-pick.js');
  assert.ok(/#ccpk\{position:fixed;inset:0;z-index:2147483000/.test(pk), 'panel must sit above every form (those use 9999)');
  assert.ok(pk.includes('.cxm select'), 'Past Papers and Lost and Found forms must use the glass panel');
  const html = F('index.html');
  assert.ok(/cc-pick\.js\?v=3/.test(html) && /cc-setup\.js\?v=4/.test(html) && /cc-live\.js\?v=(host)?4/.test(html));
});
