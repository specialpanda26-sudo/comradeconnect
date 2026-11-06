// Extras for scripts/referral-bot.mjs (additions only; the bot works without this file).
//  1. read an account's OWN referral link from the site before it logs out (page text > common pages > AI brain > best guess)
//  2. if that fails: log in again with the account's username + password, read it there, log out again
//  3. helpers for testing several referral links and level 2 (accounts created through the new accounts' own links)
const REF_PARAMS = ['ref', 'referral', 'referrer', 'referer', 'sponsor', 'invite', 'inviter', 'invitation', 'code', 'rc', 'r', 'aff', 'affiliate', 'upline', 'uid', 'refcode', 'ref_code', 'referral_code'];
const PATHS = ['/invite', '/referral', '/referrals', '/refer', '/team', '/affiliate', '/invite-friends', '/share', '/earn', '/me', '/profile', '/account', '/dashboard'];
const LOGIN_PATHS = ['/login', '/signin', '/sign-in', '/auth/login', '/account/login'];
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const memo = { goodPath: '', pathsFailed: 0 };

// the code inside a referral link: ?ref=CODE (or similar), or the last part of /ref/CODE
export function refCode(url) {
  try {
    const u = new URL(url);
    for (const k of REF_PARAMS) { const v = u.searchParams.get(k); if (v) return v; }
    const m = u.pathname.match(/\/(?:ref|r|invite|join|u|referral)\/([A-Za-z0-9_.-]{2,40})/i);
    return m ? m[1] : '';
  } catch (e) { return ''; }
}
const hasCode = (url) => !!refCode(url);

