// Referral bot for spaceXBot (browser version).
// Opens a live referral link in a real headless browser. The Sponsor box fills itself from that link; the bot checks
// that it did, then fills the Create Account form with random details, ticks the terms box and presses Create Account.
// On the welcome card it presses Continue, closes the Telegram-bonus popup (Later, else X), logs the account out,
// and repeats for as many accounts as you ask. At the end it writes a report, and for every failure it tells you
// what the problem probably is and what to check.
//
//   node scripts/referral-bot.mjs                                  the bot asks you for the link and how many accounts
//   node scripts/referral-bot.mjs "<referral link>" --dry          only look at the page: screenshot, fields, early warnings
//   node scripts/referral-bot.mjs "<referral link>" 5 --headed     5 accounts, watch the browser work
//   node scripts/referral-bot.mjs "<referral link>" 40 --yes       40 accounts on a live (non-local) site
//
// Options: --headed  --dry  --yes  --delay=1500 (ms between accounts)  --parallel=2 (max 5)
//          --pass=MyPass#1  --domain=yourdomain.com (email domain for the test accounts, default example.com)
//          --fresh (a brand-new browser profile for every account instead of logging out between accounts)
// Output:  referral-bot-out/  (report.txt, accounts.csv, accounts.json, page.png, filled.png, fail-N.png)

import fs from 'node:fs';
import readline from 'node:readline/promises';

let chromium;
try { ({ chromium } = await import('playwright')); }
catch { console.log('\nPlaywright is not installed. Run these two commands, then try again:\n  npm i -D playwright\n  npx playwright install chromium\n'); process.exit(1); }

const args = process.argv.slice(2);
const flag = (n) => args.includes('--' + n);
const opt = (n, d) => { const a = args.find((x) => x.startsWith('--' + n + '=')); return a ? a.slice(n.length + 3) : d; };
const DELAY = Math.max(0, parseInt(opt('delay', '1500'), 10) || 0);
const PAR = Math.max(1, Math.min(5, parseInt(opt('parallel', '1'), 10) || 1));
const DOMAIN = opt('domain', 'example.com');
const FRESH = flag('fresh');
const COUNTRY = opt('country', 'Kenya');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const ask = async (q) => { const rl = readline.createInterface({ input: process.stdin, output: process.stdout }); const a = (await rl.question(q)).trim(); rl.close(); return a; };
const tty = !!process.stdin.isTTY;

// the link and the number of accounts: from the command line, or the bot asks you
let link = args.find((a) => /^https?:\/\//i.test(a));
const numArg = args.find((a) => /^\d+$/.test(a));
if (!link && !tty) { console.log('\nUsage: node scripts/referral-bot.mjs "<referral link>" [count] [--dry] [--headed] [--yes]\n'); process.exit(1); }
if (!link) link = (await ask('\nPaste your referral link: ')).replace(/^["']|["']$/g, '');
if (!/^https?:\/\//i.test(link)) { console.log('\nThat is not a link (it must start with https://).\n'); process.exit(1); }
let N = parseInt(numArg, 10);
if (!N && !flag('dry') && tty) N = parseInt(await ask('How many accounts should the bot create? (1-200): '), 10);
N = Math.max(1, Math.min(200, N || 5));

const host = new URL(link).hostname;
const local = /^(localhost|127\.|192\.168\.|10\.)/.test(host);
if (!flag('dry') && !local && !flag('yes')) {
  console.log(`\nThis is a LIVE site (${host}). Every account the bot creates is real and may receive the signup bonus.`);
  if (!tty || (await ask(`Type YES to create ${N} real accounts there: `)).toUpperCase() !== 'YES') { console.log('Cancelled. (Use --yes to skip this question.)\n'); process.exit(1); }
}

const OUT = 'referral-bot-out';
fs.mkdirSync(OUT, { recursive: true });

// ---------- random people ----------
const rnd = (n) => Math.random().toString(36).slice(2, 2 + n);
const digits = (n) => Array.from({ length: n }, () => Math.floor(Math.random() * 10)).join('');
const pick = (a) => a[Math.floor(Math.random() * a.length)];
const FIRST = ['James', 'Mary', 'Ali', 'Grace', 'Peter', 'Amina', 'Daniel', 'Faith', 'Brian', 'Zawadi', 'Kevin', 'Linet', 'Samuel', 'Naomi'];
const LAST = ['Otieno', 'Smith', 'Kamau', 'Hassan', 'Wanjiru', 'Brown', 'Mwangi', 'Omar', 'Achieng', 'Jones', 'Njoroge', 'Patel'];
const PASS = opt('pass', 'Sim' + rnd(5) + '#7');
function person() {
  const first = pick(FIRST), last = pick(LAST), user = ('sim_' + first + rnd(5)).toLowerCase();
  return { name: first + ' ' + last, user, email: user + '@' + DOMAIN, phone: '7' + digits(/kenya/i.test(COUNTRY) ? 8 : 9) };   // every test username starts with sim_
}

// ---------- reading the form ----------
const SEL = 'input, select, textarea';
async function describe(page) {
  return page.$$eval(SEL, (els) => els.map((el, i) => {
    const r = el.getBoundingClientRect(), cs = getComputedStyle(el);
    let label = [...(el.labels || [])].map((l) => l.innerText).join(' ');
    for (let p = el.parentElement, k = 0; !label && p && k < 3; p = p.parentElement, k++) {
      const l = p.querySelector('label');
      if (l && p.querySelectorAll('input,select,textarea').length <= 2) label = l.innerText;
    }
    return {
      i, tag: el.tagName.toLowerCase(), type: (el.type || '').toLowerCase(), name: el.name || '', id: el.id || '',
      ph: el.placeholder || '', aria: el.getAttribute('aria-label') || '', label, value: el.value || '',
      visible: r.width > 0 && r.height > 0 && cs.visibility !== 'hidden' && cs.display !== 'none',
    };
  }));
}
function assign(fields) {
  const roles = {}, used = new Set();
  const text = (f) => [f.label, f.name, f.id, f.ph, f.aria].join(' ').toLowerCase();
  const pool = fields.filter((f) => f.visible || f.type === 'checkbox');
  const take = (role, test) => { const f = pool.find((x) => !used.has(x.i) && test(x)); if (f) { roles[role] = f; used.add(f.i); } };
  take('terms', (f) => f.type === 'checkbox');
  take('country', (f) => f.tag === 'select');
  take('sponsor', (f) => /sponsor|referr|invit|upline|\bref\b/.test(text(f)));
  take('confirm', (f) => f.type === 'password' && /confirm|repeat|again|retype/.test(text(f)));
  take('password', (f) => f.type === 'password');
  if (!roles.confirm) take('confirm', (f) => f.type === 'password');
  take('email', (f) => f.type === 'email' || /e-?mail/.test(text(f)));
  take('phone', (f) => f.type === 'tel' || /mobile|phone/.test(text(f)));
  take('username', (f) => /user\s*-?name/.test(text(f)));
  take('name', (f) => /name/.test(text(f)));
  return roles;
}

// ---------- page helpers ----------
async function openForm(page) {
  await page.waitForLoadState('networkidle', { timeout: 8000 }).catch(() => {});
  const pw = page.locator('input[type=password]').first();
  if (await pw.isVisible().catch(() => false)) return;
  const go = page.getByRole('link', { name: /create account|sign ?up|register|join/i })
    .or(page.getByRole('button', { name: /create account|sign ?up|register|join/i })).first();
  if (await go.count()) { await go.click().catch(() => {}); }
  await page.waitForSelector('input[type=password]', { state: 'visible', timeout: 6000 }).catch(() => {});
}
async function sponsorConfirmText(page) {
  return page.evaluate(() => {
    const e = [...document.querySelectorAll('body *')].find((x) => !/^(SCRIPT|STYLE|NOSCRIPT)$/.test(x.tagName) && x.children.length === 0 && x.getClientRects().length > 0 && /^\s*[✓✔]/.test(x.textContent));
    return e ? e.textContent.trim() : '';
  }).catch(() => '');
}
async function hasCaptcha(page) {
  return page.evaluate(() => !!document.querySelector('iframe[src*=recaptcha],iframe[src*=hcaptcha],iframe[src*=turnstile],.g-recaptcha,.h-captcha,.cf-turnstile,[class*=captcha i],[id*=captcha i]')).catch(() => false);
}
// Ticks "I accept the Terms & Privacy Policy" and confirms it really is ticked (works for plain and custom-styled boxes).
async function tickTerms(page, roles) {
  const cands = [];
  if (roles.terms) cands.push(page.locator(SEL).nth(roles.terms.i));
  cands.push(page.getByRole('checkbox', { includeHidden: true }).first());
  for (const box of cands) {
    if (!(await box.count().catch(() => 0))) continue;
    const on = () => box.isChecked().catch(() => false);
    await box.scrollIntoViewIfNeeded({ timeout: 1500 }).catch(() => {});
    if (await on()) return true;
    await box.setChecked(true, { force: true, timeout: 3000 }).catch(() => {});
    if (await on()) return true;
    await box.evaluate((el) => el.click()).catch(() => {});                                   // hidden native box behind a styled square
    if (await on()) return true;
    await box.locator('xpath=ancestor::label[1]').click({ position: { x: 6, y: 6 }, timeout: 2000 }).catch(() => {});   // left edge, so the Terms link is not opened
    if (await on()) return true;
  }
  return false;
}

// ---------- after the sign-up: welcome card, Continue, popup, logout ----------
// The success page: "welcome, <username>" with the YOUR LOGIN DETAILS card.
async function readWelcome(page) {
  const seen = await page.getByText(/your login details|welcome,/i).first().waitFor({ state: 'visible', timeout: 8000 }).then(() => true).catch(() => false);
  if (!seen) return null;
  const txt = await page.evaluate(() => document.body.innerText).catch(() => '');
  const lines = txt.split('\n').map((l) => l.trim()).filter(Boolean);
  const after = (label) => { const i = lines.findIndex((l) => l.toLowerCase() === label); return i >= 0 ? (lines[i + 1] || '') : ''; };
  return { head: (txt.match(/welcome,\s*([^\s]+)/i) || [])[1] || '', user: after('username'), pass: after('password') };
}
async function pressContinue(page) {
  const c = page.getByRole('button', { name: /^\s*continue\s*$/i }).or(page.getByRole('link', { name: /^\s*continue\s*$/i })).first();
  if (!(await c.isVisible().catch(() => false))) return false;
  return c.click({ timeout: 4000 }).then(() => true).catch(() => false);
}
// The "Telegram bonus - join our channel and get 5 USD" panel (or any popup in the way): press Later, else X, else Escape.
async function dismissBarrier(page) {
  const pressed = [];
  const barrier = page.getByText(/telegram|join our channel|get 5 usd/i).first();
  const dialog = page.locator('[role=dialog],[aria-modal=true]').first();
  const vis = (l) => l.isVisible().catch(() => false);
  await barrier.waitFor({ state: 'visible', timeout: 3500 }).catch(() => {});
  for (let round = 0; round < 3; round++) {
    if (!((await vis(barrier)) || (await vis(dialog)))) break;
    const scope = (await vis(dialog)) ? dialog : page;
    const laterRx = /^\s*(later|maybe later|not now|skip|no,? thanks|remind me later)\s*$/i;
    const later = scope.getByRole('button', { name: laterRx }).or(scope.getByRole('link', { name: laterRx })).or(scope.getByText(laterRx)).first();
    if (await vis(later)) { await later.click({ timeout: 3000 }).catch(() => {}); pressed.push('Later'); await sleep(700); continue; }
    const xRx = /^\s*(x|×|✕|✖|close|dismiss)\s*$/i;
    const x = scope.getByRole('button', { name: xRx }).or(scope.locator('[aria-label*=close i],[aria-label*=dismiss i]')).or(scope.getByText(xRx)).first();
    if (await vis(x)) { await x.click({ timeout: 3000 }).catch(() => {}); pressed.push('X'); await sleep(700); continue; }
    // an X drawn as an icon with no name: click the small button in the popup's top-right corner
    const spot = await page.evaluate(() => {
      const t = [...document.querySelectorAll('body *')].find((e) => !/^(SCRIPT|STYLE|NOSCRIPT)$/.test(e.tagName) && e.children.length === 0 && e.getClientRects().length > 0 && /telegram|join our channel/i.test(e.textContent));
      if (!t) return null;
      let box = t;
      for (let i = 0; i < 8 && box.parentElement; i++) { box = box.parentElement; const r = box.getBoundingClientRect(); if (r.width > 200 && r.height > 120 && box.querySelector('button,[role=button],svg')) break; }
      const b = box.getBoundingClientRect();
      const c = [...box.querySelectorAll('button,[role=button],svg,a')].map((e) => { const r = e.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2, w: r.width, h: r.height, t: (e.textContent || '').trim() }; })
        .filter((k) => k.w > 0 && k.w < 64 && k.h < 64 && k.t.length <= 2 && k.x > b.left + b.width * 0.7 && k.y < b.top + b.height * 0.3)
        .sort((a, z) => (z.x - a.x) || (a.y - z.y));
      return c[0] ? { x: c[0].x, y: c[0].y } : null;
    }).catch(() => null);
    if (spot) { await page.mouse.click(spot.x, spot.y); pressed.push('X'); await sleep(700); continue; }
    await page.keyboard.press('Escape'); pressed.push('Esc'); await sleep(600);
  }
  return { pressed, stuck: await vis(barrier) };
}
// Logs the account out: looks for a Logout button, opens menus if it is hidden, confirms if asked. Falls back to clearing the session.
async function logout(page) {
  const outRx = /log ?out|sign ?out/i;
  const find = () => page.getByRole('button', { name: outRx }).or(page.getByRole('link', { name: outRx })).or(page.getByRole('menuitem', { name: outRx })).or(page.getByText(/^\s*(log ?out|sign ?out)\s*$/i)).first();
  const vis = (l) => l.isVisible().catch(() => false);
  let btn = find();
  if (!(await vis(btn))) {
    const openers = [
      page.getByRole('button', { name: /menu|profile|account|settings|more|user/i }),
      page.locator('[aria-label*=menu i],[aria-label*=profile i],[aria-label*=account i],[aria-label*=settings i],[aria-label*=user i]'),
      page.getByRole('link', { name: /profile|account|settings|more/i }),
      page.getByText(/^\s*(me|profile|account|settings|more|menu)\s*$/i),
    ];
    outer: for (const o of openers) {
      const k = Math.min(await o.count().catch(() => 0), 3);
      for (let i = 0; i < k; i++) {
        await o.nth(i).click({ timeout: 1500 }).catch(() => {});
        await sleep(600);
        if (await vis(find())) { btn = find(); break outer; }
      }
    }
  }
  let how = 'no Logout button found';
  if (await vis(btn)) {
    await btn.click({ timeout: 3000 }).catch(() => {});
    await sleep(700);
    const sure = page.getByRole('dialog').getByRole('button', { name: /^\s*(yes|confirm|ok|log ?out|sign ?out)\s*$/i }).first();
    if (await vis(sure)) await sure.click({ timeout: 3000 }).catch(() => {});
    const out = (await page.locator('input[type=password]').first().waitFor({ state: 'visible', timeout: 7000 }).then(() => true).catch(() => false))
      || (await vis(page.getByRole('button', { name: /log ?in|sign ?in|create account/i }).first()));
    if (out) return { ok: true, how: 'Logout button' };
    how = 'pressed Logout but the login page did not appear';
  }
  await page.context().clearCookies();                                                      // fallback so the next account still starts clean
  await page.evaluate(() => { try { localStorage.clear(); sessionStorage.clear(); } catch (e) {} }).catch(() => {});
  return { ok: false, how };
}

// After logging out: type the referral link into the browser again and check the Sponsor box fills itself again.
async function reopenLink(page) {
  try {
    await page.goto(link, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await openForm(page);
    await sleep(1200);
    const f = assign(await describe(page));
    return !!(f.sponsor && f.sponsor.value);
  } catch (e) { return false; }
}

// Picks a country (the site rejects the form with "Please select your country" otherwise). United Kingdom if offered, else the first real option.
async function chooseCountry(page, roles) {
  const name = COUNTRY.replace(/[^a-z ]/gi, '').trim() || 'Kenya';
  const rx = new RegExp(name, 'i'), exact = new RegExp('^\\s*' + name + '\\s*$', 'i');
  try {
    if (roles.country) {
      const sel = page.locator(SEL).nth(roles.country.i);
      const opts = await sel.locator('option').evaluateAll((o) => o.map((x) => ({ v: x.value, t: x.textContent.trim() })));
      const want = opts.find((o) => o.v && exact.test(o.t)) || opts.find((o) => o.v && rx.test(o.t)) || opts.find((o) => o.v && !/select|choose/i.test(o.t));
      if (want) { await sel.selectOption(want.v, { timeout: 3000 }); return want.t; }
    }
    const cb = page.getByRole('combobox').or(page.getByRole('button', { name: /country/i })).first();   // a custom dropdown instead of a real select
    if (await cb.isVisible().catch(() => false)) {
      await cb.click({ timeout: 2000 });
      const opt = page.getByRole('option', { name: rx }).or(page.getByText(exact)).first();
      if (await opt.isVisible().catch(() => false)) { await opt.click({ timeout: 2000 }); return name; }
    }
  } catch (e) {}
  return '';
}

// ---- diagnose: turns what the bot saw into a plain-English problem and a fix ----
const RULES = [
  { code: 'rate_limit', test: (x) => x.status === 429 || /too many|rate.?limit|slow down|try again (later|in)|temporarily/.test(x.text),
    why: 'The site is limiting how many sign-ups it accepts from one device or IP.',
    fix: 'That is your protection working. Raise the gap (--delay=8000), create fewer accounts per run, or relax the limit on a test copy of the site.' },
  { code: 'blocked', test: (x) => x.status === 401 || x.status === 403,
    why: 'The server or its firewall (for example Cloudflare) refused the request.',
    fix: 'Check the firewall / bot-protection rules. Allow your own IP while testing, or test on a copy of the site.' },
  { code: 'captcha', test: (x) => /captcha|robot|human/.test(x.text) || (x.captcha && !x.post),
    why: 'A captcha (robot check) is in the way, and bots cannot pass it.',
    fix: 'Test on a copy of the site with the captcha switched off, or give the test server a bypass key.' },
  { code: 'server_error', test: (x) => x.status >= 500,
    why: 'The site crashed while creating the account (a bug in the sign-up code or the database).',
    fix: 'Open the server logs (Render or your host) for that moment. The message saved in accounts.csv is the clue.' },
  { code: 'country', test: (x) => /select your country|choose your country|country is required|select a country/.test(x.text),
    why: 'The site says no country was selected.',
    fix: 'Send me a screenshot of the Country box opened. If it is a custom dropdown I will match how it opens.' },
  { code: 'duplicate', test: (x) => x.status === 409 || /already|taken|exists|in use|duplicate/.test(x.text),
    why: 'The site says the username, email or phone is already used.',
    fix: 'Run again (the bot makes new random values each time). If it keeps happening, the site may treat all test emails or phone numbers as the same person.' },
  { code: 'sponsor', test: (x) => /sponsor|referr|upline|invite|invalid code/.test(x.text),
    why: 'The site rejected the sponsor / referral code.',
    fix: 'Open the same link in your own browser: the Sponsor box should show the sponsor name with a green tick. Check the sponsor account is active.' },
  { code: 'phone', test: (x) => /phone|mobile|msisdn/.test(x.text),
    why: 'The mobile number was refused (wrong format for the chosen country).',
    fix: 'The bot uses a UK-style number after +44. If your site only accepts real operator ranges or another country, tell me the country and I will match it.' },
  { code: 'email', test: (x) => /e-?mail|disposable|domain/.test(x.text),
    why: 'The email was refused (the bot uses @' + DOMAIN + ').',
    fix: 'Some sites block example.com or demand a real inbox. Run with --domain=yourdomain.com (a domain you own).' },
  { code: 'password', test: (x) => /password|passcode/.test(x.text),
    why: 'The password was refused by the site rules.',
    fix: 'Run with a stronger one: --pass=Strong#Pass2026' },
  { code: 'terms', test: (x) => /terms|accept|agree|policy|consent/.test(x.text),
    why: 'The site says the terms were not accepted.',
    fix: 'Open filled.png: is the terms box really ticked? If the box looks ticked, tell me and I will change how the bot ticks it.' },
  { code: 'verification', test: (x) => /verif|otp|one.?time|confirm your/.test(x.text),
    why: 'The site wants an email or SMS code before it finishes creating the account.',
    fix: 'Not necessarily a bug. Bots cannot read codes, so test this on a copy where verification is switched off.' },
  { code: 'validation', test: (x) => x.status === 400 || x.status === 422,
    why: 'The server refused the form data (validation).',
    fix: 'Read the message saved in accounts.csv and look at fail-N.png for red fields.' },
  { code: 'http_error', test: (x) => x.status >= 400,
    why: 'The server answered with an error.',
    fix: 'Read the status and message saved in accounts.csv.' },
];
function diagnose(e) {
  if (e.loadError) return { code: 'unreachable', why: `The bot could not open the link (${e.loadError}).`, fix: 'Open the same link in your own browser. Check the site is online, the link is spelled right, and your internet works.' };
  if (e.stillLoggedIn) return { code: 'still_logged_in', why: 'The previous account was still logged in, so the sign-up page did not show.', fix: 'The logout did not work. Send me a screenshot of the logged-in page showing where Logout is, or run with --fresh.' };
  if (e.noForm) return { code: 'no_form', why: 'The Create Account form did not show up, or the bot could not recognise its fields.', fix: 'Look at referral-bot-out/page.png. If it shows a login page, a popup, a cookie banner or an "enter" button, tell me and I will add that step.' };
  if (e.noButton) return { code: 'no_button', why: 'The bot could not find the Create Account button.', fix: 'Look at filled.png / fail-N.png. If the button has another name, tell me what it says.' };
  if (e.crash) return { code: 'bot_error', why: `The bot stumbled while filling the form (${e.crash}).`, fix: 'Run once with --headed and watch where it stops, then send me that message.' };
  const x = { status: e.post && e.post.status, text: (((e.post && e.post.body) || '') + ' ' + (e.err || '')).toLowerCase(), captcha: e.captcha, post: e.post };
  for (const r of RULES) if (r.test(x)) return { code: r.code, why: r.why, fix: r.fix };
  if (e.failedReq) return { code: 'network', why: `The sign-up request never reached the server (${e.failedReq}).`, fix: 'The site may be down or overloaded, or the browser blocked the request (CORS / firewall). Check the site is online and the server logs.' };
  if (e.clickFailed) return { code: 'click_blocked', why: 'Something covers the Create Account button (a popup or cookie banner), so it could not be pressed.', fix: 'Look at fail-N.png and tell me what is covering it.' };
  if (e.btnDisabled) return { code: 'button_disabled', why: 'Create Account stayed greyed out: the site thinks a field is invalid or something is not accepted.', fix: 'Look at filled.png for a red field or an unticked box. Often the mobile number format or the username rules.' };
  if (e.pageErrors && e.pageErrors.length) return { code: 'page_error', why: `The page itself threw a JavaScript error (${e.pageErrors[0]}).`, fix: 'That is a bug in the site front-end. Send me that message.' };
  if (!e.moved) return { code: 'no_response', why: 'Pressing Create Account did nothing: no request was sent and no message appeared.', fix: 'The form\'s own checks blocked it silently. Look at fail-N.png for a red field.' };
  return { code: 'unknown', why: 'The account did not seem to be created, but the bot cannot tell why.', fix: 'Run with --headed and watch, then send me what you see.' };
}
// ---- end diagnose ----

// ---------- one visit = one new account ----------
async function visit(browser, n, dry, shared) {
  const ctx = shared || await browser.newContext({ viewport: { width: 390, height: 1000 } });   // shared = same browser session for every account (logs out in between); otherwise a brand-new visitor
  const page = await ctx.newPage();
  const p = person();
  const rec = { n, username: p.user, email: p.email, phone: p.phone, password: PASS, sponsor: '', sponsor_filled: false, terms: false, welcome: false, continued: false, popup: '', loggedOut: false, relinked: false, ok: false, problem: '', why: '', fix: '', raw: '', warn: '', api: '' };
  const ev = { pageErrors: [] };
  let post = null, failedReq = null, phase = 'load';
  page.on('response', async (r) => {
    const q = r.request();
    if (!post && q.method() === 'POST' && ['fetch', 'xhr'].includes(q.resourceType())) {
      post = { url: new URL(r.url()).pathname, status: r.status(), body: (await r.text().catch(() => '')).slice(0, 300) };
    }
  });
  page.on('requestfailed', (q) => { if (q.method() === 'POST') failedReq = `${new URL(q.url()).pathname}: ${(q.failure() || {}).errorText || 'failed'}`; });
  page.on('pageerror', (e) => { if (ev.pageErrors.length < 3) ev.pageErrors.push(String(e.message).split('\n')[0].slice(0, 90)); });
  try {
    await page.goto(link, { waitUntil: 'domcontentloaded', timeout: 30000 });
    phase = 'form';
    await openForm(page);
    await sleep(1200);                                   // let the sponsor field auto-fill itself from the link
    const roles = assign(await describe(page));
    rec.sponsor = roles.sponsor ? roles.sponsor.value : '';
    rec.sponsor_filled = !!rec.sponsor;
    ev.captcha = await hasCaptcha(page);
    const who = await sponsorConfirmText(page);
    if (n === 1) await page.screenshot({ path: `${OUT}/page.png`, fullPage: true });

    if (dry) {
      console.log('\nFields the bot found on the page:');
      for (const [role, f] of Object.entries(roles)) console.log(`  ${role.padEnd(9)} ${(f.label || f.ph || f.name || f.id || f.type).replace(/\s+/g, ' ').slice(0, 28).padEnd(28)} type=${f.type}${f.value ? '  value="' + f.value + '"' : ''}`);
      const missing = ['name', 'username', 'email', 'phone', 'password', 'confirm', 'sponsor', 'terms'].filter((r) => !roles[r]);
      console.log(`\nSponsor box: ${rec.sponsor ? '"' + rec.sponsor + '" (auto-filled from the link)' : 'EMPTY'}${who ? '   ' + who : ''}`);
      const early = [];
      if (missing.length) early.push('Fields not found: ' + missing.join(', ') + ' (bot may not be able to fill the form)');
      if (!rec.sponsor) early.push('The Sponsor box is empty, so the link is not filling it: referrals could not be credited.');
      if (ev.captcha) early.push('A captcha is on the page: the bot will not be able to finish sign-ups.');
      console.log(early.length ? '\nPossible problems spotted before running:\n  - ' + early.join('\n  - ') : '\nNo problems spotted. The bot should be able to create accounts here.');
      console.log(`\nScreenshot saved: ${OUT}/page.png\n`);
      return rec;
    }

    if (!['email', 'password', 'username'].every((r) => roles[r])) {
      ev.noForm = true;
      ev.stillLoggedIn = n > 1 && !!shared && await page.getByRole('button', { name: /log ?out|sign ?out/i }).or(page.getByText(/balance|dashboard|welcome back/i)).first().isVisible().catch(() => false);
      throw new Error('form not recognised');
    }
    phase = 'fill';
    const at = (f) => page.locator(SEL).nth(f.i);
    await chooseCountry(page, roles);                      // choose the country first: the site sets the phone code from it
    await sleep(500);
    for (const [role, val] of [['name', p.name], ['username', p.user], ['email', p.email], ['phone', p.phone], ['password', PASS], ['confirm', PASS]]) {
      if (!roles[role]) continue;
      let v = val;
      if (role === 'phone') { const cur = await at(roles.phone).inputValue().catch(() => ''); let pre = (cur.match(/^\+\d{1,4}/) || [''])[0]; if (/kenya/i.test(COUNTRY) && pre && pre !== '+254') pre = '+254'; v = pre + p.phone; }   // keep the dial code the site typed (+254 for Kenya)
      await at(roles[role]).fill(v);
    }
    rec.terms = await tickTerms(page, roles);              // tick the terms box, then press Create Account
    await sleep(600);
    if (n === 1) await page.screenshot({ path: `${OUT}/filled.png`, fullPage: true });

    phase = 'submit';
    const btn = page.getByRole('button', { name: /create account|sign ?up|register/i }).last();
    if (!(await btn.count())) { ev.noButton = true; throw new Error('no button'); }
    ev.btnDisabled = await btn.isDisabled().catch(() => false);
    const start = page.url();
    post = null; failedReq = null;
    if (!ev.btnDisabled) ev.clickFailed = !(await btn.click({ timeout: 8000 }).then(() => true).catch(() => false));
    ev.moved = await page.waitForFunction((u) => location.href !== u || !document.querySelector('input[type=password]'), start, { timeout: 12000 }).then(() => true).catch(() => false);
    await sleep(500);
    ev.err = await page.evaluate(() => [...document.querySelectorAll('[role=alert],[class*=error i],[class*=toast i],[class*=alert i],[class*=invalid i]')].map((e) => e.innerText.trim()).filter(Boolean).join(' | ').slice(0, 160)).catch(() => '');
    const soft = !!post && post.status < 400 && /"(success|ok)"\s*:\s*false|"status"\s*:\s*"(error|fail)|"error"\s*:\s*["{]/i.test(post.body);   // answered 200 but says it failed
    ev.post = post ? (soft ? { ...post, status: 400 } : post) : null;
    ev.failedReq = failedReq;
    rec.api = post ? `POST ${post.url} ${post.status}` : '';
    rec.raw = ((post && (post.status >= 400 || soft) && post.body) || ev.err || '').replace(/\s+/g, ' ').slice(0, 140);
    rec.ok = post ? (post.status < 400 && !soft) : ev.moved && !ev.btnDisabled;

    if (rec.ok) {                                          // account created: welcome card > Continue > close popup > log out
      phase = 'after';
      try {
        const w = await readWelcome(page);
        if (w) {
          rec.welcome = true;
          if (w.pass && w.pass.length >= 6 && !/[•*●]/.test(w.pass)) rec.password = w.pass;     // the card shows the real password
          if (n === 1) await page.screenshot({ path: `${OUT}/welcome.png`, fullPage: true });
          rec.continued = await pressContinue(page);
        }
        const b = await dismissBarrier(page);
        rec.popup = b.pressed.join('+') || 'none'; ev.popupStuck = b.stuck;
        const lo = await logout(page);
        rec.loggedOut = lo.ok; ev.logoutHow = lo.how;
        rec.relinked = await reopenLink(page);                 // retype the referral link after logging out
      } catch (e) { ev.afterError = String(e && e.message).split('\n')[0].slice(0, 90); }
    }
  } catch (e) {
    const msg = String(e && e.message).split('\n')[0];
    if (phase === 'load') ev.loadError = msg.replace(/^page\.goto: /, '').slice(0, 90);
    else if (!ev.noForm && !ev.noButton) ev.crash = msg.slice(0, 90);
  }
  if (!dry) {
    if (!rec.ok) { const d = diagnose(ev); rec.problem = d.code; rec.why = d.why; rec.fix = d.fix; }
    if (!ev.loadError && !ev.noForm) {
      const warn = [];
      if (!rec.sponsor_filled) warn.push('sponsor box was empty (the link did not auto-fill it, so the referral cannot be credited)');
      if (!rec.terms) warn.push('terms box could not be ticked');
      if (rec.ok && !rec.welcome) warn.push('welcome card was not seen after sign-up');
      if (rec.ok && ev.popupStuck) warn.push('a popup could not be closed');
      if (rec.ok && !rec.relinked) warn.push('after logout, the referral link did not show the form with the Sponsor box filled');
      if (rec.ok && !rec.loggedOut) warn.push(`could not log out (${ev.logoutHow || ev.afterError || 'unknown'})`);
      rec.warn = warn.join(' | ');
    }
    if (!rec.ok) await page.screenshot({ path: `${OUT}/fail-${n}.png`, fullPage: true }).catch(() => {});
  }
  await page.close().catch(() => {});
  if (!shared) await ctx.close().catch(() => {});
  return rec;
}

// ---------- run ----------
const browser = await chromium.launch({ headless: !flag('headed') });
if (flag('dry')) { await visit(browser, 1, true); await browser.close(); process.exit(0); }

console.log(`\nReferral bot: ${N} random accounts through\n  ${link}\n(password for every test account: ${PASS})\n`);
const results = [], seen = new Set(); let next = 0; const t0 = Date.now();
await Promise.all(Array.from({ length: PAR }, async () => {
  const ctx = FRESH ? null : await browser.newContext({ viewport: { width: 390, height: 1000 } });   // one browser session per worker: create > log out > create ...
  while (next < N) {
    const n = ++next, r = await visit(browser, n, false, ctx);
    results[n - 1] = r;
    console.log(`  #${String(n).padStart(3)}  ${r.ok ? 'ACCOUNT CREATED' : 'FAILED'}  ${r.username}${r.api ? '  (' + r.api + ')' : ''}`);
    if (r.ok) {
      const steps = [r.welcome ? 'welcome card seen' : 'no welcome card', r.continued ? 'Continue pressed' : '', r.popup && r.popup !== 'none' ? 'popup closed with ' + r.popup : 'no popup', r.loggedOut ? 'logged out' : 'NOT logged out', r.relinked ? 'link typed again, sponsor refilled' : 'link NOT reopened with sponsor'].filter(Boolean).join(' > ');
      console.log(`        ${steps}${r.warn ? '\n        ! ' + r.warn : ''}`);
    } else {
      console.log(`        ${r.why}`);
      if (!seen.has(r.problem)) { seen.add(r.problem); console.log('        what to check: ' + r.fix); }
    }
    fs.appendFileSync(OUT + '/log.txt', new Date().toISOString() + '  #' + n + '  ' + (r.ok ? 'SUCCESS' : 'FAILED') + '  ' + r.username + '  ' + (r.password || '') + '  ' + (r.ok ? (r.relinked ? 'link reopened' : 'link NOT reopened') : r.why) + '\n');
    if (DELAY) await sleep(DELAY);
  }
  if (ctx) await ctx.close();
}));
await browser.close();

// ---------- report ----------
const good = results.filter((r) => r.ok), bad = results.filter((r) => !r.ok);
const filled = results.filter((r) => r.sponsor_filled), ticked = results.filter((r) => r.terms);
const loaded = results.filter((r) => !['unreachable', 'no_form', 'still_logged_in'].includes(r.problem)).length;
const csvCell = (v) => '"' + String(v).replace(/"/g, '""') + '"';
fs.writeFileSync(`${OUT}/accounts.csv`, ['n,username,email,phone,password,sponsor,terms_ticked,ok,welcome_seen,popup,logged_out,problem,api,site_message,why,warning', ...results.map((r) => [r.n, r.username, r.email, r.phone, r.password, r.sponsor, r.terms, r.ok, r.welcome, r.popup, r.loggedOut, r.problem, r.api, r.raw, r.why, r.warn].map(csvCell).join(','))].join('\n'));
fs.writeFileSync(`${OUT}/accounts.json`, JSON.stringify(results, null, 2));

const L = [], say = (s = '') => { L.push(s); console.log(s); };
say(`\n========== REFERRAL BOT REPORT ==========`);
say(`Link:     ${link}`);
say(`Date:     ${new Date().toLocaleString()}   (took ${((Date.now() - t0) / 1000).toFixed(1)}s)`);
say(`Accounts: ${good.length} created, ${bad.length} failed, out of ${N}`);
say(`Sponsor box auto-filled from the link: ${filled.length} of ${N}`);
say(`Terms box ticked:                      ${ticked.length} of ${N}`);
say(`Welcome card seen after sign-up:       ${good.filter((r) => r.welcome).length} of ${good.length}`);
say(`Popup closed (Later / X):              ${good.filter((r) => r.popup && r.popup !== 'none').length} of ${good.length}`);
say(`Logged out before the next account:    ${good.filter((r) => r.loggedOut).length} of ${good.length}`);
say('Link typed again after logout (sponsor refilled): ' + good.filter((r) => r.relinked).length + ' of ' + good.length);
if (good.length) {
  say(`\nACCOUNTS CREATED (compare with the Users list in your admin panel):`);
  good.forEach((r, i) => say(`  ${String(i + 1).padStart(3)}. ${r.username}`));
}
if (bad.length) {
  say(`\nWHAT WENT WRONG`);
  const groups = {};
  for (const r of bad) (groups[r.problem] = groups[r.problem] || []).push(r);
  for (const [code, list] of Object.entries(groups).sort((a, b) => b[1].length - a[1].length)) {
    say(`\n * ${list.length} account${list.length > 1 ? 's' : ''}: ${list[0].why}`);
    say(`   What to check: ${list[0].fix}`);
    const msg = list.find((r) => r.raw); if (msg) say(`   The site said: "${msg.raw}"`);
    say(`   e.g. ${list.slice(0, 3).map((r) => '#' + r.n).join(', ')}`);
  }
  const firstBad = results.findIndex((r) => !r.ok), top = Object.entries(groups).sort((a, b) => b[1].length - a[1].length)[0][0];
  if (good.length && firstBad > 0 && ['rate_limit', 'blocked', 'captcha'].includes(top)) say(`\nPattern: the first ${firstBad} accounts worked, then the site started refusing. It usually means a limit per device/IP kicks in after a few sign-ups.`);
  else if (!good.length) say(`\nPattern: every account failed. Fix the first problem above and run again; the rest usually disappear.`);
}
if (good.some((r) => !r.loggedOut)) say(`\nWARNING: the bot could not log out ${good.filter((r) => !r.loggedOut).length} account(s) (it cleared the session instead). Send me a screenshot of the page you land on after Continue, showing where Logout is.`);
if (loaded && filled.length < loaded) say(`\nWARNING: the sponsor box was empty for ${loaded - filled.length} account(s). If the link does not fill it, the referral cannot be credited. Check the link is the live one and still contains the sponsor code.`);
if (loaded && ticked.length < loaded) say(`\nWARNING: the terms box could not be ticked for ${loaded - ticked.length} account(s). See filled.png.`);
say(`\nNOTE: "created" only means the site accepted the sign-up. The real referral test is next: log in as the sponsor and check the referral list shows ${good.length} new people (all usernames start with sim_).`);
say(`\nFiles: ${OUT}/report.txt  ${OUT}/accounts.csv  (screenshots of failures: ${OUT}/fail-N.png)\n`);
fs.writeFileSync(`${OUT}/report.txt`, L.join('\n'));
process.exit(bad.length === 0 && filled.length === N && ticked.length === N ? 0 : 1);