// every piece of text/URL on the page that could be a referral link
async function scanPage(page) {
  return page.evaluate(() => {
    const out = new Set();
    const add = (s) => { if (s && typeof s === 'string') out.add(s.slice(0, 400)); };
    for (const e of document.querySelectorAll('input,textarea')) add(e.value);
    for (const e of document.querySelectorAll('a[href]')) add(e.href);
    for (const e of document.querySelectorAll('[data-clipboard-text],[data-link],[data-url],[data-ref],[data-href],[data-share]')) for (const a of e.getAttributeNames()) if (/^data-/.test(a)) add(e.getAttribute(a));
    add(document.body ? document.body.innerText : '');
    return [...out];
  }).catch(() => []);
}
export async function findOwnLink(page, c) {
  const texts = await scanPage(page);
  const urls = [];
  for (const t of texts) for (const m of String(t).matchAll(/https?:\/\/[^\s"'<>)\]]+/g)) urls.push(m[0].replace(/[.,;]+$/, ''));
  const mine = String(c.username || '').toLowerCase();
  const site = c.siteHost || '';
  const good = [...new Set(urls)].filter((u) => hasCode(u) && /register|signup|sign-up|join|invite|ref/i.test(u));
  const score = (u) => (mine && u.toLowerCase().includes(mine) ? 4 : 0) + (site && u.includes(site) ? 2 : 0) + (/register|signup|sign-up|join/i.test(u) ? 1 : 0);
  good.sort((a, b) => score(b) - score(a));
  if (good.length && (!mine || score(good[0]) >= 2)) return { url: good[0], how: 'page' };
  // only a code is shown ("Referral code: ABC123"): build the link the same way as the link we started from
  const body = texts.join('\n');
  const m = body.match(/(?:referral|invite|sponsor|ref)\s*(?:code|id|link)?\s*[:：]\s*([A-Za-z0-9_-]{3,30})\b/i);
  if (m && c.template && m[1].toLowerCase() !== 'link') return { url: withCode(c.template, m[1]), how: 'code' };
  return null;
}
// the same link shape as the one we started from, with another code in it
export function withCode(template, code) {
  try {
    const u = new URL(template);
    for (const k of REF_PARAMS) if (u.searchParams.has(k)) { u.searchParams.set(k, code); return u.toString(); }
    const p = u.pathname.replace(/(\/(?:ref|r|invite|join|u|referral)\/)[A-Za-z0-9_.-]{2,40}/i, '$1' + code);
    if (p !== u.pathname) { u.pathname = p; return u.toString(); }
    u.searchParams.set('ref', code); return u.toString();
  } catch (e) { return ''; }
}

// c: { username, template, siteOrigin, siteHost, log(msg), brain, AI, person, goto(page,url) }
export async function capture(page, c) {
  const log = c.log || (() => {}), start = page.url();
  const back = async () => { try { if (page.url() !== start) await c.goto(page, start); } catch (e) {} };
  let found = await findOwnLink(page, c);
  if (found) return { ref_link: found.url, ref_source: found.how };
  if (!c.noPaths && memo.pathsFailed < 2) {                          // pages most sites use for "my referral link"
    const list = memo.goodPath ? [memo.goodPath, ...PATHS.filter((x) => x !== memo.goodPath)] : PATHS;
    for (const p of list) {
      try {
        const r = await page.goto(c.siteOrigin + p, { waitUntil: 'domcontentloaded', timeout: 9000 });
        if (r && r.status() >= 400) continue;
        await sleep(900);
        found = await findOwnLink(page, c);
        if (found) { memo.goodPath = p; memo.pathsFailed = 0; await back(); return { ref_link: found.url, ref_source: 'page ' + p }; }
      } catch (e) {}
    }
    memo.pathsFailed++;
    await back();
  }
  if (c.AI && c.brain) {                                              // the AI brain looks for the page by itself (Invite / Referrals / Me / Team ...)
    const w = await c.brain.agent(page, { goal: 'ref_link', person: c.person, cacheKey: 'ref_link', maxSteps: 5, noSubmit: true, verify: async () => !!(await findOwnLink(page, c)) });
    found = await findOwnLink(page, c);
    if (found) { await back(); return { ref_link: found.url, ref_source: 'AI brain' }; }
    if (w && w.note) log('referral link: AI note: ' + w.note);
    await back();
  }
  return { ref_link: '', ref_source: '' };
}

// best guess when the site shows no link at all: same link shape, this account's username as the code
export const guessLink = (template, username) => withCode(template, username);

const visible = (loc) => loc.isVisible().catch(() => false);
async function passwordShown(page) { return visible(page.locator('input[type=password]').first()); }
async function fillLogin(page, id, pass) {
  const user = page.locator('input:not([type=password]):not([type=hidden]):not([type=checkbox]):not([type=radio]):not([type=submit]):not([type=button])').first();
  const pw = page.locator('input[type=password]').first();
  if (!(await visible(user)) || !(await visible(pw))) return false;
  await user.fill(id, { timeout: 3000 }); await pw.fill(pass, { timeout: 3000 });
  const btn = page.getByRole('button', { name: /^\s*(log ?in|sign ?in|login|continue|submit)\s*$/i }).first();
  if (await visible(btn)) await btn.click({ timeout: 3000 }).catch(() => pw.press('Enter')); else await pw.press('Enter');
  await sleep(1500);
  return true;
}
// log the account in again. Returns true when the password box is gone afterwards.
export async function login(page, c) {
  const log = c.log || (() => {});
  const tries = [c.username, c.email, c.phone].filter(Boolean);
  const pick = async () => {
    if (await passwordShown(page)) return true;
    const l = page.getByRole('link', { name: /log ?in|sign ?in/i }).or(page.getByRole('button', { name: /log ?in|sign ?in/i })).first();
    if (await visible(l)) { await l.click({ timeout: 2500 }).catch(() => {}); await sleep(1000); if (await passwordShown(page)) return true; }
    for (const p of LOGIN_PATHS) {
      try { const r = await page.goto(c.siteOrigin + p, { waitUntil: 'domcontentloaded', timeout: 9000 }); if (r && r.status() < 400) { await sleep(800); if (await passwordShown(page)) return true; } } catch (e) {}
    }
    return false;
  };
  if (await pick()) {
    for (const id of tries) {
      try { if (!(await passwordShown(page)) && !(await pick())) break; await fillLogin(page, id, c.password); } catch (e) {}
      if (!(await passwordShown(page))) { log('logged in again with ' + (id === c.username ? 'username' : id === c.email ? 'email' : 'phone')); return true; }
    }
  }
  if (c.AI && c.brain) {
    const w = await c.brain.agent(page, { goal: 'login', person: c.person, cacheKey: 'login', maxSteps: 5, noSubmit: false, verify: async () => !(await passwordShown(page)) });
    if (w.ok) { log('logged in again (AI brain)'); return true; }
  }
  return false;
}
// capture failed before logout: log in again, read the link, log out again (c.logout() is the bot's own logout)
export async function relogCapture(page, c) {
  const ok = await login(page, c);
  if (!ok) return { ref_link: '', ref_source: '', relog: 'login failed', loggedOut: false };
  const got = await capture(page, c);
  const lo = await c.logout();
  return { ...got, ref_source: got.ref_link ? 'relogin ' + got.ref_source : '', relog: 'ok', loggedOut: !!lo };
}
