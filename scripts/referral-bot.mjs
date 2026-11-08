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
//          --memory=file (where the bot remembers every name/username/email/phone it ever used; default scripts/.referral-bot-memory.json)
//          --seed=file (teach the memory from an old accounts.json / accounts.csv / log.txt; repeatable)  --reset-memory (forget everything)  --no-memory
// Output:  referral-bot-out/  (report.txt, accounts.csv, accounts.json, page.png, filled.png, fail-N.png)

import fs from 'node:fs';
import readline from 'node:readline/promises';
import { fileURLToPath } from 'node:url';

let chromium;
try { ({ chromium } = await import('playwright')); }
catch { console.log('\nPlaywright is not installed. Run these two commands, then try again:\n  npm i -D playwright\n  npx playwright install chromium\n'); process.exit(1); }

const args = process.argv.slice(2);
const flag = (n) => args.includes('--' + n);
const opt = (n, d) => { const a = args.find((x) => x.startsWith('--' + n + '=')); return a ? a.slice(n.length + 3) : d; };
let DELAY = Math.max(0, parseInt(opt('delay', '1500'), 10) || 0);
const PAR = Math.max(1, Math.min(5, parseInt(opt('parallel', '1'), 10) || 1));
const DOMAIN = opt('domain', 'example.com');
const FRESH = flag('fresh');
const COUNTRY = opt('country', 'Kenya');
const brain = await import('./referral-brain.mjs').catch(() => null);          // the AI brain: optional, the bot still works without it
const AI = !flag('no-ai') && !!brain && brain.ready();
const extra = await import('./referral-extra.mjs').catch(() => null);          // own-referral-link capture, more links, levels: optional extras
const CAPTURE = !flag('no-capture') && !!extra;
if (brain) brain.configure({ budget: parseInt(opt('ai-budget', '60'), 10) || 60, country: COUNTRY, log: (m) => console.log('        [ai] ' + m) });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const ask = async (q) => { const rl = readline.createInterface({ input: process.stdin, output: process.stdout }); const a = (await rl.question(q)).trim(); rl.close(); return a; };
const tty = !!process.stdin.isTTY;

// the link and the number of accounts: from the command line, or the bot asks you
let link = args.find((a) => /^https?:\/\//i.test(a));
const numArg = args.find((a) => /^\d+$/.test(a));
if (!link && !tty) { console.log('\nUsage: node scripts/referral-bot.mjs "<referral link>" [count] [--dry] [--headed] [--yes]\n'); process.exit(1); }
// several referral links, how many levels deep and the pace: asked here when the bot asks for the link itself
const ALL_LINKS = [];
const addLinks = (s) => { for (const x of String(s || '').split(/[\s,;]+/)) if (/^https?:\/\//i.test(x) && !ALL_LINKS.includes(x)) ALL_LINKS.push(x.replace(/^["']|["']$/g, '')); };
args.forEach(addLinks);
let PROMPTED = false;
if (!ALL_LINKS.length && tty && !flag('dry') && !flag('single')) {
  PROMPTED = true;
  let k = parseInt(await ask('\nHow many referral links do you want to test? [1]: '), 10); k = Math.max(1, Math.min(10, k || 1));
  for (let i = 1; i <= k; i++) addLinks(await ask(k > 1 ? `Paste referral link ${i} of ${k}: ` : 'Paste your referral link: '));
  link = ALL_LINKS[0];
}
if (!link) link = (await ask('\nPaste your referral link: ')).replace(/^["']|["']$/g, '');
addLinks(link); if (ALL_LINKS.length) link = ALL_LINKS[0];
if (!/^https?:\/\//i.test(link)) { console.log('\nThat is not a link (it must start with https://).\n'); process.exit(1); }
let N = parseInt(numArg, 10);
if (!N && !flag('dry') && tty) N = parseInt(await ask('How many accounts should the bot create? (1-100000): '), 10);
N = Math.max(1, Math.min(100000, N || 5));
let LEVELS = parseInt(opt('levels', process.env.REFBOT_LEVELS || ''), 10);
if (!LEVELS && PROMPTED && !flag('yes')) LEVELS = parseInt(await ask("How many levels deep? 1 = only these links, 2 = also sign up through each new account's own referral link [1]: "), 10);
LEVELS = Math.max(1, Math.min(4, LEVELS || 1));
const PER_REF = Math.max(1, Math.min(20, parseInt(opt('per-ref', process.env.REFBOT_PER_REF || '1'), 10) || 1));       // accounts per referral link on levels 2 and up
const L_MAX = Math.max(1, Math.min(500, parseInt(opt('level-max', '30'), 10) || 30));                                  // most accounts on each level from 2 up
if (PROMPTED && !args.some((a) => a.startsWith('--delay='))) { const s = parseFloat(await ask('Seconds between accounts? [' + DELAY / 1000 + ']: ')); if (s >= 0) DELAY = Math.round(s * 1000); }


const host = new URL(link).hostname;
const local = /^(localhost|127\.|192\.168\.|10\.)/.test(host);
if (!flag('dry') && !local && !flag('yes')) {
  console.log(`\nThis is a LIVE site (${host}). Every account the bot creates is real and may receive the signup bonus.`);
  if (!tty || (await ask(`Type YES to create ${N} real accounts there: `)).toUpperCase() !== 'YES') { console.log('Cancelled. (Use --yes to skip this question.)\n'); process.exit(1); }
}

if (!flag('dry') && !local && !flag('yes') && (ALL_LINKS.length > 1 || LEVELS > 1)) {
  console.log(`\nAlso planned: ${ALL_LINKS.length > 1 ? (ALL_LINKS.length - 1) + ' more link(s) x ' + N + ' accounts' : ''}${ALL_LINKS.length > 1 && LEVELS > 1 ? ', and ' : ''}${LEVELS > 1 ? 'up to ' + L_MAX + ' accounts on each of ' + (LEVELS - 1) + ' deeper level(s), one account every ' + DELAY / 1000 + 's' : ''}.`);
  if (!tty || (await ask('Type YES to continue: ')).toUpperCase() !== 'YES') { console.log('Cancelled. (Use --yes to skip this question.)\n'); process.exit(1); }
}
const OUT = 'referral-bot-out';
fs.mkdirSync(OUT, { recursive: true });

// ---------- random people ----------
const rnd = (n) => Math.random().toString(36).slice(2, 2 + n);
const digits = (n) => Array.from({ length: n }, () => Math.floor(Math.random() * 10)).join('');
const pick = (a) => a[Math.floor(Math.random() * a.length)];
// Made-up Kenyan-style names (common first names and family names, mixed at random). No well-known people on purpose.
const FIRST = ['David', 'Brian', 'Kevin', 'Peter', 'John', 'Samuel', 'Joseph', 'Dennis', 'Collins', 'Felix', 'Victor', 'Eric', 'Allan', 'Dan', 'Martin', 'Moses', 'Isaac', 'Kelvin', 'Steve', 'Duncan', 'Ian', 'Alex',
  'Mercy', 'Faith', 'Grace', 'Esther', 'Lucy', 'Winnie', 'Purity', 'Cynthia', 'Mary', 'Beatrice', 'Naomi', 'Linet', 'Brenda', 'Joyce', 'Sharon', 'Ruth', 'Caroline', 'Irene', 'Lilian', 'Judy',
  'Wanjiku', 'Njeri', 'Wambui', 'Akinyi', 'Atieno', 'Mwende', 'Zawadi', 'Amina', 'Fatuma', 'Halima', 'Hassan', 'Juma', 'Kiprono', 'Barasa', 'Otieno', 'Mutua', 'Kamau', 'Maina'];
const LAST = ['Karanja', 'Kamau', 'Mwangi', 'Njoroge', 'Kariuki', 'Githinji', 'Maina', 'Kimani', 'Wanjiru', 'Gathoni', 'Macharia', 'Ndungu', 'Waweru', 'Mugo', 'Kinyua', 'Muriuki',
  'Otieno', 'Odhiambo', 'Ochieng', 'Omondi', 'Onyango', 'Owino', 'Achieng', 'Adhiambo', 'Okoth', 'Juma', 'Wekesa', 'Barasa', 'Simiyu', 'Wafula', 'Nyongesa', 'Mukhwana',
  'Koech', 'Rotich', 'Kiprop', 'Kosgei', 'Chebet', 'Cheruiyot', 'Mutua', 'Musyoka', 'Kioko', 'Mwikali', 'Ndunda', 'Muthoni', 'Hassan', 'Mohamed', 'Abdi', 'Said', 'Nyaga', 'Gitau'];
const PASS = opt('pass', 'Sim' + rnd(5) + '#7');
// Optional: your own Gmail, e.g. --email-base=you@gmail.com. Every test email then becomes you+davidkaranja36@gmail.com:
// it looks like a normal Gmail address in your backend, but all mail lands in YOUR inbox, so it can never belong to a stranger.
const EMAIL_BASE = (() => { const b = String(opt('email-base', process.env.REFBOT_EMAIL_BASE || '')).trim().toLowerCase(); return /^[a-z0-9._-]+@[a-z0-9.-]+\.[a-z]{2,}$/.test(b) ? b : ''; })();
// Username prefix: empty by default (usernames look like karanjadave). To mark test accounts again, run with --prefix=sim_
const USER_PREFIX = String(opt('prefix', '')).replace(/[^a-z0-9_]/gi, '').toLowerCase();
// --vibe=play: email/username is just one real first name (from the FIRST list below) plus 2 digits, nothing in front, no plus sign: david22@gmail.com. Off by default.
const VIBE = String(opt('vibe', '')).toLowerCase() === 'play';

// ---------- the memory: every name, username, email and phone used in ANY earlier run ----------
// Saved to a file next to this script (not in the run folder), so Termux runs and admin-panel runs share it and nothing is picked twice.
const MEM_FILE = opt('memory', process.env.REFBOT_MEMORY || fileURLToPath(new URL('./.referral-bot-memory.json', import.meta.url)));
const NO_MEM = flag('no-memory');
const mem = { names: new Set(), users: new Set(), emails: new Set(), phones: new Set() };
const MEM_KEYS = Object.keys(mem);
const norm = (v) => String(v || '').trim().toLowerCase();
let memWarned = false;
function memLoad() {                                   // merge what other runs saved meanwhile
  if (NO_MEM) return;
  try { const j = JSON.parse(fs.readFileSync(MEM_FILE, 'utf8')); for (const k of MEM_KEYS) for (const v of j[k] || []) mem[k].add(v); } catch (e) {}
}
function memSave() {
  if (NO_MEM) return;
  try {
    const tmp = MEM_FILE + '.' + process.pid + '.tmp';
    fs.writeFileSync(tmp, JSON.stringify(Object.fromEntries(MEM_KEYS.map((k) => [k, [...mem[k]]]))));
    fs.renameSync(tmp, MEM_FILE);
  } catch (e) { if (!memWarned) { memWarned = true; console.log('  ! Could not save the bot memory to ' + MEM_FILE + ' (' + String(e.message).slice(0, 80) + '). Names will only be remembered during this run.'); } }
}
function memRemember(x) {                              // x: { name, user, email, phone }
  if (x.name) mem.names.add(norm(x.name));
  if (x.user) mem.users.add(norm(x.user));
  if (x.email) mem.emails.add(norm(x.email));
  if (x.phone) mem.phones.add(String(x.phone).trim());
}
function memSeed(file) {                               // learn from an old accounts.json / accounts.csv / log.txt
  let txt = '', n = 0; try { txt = fs.readFileSync(file, 'utf8'); } catch (e) { return 0; }
  const before = mem.users.size + mem.emails.size;
  try { const j = JSON.parse(txt); if (Array.isArray(j)) { for (const r of j) if (r) { memRemember({ name: r.name, user: r.username, email: r.email, phone: r.phone }); for (const o of r.oldUsernames || []) mem.users.add(norm(o)); } n = 1; } } catch (e) {}
  if (!n) for (const line of txt.split('\n')) {
    let m = line.match(/#\s*\d+\s+(?:SUCCESS|FAILED)\s+(\S+)/);               // log.txt line
    if (m) mem.users.add(norm(m[1]));
    else if (/^\d+,"/.test(line)) { const c = [...line.matchAll(/"((?:[^"]|"")*)"/g)].map((x) => x[1]); if (c[0] != null) { memRemember({ user: c[0], email: c[1], phone: c[2] }); } }   // accounts.csv line (n,username,email,phone...)
    else if (/^\d+,[^,]+,/.test(line)) { const c = line.split(','); memRemember({ user: c[1], email: c[2], phone: c[3] }); }
    for (const e of line.match(/[\w.+-]+@[\w.-]+\.[a-z]{2,}/gi) || []) mem.emails.add(norm(e));
  }
  return mem.users.size + mem.emails.size - before;
}
if (flag('reset-memory') && !NO_MEM) { try { fs.rmSync(MEM_FILE, { force: true }); console.log('Bot memory wiped (' + MEM_FILE + ').'); } catch (e) {} }
memLoad();
if (!NO_MEM) {
  for (const f of [OUT + '/accounts.json', OUT + '/accounts.csv', OUT + '/log.txt', ...args.filter((a) => a.startsWith('--seed=')).map((a) => a.slice(7))]) memSeed(f);
  memSave();
  console.log(`Bot memory: ${mem.users.size} usernames, ${mem.emails.size} emails, ${mem.names.size} names, ${mem.phones.size} phones already used, they will not be picked again (${MEM_FILE}).`);
} else console.log('Bot memory is OFF (--no-memory): names may repeat across runs.');

function person() {
  memLoad();                                           // pick up anything another run saved a second ago
  let first, last, user, local, name, phone, email;
  for (let i = 0; i < 400; i++) {
    first = pick(FIRST); last = pick(LAST);
    const f = first.toLowerCase(), l = last.toLowerCase();
    const extra = i >= 300 ? digits(3) : '';           // only if the name pool is nearly used up: still never repeat
    if (VIBE) {
      local = f + digits(2) + extra;
      user = USER_PREFIX + f + digits(2) + extra;
    } else {
      local = pick([f + l + digits(2), f + l + digits(2), f + l.slice(0, 4) + digits(2), l + f + digits(2), f[0] + l + digits(2), f + '.' + l + digits(2)]) + extra;   // davidkaranja36, davidkara67, karanjadave12 ...
      user = USER_PREFIX + pick([l + f, l + f.slice(0, 3) + digits(2), f + l.slice(0, 3) + digits(2), l + f[0] + digits(2)]) + extra;                                       // karanjadave, karanjadav48 ...
    }
    user = user.slice(0, 20);
    name = first + ' ' + (i >= 150 ? pick('ABCDEFGHJKLMNPRSTW'.split('')) + '. ' : '') + last;                                                                              // the middle initial only appears once every plain first+last pair is used
    email = (!VIBE && EMAIL_BASE) ? EMAIL_BASE.replace('@', '+' + local.replace(/[^a-z0-9]/g, '') + '@') : local + '@' + DOMAIN;   // --vibe=play never uses the +prefix, even if REFBOT_EMAIL_BASE is set
    phone = '7' + digits(/kenya/i.test(COUNTRY) ? 8 : 9);
    if (!mem.names.has(norm(name)) && !mem.users.has(norm(user)) && !mem.emails.has(norm(email)) && !mem.phones.has(phone)) break;
  }
  memRemember({ name, user, email, phone }); memSave();   // reserved BEFORE the site is touched: even a failed attempt is never repeated
  return { name, user, email, phone };   // usernames are random Kenyan-style names (or playful words with --vibe=play); the list of created accounts is printed at the end of every run
}

// A new username in the same style, used when the site says the first one is taken.
function freshUsername(name) {
  memLoad();
  const parts = String(name).toLowerCase().replace(/[^a-z ]/g, '').split(' ').filter((x) => x.length > 1);
  const f = parts[0] || 'user', l = parts[parts.length - 1] || 'ke';
  let u = '';
  for (let i = 0; i < 80; i++) {
    u = (USER_PREFIX + (VIBE ? f + digits(i < 40 ? 2 : 4) : pick([l + f.slice(0, 3) + digits(2), f + l.slice(0, 3) + digits(3), l + f[0] + digits(2), f + digits(i < 40 ? 3 : 5)]))).slice(0, 20);
    if (!mem.users.has(u)) break;
  }
  mem.users.add(u); memSave();                         // the taken one stays remembered too
  return u;
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
      cls: String(el.className || ''), nopt: el.tagName === 'SELECT' ? el.options.length : 0, opts: el.tagName === 'SELECT' ? [...el.options].slice(0, 12).map((o) => o.textContent.trim()) : [],
      visible: r.width > 0 && r.height > 0 && cs.visibility !== 'hidden' && cs.display !== 'none',
    };
  }));
}
const LANGS = /^(en|es|ko|tl|vi|pt|ru|fr|de|it|ar|sw|zh|ja|hi|tr|id|nl|pl|th|uk|bn|ur|fil|english|spanish|french|german|portuguese|russian|korean|swahili|arabic|chinese|japanese|hindi|turkish|vietnamese|tagalog|filipino|indonesian)([-_][a-z]{2,4})?$/i;
const isLang = (f) => f.tag === 'select' && (/lang|locale|i18n|translate/i.test([f.name, f.id, f.aria, f.cls, f.label].join(' ')) || (!!f.opts && f.opts.length >= 2 && f.nopt <= 14 && f.opts.filter((o) => LANGS.test(o)).length >= Math.ceil(f.opts.length * 0.6)));
function assign(fields) {
  const roles = {}, used = new Set();
  const text = (f) => [f.label, f.name, f.id, f.ph, f.aria].join(' ').toLowerCase();
  const pool = fields.filter((f) => f.visible || f.type === 'checkbox');
  const take = (role, test) => { const f = pool.find((x) => !used.has(x.i) && test(x)); if (f) { roles[role] = f; used.add(f.i); } };
  take('terms', (f) => f.type === 'checkbox');
  take('country', (f) => f.tag === 'select' && !isLang(f));
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
// Opens a link. net::ERR_ABORTED usually means the site redirected itself while loading, so that counts as loaded.
async function gotoRetry(page, url) {
  let last;
  for (let t = 0; t < 3; t++) {
    try { await page.goto(url, { waitUntil: t === 2 ? 'commit' : 'domcontentloaded', timeout: 30000 }); return; }
    catch (e) {
      last = e; const m = String(e && e.message);
      if (/has been closed|browser has been/i.test(m)) throw e;
      let same = false; try { same = new URL(page.url()).hostname === new URL(url).hostname; } catch (x) {}
      if (same && /ERR_ABORTED/.test(m)) return;
      await sleep(1500 * (t + 1));
    }
  }
  throw last;
}
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

// Some sites show the referral code as plain confirmation text instead of an editable Sponsor box
// (e.g. "You were invited with code AC854879"), with nothing for the bot to type into. This looks for
// that banner so the bot can tell the referral really is being recognised, even with no fillable field.
async function staticSponsorText(page) {
  return page.evaluate(() => {
    const re = /\b(invited|referred)\b.{0,25}\bcode\b|\breferral code\b|\b(sponsor(?:ed)?|referred) by\b/i;
    const e = [...document.querySelectorAll('body *')].find((x) => !/^(SCRIPT|STYLE|NOSCRIPT)$/.test(x.tagName) && x.children.length === 0 && x.getClientRects().length > 0 && re.test(x.textContent));
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
// ---------- generic popup loop ----------
// Finds any popup sitting on top of the page (dialog, modal, dimmed overlay, bottom sheet, Telegram panel), whatever it says.
// The bottom tab bar (HOME / EARN / TEAM / WALLET / ME) is never counted as a popup.
async function detectOverlay(page) {
  const tg = await page.getByText(/telegram|join our channel|get 5 usd/i).first().isVisible().catch(() => false);
  const o = await page.evaluate(() => {
    const vw = innerWidth, vh = innerHeight, seen = [];
    const navLike = (e) => { const t = (e.innerText || '').toUpperCase(); return /\bHOME\b/.test(t) && /\bWALLET\b/.test(t) && /\bTEAM\b/.test(t); };
    for (const e of document.querySelectorAll('body *')) {
      if (/^(SCRIPT|STYLE|NOSCRIPT|HEAD)$/.test(e.tagName)) continue;
      const cs = getComputedStyle(e);
      if (cs.display === 'none' || cs.visibility === 'hidden' || +cs.opacity === 0 || cs.pointerEvents === 'none') continue;
      const isDialog = e.matches('[role=dialog],[role=alertdialog],[aria-modal=true],dialog[open]');
      const hasX = cs.position === 'fixed' && [...e.querySelectorAll('button,[role=button],a')].some((b) => /^\s*(later|maybe later|not now|skip|no,? thanks|remind me later|got it|close|dismiss)\s*$/i.test((b.innerText || b.getAttribute('aria-label') || '').trim()));
      const floating = (cs.position === 'fixed' || cs.position === 'absolute') && (parseInt(cs.zIndex, 10) >= 10 || isDialog || hasX);
      if (!floating && !isDialog) continue;
      const r = e.getBoundingClientRect();
      if (r.width < 120 || r.height < (hasX ? 40 : 60)) continue;
      const covers = r.width >= vw * 0.55 && (r.height >= vh * 0.25 || hasX);
      if (!isDialog && !covers) continue;
      if (!isDialog && !hasX && r.height < vh * 0.14) continue;                 // thin fixed bars (header, bottom tabs) are not popups
      if (navLike(e)) continue;                                        // a wrapper that holds the tab bar is the app, not a popup
      const txt = (e.innerText || '').replace(/\s+/g, ' ').trim();
      if (!txt && !e.querySelector('button,[role=button],svg,img')) continue;
      seen.push({ txt: txt.slice(0, 120), area: r.width * r.height });
    }
    if (!seen.length) return null;
    seen.sort((a, b) => a.area - b.area);                              // smallest = the card itself, not the whole-screen backdrop
    return { sig: seen[0].txt || 'popup', count: seen.length };
  }).catch(() => null);
  if (o) return { sig: o.sig, telegram: tg };
  if (tg) return { sig: 'telegram', telegram: true };
  return null;
}
// One try at closing the popup. "level" goes up each time the same popup is still there, so the bot never repeats a move that did not work.
async function dismissOnce(page, level) {
  const GOOD = /^\s*(later|maybe later|remind me later|not now|skip|no,? thanks|no thanks|dismiss|close|got it|okay|ok|done|cancel|continue|x|×|✕|✖)\s*$/i;
  const NEVER = /log ?out|sign ?out|delete|remove|pay|buy|join|claim|open telegram|allow|enable|subscribe|install/i;
  if (level === 0) {
    const hit = await page.evaluate(({ good, never }) => {
      const G = new RegExp(good, 'i'), N = new RegExp(never, 'i');
      const vw = innerWidth, vh = innerHeight;
      const els = [...document.querySelectorAll('button,[role=button],a,[onclick],div,span')].filter((e) => {
        const r = e.getBoundingClientRect(); const cs = getComputedStyle(e);
        if (r.width < 8 || r.height < 8 || cs.visibility === 'hidden' || cs.display === 'none') return false;
        if (e.children.length > 2) return false;
        const t = (e.innerText || e.getAttribute('aria-label') || '').trim();
        return t && G.test(t) && !N.test(t);
      });
      // prefer real buttons, and ones that sit above the bottom tab bar
      const pts = els.map((e) => { const r = e.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2, t: (e.innerText || e.getAttribute('aria-label') || '').trim(), btn: /^(BUTTON|A)$/.test(e.tagName) || e.getAttribute('role') === 'button', fx: (() => { for (let p = e; p && p !== document.body; p = p.parentElement) if (getComputedStyle(p).position === 'fixed') return true; return false; })() }; })
        .filter((k) => k.x > 0 && k.x < vw && k.y > 0 && (k.y < vh * 0.93 || k.fx))
        .sort((a, b) => (b.fx - a.fx) || (b.btn - a.btn) || (/^(later|not now|skip|maybe later)/i.test(b.t) - /^(later|not now|skip|maybe later)/i.test(a.t)));
      return pts[0] || null;
    }, { good: GOOD.source, never: NEVER.source }).catch(() => null);
    if (hit) { await page.mouse.click(hit.x, hit.y); return hit.t.slice(0, 12) || 'button'; }
    level = 1;
  }
  if (level === 1) {                                                    // an X drawn as an icon: small button/svg in a top-right corner
    const spot = await page.evaluate(() => {
      const vw = innerWidth, vh = innerHeight;
      const c = [...document.querySelectorAll('button,[role=button],a,svg,[aria-label*=close i]')].map((e) => { const r = e.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2, w: r.width, h: r.height, t: (e.textContent || '').trim() }; })
        .filter((k) => k.w >= 10 && k.w < 64 && k.h < 64 && k.t.length <= 2 && k.y < vh * 0.6 && k.x > vw * 0.5)
        .sort((a, b) => (b.x - a.x) || (a.y - b.y));
      return c[0] || null;
    }).catch(() => null);
    if (spot) { await page.mouse.click(spot.x, spot.y); return 'X'; }
    level = 2;
  }
  if (level === 2) { await page.keyboard.press('Escape'); return 'Esc'; }
  if (level === 3) { await page.mouse.click(6, 6); return 'backdrop'; }          // tap the dimmed area outside the card
  return null;
}
// Closes popup after popup until none is left (several in a row is normal after sign-up). Saves a screenshot of each one.
async function closePopups(page, n, tag = 'after', grace = 0) {
  const pressed = [], shots = [];
  let stuck = false, lastSig = '', level = 0, quiet = 0, k = 0;
  const say2 = (m) => console.log('        [popup] ' + m);
  // the first popup can take several seconds to show up after Continue: wait for it instead of deciding there is none
  for (let waited = 0; grace && waited < grace; waited += 600) { if (await detectOverlay(page)) break; await sleep(600); }
  for (let round = 0; round < 14; round++) {
    const o = await detectOverlay(page);
    if (!o) { if (++quiet >= (k > 0 ? 5 : 2)) break; await sleep(1200); continue; }        // after closing one, wait ~6s: the next popup often arrives a few seconds late        // look twice: the next popup can arrive a moment late
    quiet = 0;
    if (o.sig === lastSig) level++; else { level = 0; k++; lastSig = o.sig; say2('#' + k + ' (' + tag + ') says: "' + o.sig.slice(0, 80) + '"'); if (n <= 3) { const f = `${OUT}/popup-a${n}-${tag}-${k}.png`; await page.screenshot({ path: f }).catch(() => {}); shots.push(f); } }
    if (level > 3) { stuck = true; const f = `${OUT}/popup-STUCK-a${n}-${tag}.png`; await page.screenshot({ path: f }).catch(() => {}); shots.push(f); break; }
    let did;
    if (o.telegram && level === 0) { const b = await dismissBarrier(page); did = b.pressed.join('+') || null; }
    if (!did) did = await dismissOnce(page, level);
    if (did) { pressed.push(did); say2('pressed ' + did); }
    await sleep(900);
  }
  if (!stuck) { await sleep(1200); const last = await detectOverlay(page); if (last) { stuck = true; say2('still on screen at the end: "' + last.sig.slice(0, 80) + '"'); } }
  return { pressed, stuck, shots, count: k };
}

// Taps the ME tab in the bottom bar (HOME / EARN / TEAM / WALLET / ME), then scrolls to the very bottom: Logout is only there.
async function openMeAndScroll(page) {
  const spot = await page.evaluate(() => {
    const vw = innerWidth, vh = innerHeight;
    const c = [...document.querySelectorAll('a,button,[role=tab],[role=button],div,span,li')].filter((e) => {
      const t = (e.innerText || '').trim();
      if (!/^me$/i.test(t)) return false;
      const r = e.getBoundingClientRect();
      return r.width > 0 && r.height > 0 && r.top > vh * 0.7;                  // it is in the bottom bar
    }).map((e) => { const r = e.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2, a: r.width * r.height }; })
      .sort((a, b) => b.a - a.a);
    return c[0] || null;
  }).catch(() => null);
  if (spot) { await page.mouse.click(spot.x, spot.y); await sleep(900); }
  for (let i = 0; i < 4; i++) {
    await page.evaluate(() => {
      window.scrollTo(0, document.body.scrollHeight);
      for (const e of document.querySelectorAll('*')) { if (e.scrollHeight > e.clientHeight + 40 && /auto|scroll/.test(getComputedStyle(e).overflowY)) e.scrollTop = e.scrollHeight; }
    }).catch(() => {});
    await page.mouse.wheel(0, 4000).catch(() => {});
    await sleep(350);
  }
  return !!spot;
}
async function tap(loc) {
  await loc.evaluate((e) => e.scrollIntoView({ block: 'center' })).catch(() => {});
  await sleep(250);
  if (await loc.click({ timeout: 3000 }).then(() => true).catch(() => false)) return true;
  return loc.evaluate((e) => { e.click(); return true; }).catch(() => false);
}
// Logs the account out: looks for a Logout button, opens menus if it is hidden, confirms if asked. Falls back to clearing the session.
async function logout(page, n) {
  const outRx = /log ?out|sign ?out/i;
  const find = () => page.getByRole('button', { name: outRx }).or(page.getByRole('link', { name: outRx })).or(page.getByRole('menuitem', { name: outRx })).or(page.getByText(/^\s*(log ?out|sign ?out)\s*$/i)).first();
  const vis = (l) => l.isVisible().catch(() => false);
  let btn = find();
  const late = [];                                           // popups that only showed up (or were only closed) at logout time
  if (!(await vis(btn))) {                                   // Logout lives only under ME, at the very bottom
    const pc = await closePopups(page, n || 99, 'prelogout');   // a popup may be covering the tab bar
    late.push(...pc.pressed); late.ran = true; late.stuck = pc.stuck;
    await openMeAndScroll(page);
    if (n === 1) await page.screenshot({ path: OUT + '/me.png' }).catch(() => {});
    btn = find();
    if (await vis(btn)) await btn.scrollIntoViewIfNeeded().catch(() => {});
  }
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
    await tap(btn);
    await sleep(700);
    const sure = page.getByRole('dialog').getByRole('button', { name: /^\s*(yes|confirm|ok|log ?out|sign ?out)\s*$/i }).first();
    if (await vis(sure)) await sure.click({ timeout: 3000 }).catch(() => {});
    // a bottom sheet that asks "log out?" with Logout / Cancel (not a real dialog): press its Logout button, never Cancel or X
    const asked = page.getByText(/log ?out\s*\?|sign ?out\s*\?|are you sure/i).first();
    if (await vis(asked)) {
      if (n === 1) await page.screenshot({ path: OUT + '/popup-logout-sheet.png' }).catch(() => {});
      const yes = page.getByRole('button', { name: /^\s*(log ?out|sign ?out|yes|confirm|ok)\s*$/i }).last();
      if (await vis(yes)) await tap(yes);
      else await tap(page.getByText(/^\s*(log ?out|sign ?out)\s*$/i).last());
      await sleep(600);
    }
    const out = (await page.locator('input[type=password]').first().waitFor({ state: 'visible', timeout: 7000 }).then(() => true).catch(() => false))
      || (await vis(page.getByRole('button', { name: /log ?in|sign ?in|create account/i }).first()));
    if (out) return { ok: true, how: 'Logout button', late };
    how = 'pressed Logout but the login page did not appear';
  }
  await page.context().clearCookies();                                                      // fallback so the next account still starts clean
  await page.evaluate(async () => { try { localStorage.clear(); sessionStorage.clear(); } catch (e) {} try { for (const d of (await indexedDB.databases())) indexedDB.deleteDatabase(d.name); } catch (e) {} }).catch(() => {});
  return { ok: false, how, late };
}

// After logging out: type the referral link into the browser again and check the Sponsor box fills itself again.
async function reopenLink(page) {
  try {
    await gotoRetry(page, link);
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
    const cb = page.getByLabel(/country/i).or(page.getByRole('combobox', { name: /country/i })).or(page.getByRole('button', { name: /country/i })).or(page.getByText(/^\s*country\s*\*?\s*$/i).locator('xpath=following::*[self::input or self::button or self::select or @role="combobox"][1]')).first();   // a custom dropdown instead of a real select
    if (await cb.isVisible().catch(() => false)) {
      await cb.click({ timeout: 2000 });
      const opt = page.getByRole('option', { name: rx }).or(page.getByText(exact)).first();
      if (!(await opt.isVisible().catch(() => false))) { await page.keyboard.type(name.slice(0, 6), { delay: 50 }).catch(() => {}); await sleep(400); }
      if (await opt.isVisible().catch(() => false)) { await opt.click({ timeout: 2000 }); return name; }
    }
  } catch (e) {}
  return '';
}

// Is the country box showing the wanted country? (true when the page has no country box at all, or an open list is still showing)
async function countryOk(page) {
  return page.evaluate((want) => {
    const shown = (e) => { const r = e.getBoundingClientRect(), c = getComputedStyle(e); return r.width > 0 && r.height > 0 && c.visibility !== 'hidden' && c.display !== 'none'; };
    const sels = [...document.querySelectorAll('select')].filter(shown).filter((x) => x.options.length > 30 || /countr|nation/i.test((x.name || '') + (x.id || '') + (x.getAttribute('aria-label') || '')));
    if (sels.length) return sels.some((x) => ((x.selectedOptions[0] && x.selectedOptions[0].textContent) || '').toLowerCase().includes(want));
    const lab = [...document.querySelectorAll('label,span,div,p')].find((e) => e.children.length === 0 && /^\s*country\s*\*?\s*$/i.test(e.textContent) && shown(e));
    if (!lab) return true;
    let box = lab.parentElement;
    for (let i = 0; i < 3 && box && box.innerText.trim().length <= lab.textContent.trim().length + 2; i++) box = box.parentElement;
    if (!box) return true;
    if ([...box.querySelectorAll('[role=listbox],[role=option],ul,li')].some(shown)) return false;
    const v = [...box.querySelectorAll('input,select')].map((x) => x.value || '').join(' ');
    return (box.innerText + ' ' + v).toLowerCase().includes(want);
  }, COUNTRY.toLowerCase()).catch(() => true);
}
// A real <select> that ignored selectOption: focus it and type the country name like a person would.
async function typeCountry(page, roles) {
  if (!roles.country || isLang(roles.country)) return;
  const sel = page.locator(SEL).nth(roles.country.i);
  await sel.focus({ timeout: 2000 }).catch(() => {});
  await page.keyboard.type(COUNTRY.slice(0, 8), { delay: 60 }).catch(() => {});
  await page.keyboard.press('Enter').catch(() => {});
  await sleep(300);
}
async function langState(page) {
  return page.evaluate(() => ({
    html: document.documentElement.lang || '',
    sels: [...document.querySelectorAll('select')].map((s, i) => { const o = [...s.options], code = /^[a-z]{2}([-_][a-z]{2,4})?$/i; return { i, v: s.value, lang: /lang|locale|i18n|translate/i.test((s.name || '') + ' ' + (s.id || '') + ' ' + s.className) || (o.length >= 2 && o.length <= 14 && o.filter((x) => code.test(x.textContent.trim()) || code.test(x.value)).length >= o.length * 0.6) }; }).filter((x) => x.lang),
  })).catch(() => ({ html: '', sels: [] }));
}
// If anything changed the site language while the form was being filled, put it back and say so.
async function langGuard(page, before) {
  const now = await langState(page); let changed = false;
  for (const b of before.sels) { const c = now.sels.find((x) => x.i === b.i); if (c && c.v !== b.v) { changed = true; await page.locator('select').nth(b.i).selectOption(b.v, { timeout: 3000 }).catch(() => {}); } }
  if (!changed && before.html && now.html && before.html.slice(0, 2) !== now.html.slice(0, 2)) changed = true;
  if (changed) await sleep(700);
  return changed;
}
// The Create Account button: by name first, then by its place in the form (so another site language cannot hide it).
async function findSubmit(page) {
  const byName = page.getByRole('button', { name: /create account|sign ?up|register|join/i }).last();
  if (await byName.count()) return byName;
  const form = page.locator('form').filter({ has: page.locator('input[type=password]') }).first();
  const scope = (await form.count()) ? form : page;
  const subs = scope.locator('button[type=submit], input[type=submit]');
  if (await subs.count()) return subs.last();
  const bad = /show|hide|eye|lang|google|facebook|telegram|apple|terms|privacy|close|back|log ?in|sign ?in/i;
  const all = scope.locator('button, input[type=button], [role=button]'), n = await all.count();
  for (let i = n - 1; i >= 0; i--) {
    const b = all.nth(i);
    if (!(await b.isVisible().catch(() => false))) continue;
    const t = ((await b.innerText().catch(() => '')) + ' ' + ((await b.getAttribute('aria-label').catch(() => '')) || '')).trim();
    if (!bad.test(t)) return b;
  }
  return byName;
}
// Types like a person (real key presses, then Tab) so the site's own checks notice the value. Falls back to fill().
async function typeInto(loc, v) {
  v = String(v);
  try {
    await loc.scrollIntoViewIfNeeded({ timeout: 3000 }).catch(() => {});
    await loc.click({ timeout: 4000 });
    await loc.fill('');
    await loc.pressSequentially(v, { delay: 30 });
    const got = await loc.inputValue().catch(() => '');
    if (got !== v && got.replace(/\D/g, '') !== v.replace(/\D/g, '')) await loc.fill(v);
    await loc.press('Tab').catch(() => {});             // leaving the field is what makes most forms check it
  } catch (e) { await loc.fill(v).catch(() => {}); }
}
// Some sites keep Create Account greyed for a moment (sponsor lookup, checks): wait up to 5 seconds for it.
async function waitEnabled(btn) {
  for (let i = 0; i < 10; i++) { if (!(await btn.isDisabled().catch(() => false))) return true; await sleep(500); }
  return false;
}
// "Busy" = the button shows only dots / a spinner, or says aria-busy: the site is still processing the sign-up.
const isBusy = (h) => !h ? Promise.resolve(false) : h.evaluate((e) => {
  if (!e.isConnected) return false;                       // button removed from the page = the page moved on
  const t = (e.innerText || e.value || '').trim();
  return e.getAttribute('aria-busy') === 'true' || /^[\s.\u2026\u00b7\u2022]+$/.test(t) || !!e.querySelector('[class*=spin i],[class*=loading i]') || /\b(loading|busy|pending)\b/i.test(e.className || '');
}).catch(() => false);
// After pressing: wait up to `ms` for the site to answer (a request finishing, the page moving, or the button leaving its busy state).
// Returns 'answered' or 'hung' (still busy and nothing came back).
async function waitAnswer(page, h, start, ms, got, sent) {
  const t0 = Date.now();
  while (Date.now() - t0 < ms) {
    if (got() || page.url() !== start) return 'answered';
    if (!(await isBusy(h))) return 'answered';
    if (!sent() && Date.now() - t0 > 8000) return 'unsent';     // nothing left the browser: the script on the page is stuck, waiting longer is pointless
    await sleep(500);
  }
  return got() ? 'answered' : (sent() ? 'hung' : 'unsent');
}
// Presses Create Account. If something invisible covers it, press it from inside the page instead.
async function pressCreate(page, btn) {
  await btn.scrollIntoViewIfNeeded({ timeout: 3000 }).catch(() => {});
  if (await btn.click({ timeout: 6000 }).then(() => true).catch(() => false)) return true;
  await page.keyboard.press('Escape').catch(() => {});
  return btn.evaluate((e) => { e.click(); return true; }).catch(() => false);
}
async function enterSubmit(page) {
  const pw = page.locator('input[type=password]').last();
  await pw.focus().catch(() => {});
  return pw.press('Enter').then(() => true).catch(() => false);
}
const testData = (p) => ({ $name: p.name, $username: p.user, $email: p.email, $phone: p.phone, $password: PASS, $country: COUNTRY });
const FORM_KEYS = ['email', 'password', 'username'];
// The bot's own rules first. If they miss a box, the AI reads the page and fills the gaps. If there is still no form, the AI tries to open it.
async function readRoles(page, p, tryOpen) {
  let roles = assign(await describe(page)), ai = null;
  const merge = (a) => { if (a && a.roles) for (const [k, f] of Object.entries(a.roles)) if (!roles[k]) roles[k] = f; };
  if (AI && (!FORM_KEYS.every((r) => roles[r]) || !roles.sponsor)) { ai = await brain.readPage(page, SEL); merge(ai); }
  if (AI && tryOpen && !FORM_KEYS.every((r) => roles[r])) {
    const w = await brain.agent(page, { goal: 'form', person: testData(p), verify: () => page.locator('input[type=password]').first().isVisible().catch(() => false) });
    if (w.acted) { await sleep(800); roles = assign(await describe(page)); ai = await brain.readPage(page, SEL); merge(ai); }
  }
  return { roles, ai };
}
const FIXABLE = new Set(['country', 'phone', 'terms', 'validation', 'button_disabled', 'no_response', 'click_blocked', 'password', 'unknown']);

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
    fix: 'The bot uses a number for the country it picks (default Kenya, +254). If your site only accepts real operator ranges, tell me the format and I will match it.' },
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
  if (e.browserDied) return { code: 'browser_crash', why: 'The browser crashed or was closed while working (on a small server this usually means it ran out of memory).', fix: 'Create fewer accounts per run (10 or less), keep --parallel at 1, or give the server more memory. The bot starts a new browser by itself and carries on.' };
  if (e.loadError) return { code: 'unreachable', why: `The bot could not open the link (${e.loadError}).`, fix: 'Open the same link in your own browser. Check the site is online, the link is spelled right, and your internet works.' };
  if (e.stillLoggedIn) return { code: 'still_logged_in', why: 'The previous account was still logged in, so the sign-up page did not show.', fix: 'The logout did not work. Send me a screenshot of the logged-in page showing where Logout is, or run with --fresh.' };
  if (e.langChanged && (e.noButton || e.noForm || e.crash)) return { code: 'language_changed', why: 'The site language changed while the bot filled the form (a language dropdown was touched), so the buttons had other names.', fix: 'The bot now ignores language dropdowns and puts the language back. If you still see this, open fail-N.png and tell me what language the page is in.' };
  if (e.noForm) return { code: 'no_form', why: 'The Create Account form did not show up, or the bot could not recognise its fields.', fix: 'Look at referral-bot-out/page.png. If it shows a login page, a popup, a cookie banner or an "enter" button, tell me and I will add that step.' };
  if (e.noButton) return { code: 'no_button', why: 'The bot could not find the Create Account button.', fix: 'Look at filled.png / fail-N.png. If the button has another name, tell me what it says.' };
  if (e.crash) return { code: 'bot_error', why: `The bot stumbled while filling the form (${e.crash}).`, fix: 'Run once with --headed and watch where it stops, then send me that message.' };
  const x = { status: e.post && e.post.status, text: (((e.post && e.post.body) || '') + ' ' + (e.err || '')).toLowerCase(), captcha: e.captcha, post: e.post };
  for (const r of RULES) if (r.test(x)) return { code: r.code, why: r.why, fix: r.fix };
  if (e.hung && e.hungKind === 'unsent') return { code: 'page_stuck', why: 'Create Account went to its loading state (...) but the page never sent a sign-up request (waited ' + (e.waited || 8) + ' seconds). The script on the page is stuck before it reaches the server.', fix: 'This is a front-end problem, not a slow server. Look at fail-N.png and the browser console of the site: a check before sign-up (device check, sponsor lookup, captcha) is probably not finishing.' };
  if (e.hung) return { code: 'site_slow', why: 'The sign-up request was sent' + (e.sentUrl ? ' to ' + e.sentUrl : '') + ' but no answer came back for ' + (e.waited || 30) + ' seconds, and Create Account stayed in its loading state (...).', fix: 'The server (or its database) is too slow or not answering the sign-up. Check the Render logs for that moment, then run again.' };
  if (e.failedReq) return { code: 'network', why: `The sign-up request never reached the server (${e.failedReq}).`, fix: 'The site may be down or overloaded, or the browser blocked the request (CORS / firewall). Check the site is online and the server logs.' };
  if (e.clickFailed) return { code: 'click_blocked', why: 'Something covers the Create Account button (a popup or cookie banner), so it could not be pressed.', fix: 'Look at fail-N.png and tell me what is covering it.' };
  if (e.btnDisabled) return { code: 'button_disabled', why: 'Create Account stayed greyed out: the site thinks a field is invalid or something is not accepted.', fix: 'Look at filled.png for a red field or an unticked box. Often the mobile number format or the username rules.' };
  if (e.pageErrors && e.pageErrors.length) return { code: 'page_error', why: `The page itself threw a JavaScript error (${e.pageErrors[0]}).`, fix: 'That is a bug in the site front-end. Send me that message.' };
  if (!e.moved) return { code: 'no_response', why: (e.err ? 'Pressing Create Account sent nothing; the form says: "' + e.err + '".' : 'Pressing Create Account did nothing: no request was sent and no message appeared.'), fix: 'The form\'s own checks blocked it silently. Look at fail-N.png for a red field.' };
  return { code: 'unknown', why: 'The account did not seem to be created, but the bot cannot tell why.', fix: 'Run with --headed and watch, then send me what you see.' };
}
// ---- end diagnose ----

const siteOf = () => { try { return new URL(link); } catch (e) { return null; } };
const capCtx = (rec, p, page, n) => ({ username: rec.username, email: rec.email, phone: rec.phone, password: rec.password, template: link, siteOrigin: (siteOf() || {}).origin || '', siteHost: (siteOf() || {}).host || '', log: (m) => console.log('        [link] ' + m), brain, AI, person: testData(p), goto: gotoRetry, logout: async () => !!(await logout(page, n)).ok });
// ---------- one visit = one new account ----------
async function visit(browser, n, dry, shared) {
  let ctx = shared, page;                              // shared = same browser session for every account (logs out in between); otherwise a brand-new visitor
  const p = person();
  const rec = { n, username: p.user, email: p.email, phone: p.phone, password: PASS, sponsor: '', sponsor_filled: false, terms: false, welcome: false, continued: false, popup: '', loggedOut: false, relinked: false, ok: false, problem: '', why: '', fix: '', raw: '', warn: '', api: '', ai: '' };
  const ev = { pageErrors: [] };
  let post = null, failedReq = null, sentReq = '', phase = 'load';
  try { ctx = ctx || await browser.newContext({ viewport: { width: 390, height: 1000 } }); page = await ctx.newPage(); }
  catch (e) { const d = diagnose({ browserDied: true }); Object.assign(rec, { problem: d.code, why: d.why, fix: d.fix, crashed: true }); if (!shared && ctx) await ctx.close().catch(() => {}); return rec; }
  page.on('response', async (r) => {
    const q = r.request();
    if (!post && q.method() === 'POST' && ['fetch', 'xhr'].includes(q.resourceType())) {
      post = { url: new URL(r.url()).pathname, status: r.status(), body: (await r.text().catch(() => '')).slice(0, 300) };
    }
  });
  page.on('request', (q) => { if (q.method() === 'POST' && ['fetch', 'xhr'].includes(q.resourceType())) sentReq = new URL(q.url()).pathname; });
  page.on('requestfailed', (q) => { if (q.method() === 'POST') failedReq = `${new URL(q.url()).pathname}: ${(q.failure() || {}).errorText || 'failed'}`; });
  page.on('pageerror', (e) => { if (ev.pageErrors.length < 3) ev.pageErrors.push(String(e.message).split('\n')[0].slice(0, 90)); });
  try {
    await gotoRetry(page, link);
    phase = 'form';
    await openForm(page);
    await sleep(1200);                                   // let the sponsor field auto-fill itself from the link
    const { roles, ai: aiRead } = await readRoles(page, p, !dry);
    rec.sponsor = roles.sponsor ? roles.sponsor.value : '';
    rec.sponsor_filled = !!rec.sponsor;
    rec.sponsor_mode = rec.sponsor_filled ? 'field' : '';
    if (!rec.sponsor_filled) {
      const banner = await staticSponsorText(page);
      if (banner) { rec.sponsor = banner; rec.sponsor_filled = true; rec.sponsor_mode = 'static'; }
    }
    rec.expect = extra ? extra.refCode(link) : ''; rec.sponsor_match = !rec.expect || rec.sponsor.toLowerCase().includes(rec.expect.toLowerCase());   // what the link says the sponsor is vs what the box (or banner) shows
    ev.captcha = await hasCaptcha(page);
    const who = await sponsorConfirmText(page);
    if (n === 1) await page.screenshot({ path: `${OUT}/page.png`, fullPage: true });

    if (dry) {
      console.log('\nFields the bot found on the page:');
      for (const [role, f] of Object.entries(roles)) console.log(`  ${role.padEnd(9)} ${(f.label || f.ph || f.name || f.id || f.type).replace(/\s+/g, ' ').slice(0, 28).padEnd(28)} type=${f.type}${f.value ? '  value="' + f.value + '"' : ''}`);
      const missing = ['name', 'username', 'email', 'phone', 'password', 'confirm', 'sponsor', 'terms'].filter((r) => !roles[r]);
      const langSel = (await describe(page)).filter(isLang);
      if (langSel.length) console.log('\nLanguage dropdown (ignored, the bot never touches it): ' + langSel.map((f) => f.opts.join(' ')).join(' / '));
      console.log('Country box: ' + (roles.country ? (roles.country.label || roles.country.name || 'dropdown') + ' (' + roles.country.nopt + ' options)' : 'not a normal dropdown, the bot will try a custom dropdown (or the AI)'));
      console.log(`\nSponsor box: ${rec.sponsor ? '"' + rec.sponsor + '" (auto-filled from the link)' : 'EMPTY'}${who ? '   ' + who : ''}`);
      const early = [];
      if (missing.length) early.push('Fields not found: ' + missing.join(', ') + ' (bot may not be able to fill the form)');
      if (!rec.sponsor) early.push('The Sponsor box is empty, so the link is not filling it: referrals could not be credited.');
      if (ev.captcha) early.push('A captcha is on the page: the bot will not be able to finish sign-ups.');
      console.log(early.length ? '\nPossible problems spotted before running:\n  - ' + early.join('\n  - ') : '\nNo problems spotted. The bot should be able to create accounts here.');
      if (aiRead && (aiRead.summary || aiRead.blockers.length)) console.log('\nWhat the AI brain sees: ' + (aiRead.summary || '') + (aiRead.blockers.length ? '\n  It spotted: ' + aiRead.blockers.join('; ') : ''));
      if (AI && !aiRead) console.log('\nAI brain is on but was not needed: the bot read the form by itself.');
      if (!AI) console.log('\nAI brain is off (' + (flag('no-ai') ? '--no-ai' : !brain ? 'scripts/referral-brain.mjs is missing' : 'no GEMINI_API_KEY') + ').');
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
    const lang0 = await langState(page);
    await chooseCountry(page, roles);                      // choose the country first: the site sets the phone code from it
    await sleep(500);
    if (!(await countryOk(page))) {
      await typeCountry(page, roles);                      // a stubborn real dropdown: type the name
      if (AI && !(await countryOk(page))) await brain.agent(page, { goal: 'country', person: testData(p), cacheKey: 'country', noSubmit: true, verify: () => countryOk(page) });   // a custom dropdown: the AI works it out
    }
    ev.langChanged = await langGuard(page, lang0);
    for (const [role, val] of [['name', p.name], ['username', p.user], ['email', p.email], ['phone', p.phone], ['password', PASS], ['confirm', PASS]]) {
      if (!roles[role]) continue;
      let v = val;
      if (role === 'phone') { const cur = await at(roles.phone).inputValue().catch(() => ''); let pre = (cur.match(/^\+\d{1,4}/) || [''])[0]; if (/kenya/i.test(COUNTRY) && pre && pre !== '+254') pre = '+254'; v = pre + p.phone; }   // keep the dial code the site typed (+254 for Kenya)
      await typeInto(at(roles[role]), v);
    }
    ev.langChanged = (await langGuard(page, lang0)) || ev.langChanged;
    rec.terms = await tickTerms(page, roles);              // tick the terms box, then press Create Account
    if (!rec.terms && AI) rec.terms = (await brain.agent(page, { goal: 'terms', person: testData(p), cacheKey: 'terms', noSubmit: true, maxSteps: 1 })).acted;   // a custom-styled box
    await sleep(600);
    if (n === 1) await page.screenshot({ path: `${OUT}/filled.png`, fullPage: true });

    phase = 'submit';
    let uTries = 0;
    for (let attempt = 1; attempt <= 2; attempt++) {
    const btn = await findSubmit(page);
    if (!(await btn.count())) { ev.noButton = true; throw new Error('no button'); }
    ev.btnDisabled = !(await waitEnabled(btn));
    const start = page.url();
    const hbtn = await btn.elementHandle({ timeout: 1500 }).catch(() => null);   // fixed handle: the button text changes to "..." after the click
    post = null; failedReq = null; sentReq = '';
    if (!ev.btnDisabled) ev.clickFailed = !(await (attempt === 2 && !AI ? enterSubmit(page) : pressCreate(page, btn)));
    ev.hung = false;
    if (!ev.btnDisabled && !ev.clickFailed && await isBusy(hbtn)) {   // site is still processing: give it up to 30 s before judging
      const t0 = Date.now();
      const wr = await waitAnswer(page, hbtn, start, 30000, () => !!post || !!failedReq, () => !!sentReq);
      ev.hung = wr !== 'answered'; ev.hungKind = wr; ev.sentUrl = sentReq;
      ev.waited = Math.round((Date.now() - t0) / 1000);
    }
    ev.moved = await page.waitForFunction((u) => location.href !== u || !document.querySelector('input[type=password]'), start, { timeout: 12000 }).then(() => true).catch(() => false);
    await sleep(500);
    ev.err = await page.evaluate(() => [...document.querySelectorAll('[role=alert],[class*=error i],[class*=toast i],[class*=alert i],[class*=invalid i]')].map((e) => e.innerText.trim()).filter(Boolean).join(' | ').slice(0, 160)).catch(() => '');
    if (!ev.err) ev.err = await page.evaluate(() => { const seen = new Set(), out = []; for (const e of document.querySelectorAll('body *')) { if (e.children.length) continue; const t = (e.innerText || '').trim(); if (!t || t.length > 90 || seen.has(t)) continue; const r = e.getBoundingClientRect(); if (r.width < 1 || r.height < 1) continue; if (/\b(required|invalid|too short|must be|min \d|do(es)? not match|already (in use|taken|exists|registered)|not available|incorrect|try again|failed)\b/i.test(t)) { seen.add(t); out.push(t); } } return out.join(' | ').slice(0, 160); }).catch(() => '');
    const soft = !!post && post.status < 400 && /"(success|ok)"\s*:\s*false|"status"\s*:\s*"(error|fail)|"error"\s*:\s*["{]/i.test(post.body);   // answered 200 but says it failed
    ev.post = post ? (soft ? { ...post, status: 400 } : post) : null;
    ev.failedReq = failedReq;
    rec.api = post ? `POST ${post.url} ${post.status}` : '';
    rec.raw = ((post && (post.status >= 400 || soft) && post.body) || ev.err || '').replace(/\s+/g, ' ').slice(0, 140);
    rec.ok = post ? (post.status < 400 && !soft) : ev.moved && !ev.btnDisabled;
    if (!rec.ok && !ev.hung && uTries < 4 && roles.username && /(user ?name|handle)[^|]{0,60}(taken|already|exists|in use)|already taken|username.{0,20}(unavailable|not available)/i.test(((post && post.body) || '') + ' ' + (ev.err || ''))) {
      uTries++; rec.oldUsernames = (rec.oldUsernames || []).concat(p.user);      // the username is taken: type a new one and press again
      p.user = freshUsername(p.name); rec.username = p.user;
      await typeInto(at(roles.username), p.user); await sleep(1200);
      attempt--; continue;
    }
    if (rec.ok || attempt === 2 || ev.hung) break;          // a hang is reported as the first failure: never press the stuck button again
    if (!AI) continue;                                     // second try without the AI: submit with the Enter key
    const d0 = diagnose(ev);
    if (!FIXABLE.has(d0.code)) break;
    const w = await brain.agent(page, { goal: 'fix_submit', person: testData(p), noSubmit: true, maxSteps: 2, error: (rec.raw || d0.why).slice(0, 200) });
    if (!w.acted) break;
    ev.fixedByAI = true; await sleep(500);
    }

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
        const b = await closePopups(page, n, 'after', 6000);
        rec.popup = b.pressed.join('+') || 'none'; ev.popupStuck = b.stuck;
        if (n === 1) await page.screenshot({ path: OUT + '/home.png' }).catch(() => {});
        if (ev.popupStuck && AI) { const w = await brain.agent(page, { goal: 'popup', person: testData(p), cacheKey: 'popup', verify: async () => !(await detectOverlay(page)) }); if (w.ok) { ev.popupStuck = false; rec.popup += '+AI'; } }
        if (CAPTURE) { try { Object.assign(rec, await extra.capture(page, capCtx(rec, p, page, n))); } catch (e) {} }   // read this account's own referral link before logging out
        const lo = await logout(page, n);
        if (!lo.ok && AI) {
          const w = await brain.agent(page, { goal: 'logout', person: testData(p), cacheKey: 'logout', verify: async () => (await page.locator('input[type=password]').first().isVisible().catch(() => false)) || (await page.getByRole('button', { name: /log ?in|sign ?in|create account/i }).first().isVisible().catch(() => false)) });
          if (w.ok) { lo.ok = true; lo.how = 'AI brain'; }
        }
        if (lo.late && lo.late.length) rec.popup = (rec.popup && rec.popup !== 'none' ? rec.popup + '+' : '') + lo.late.join('+') + '(late)';   // a popup the first pass missed, closed just before logout
        if (lo.late && lo.late.ran && !lo.late.stuck) ev.popupStuck = false;                                                                  // the second look found nothing left on screen
        rec.loggedOut = lo.ok; ev.logoutHow = lo.how;
        if (CAPTURE && !rec.ref_link && rec.loggedOut) { try { const g = await extra.relogCapture(page, capCtx(rec, p, page, n)); if (g.ref_link) { rec.ref_link = g.ref_link; rec.ref_source = g.ref_source; } rec.relog = g.relog; if (g.relog === 'ok') rec.loggedOut = g.loggedOut; } catch (e) {} }   // not found: log in again and look there
        if (CAPTURE && !rec.ref_link) { rec.ref_link = extra.guessLink(link, rec.username); rec.ref_source = rec.ref_link ? 'guess' : ''; }
        rec.relinked = await reopenLink(page);                 // retype the referral link after logging out
      } catch (e) { ev.afterError = String(e && e.message).split('\n')[0].slice(0, 90); }
    }
  } catch (e) {
    const msg = String(e && e.message).split('\n')[0];
    if (/has been closed|browser has been|Target closed|Browser closed/i.test(msg)) { ev.browserDied = true; rec.crashed = true; }
    if (phase === 'load') ev.loadError = msg.replace(/^page\.goto: /, '').slice(0, 90);
    else if (!ev.noForm && !ev.noButton) ev.crash = msg.slice(0, 90);
  }
  if (!dry) {
    if (!rec.ok) { const d = diagnose(ev); rec.problem = d.code; rec.why = d.why; rec.fix = d.fix; }
    if (!rec.ok && AI && !ev.browserDied && !ev.loadError) rec.ai = (await brain.explain(page, { code: rec.problem, why: rec.why, raw: rec.raw, api: rec.api, pageErrors: ev.pageErrors }).catch(() => null)) || '';
    if (!ev.loadError && !ev.noForm) {
      const warn = [];
      if (!rec.sponsor_filled) warn.push('sponsor box was empty (the link did not auto-fill it, so the referral cannot be credited)');
      if (!rec.terms) warn.push('terms box could not be ticked');
      if (rec.ok && !rec.welcome) warn.push('welcome card was not seen after sign-up');
      if (rec.ok && ev.popupStuck) warn.push('a popup could not be closed');
      if (rec.ok && !rec.relinked) warn.push('after logout, the referral link did not show the form with the Sponsor box filled');
      if (rec.ok && CAPTURE && rec.ref_source === 'guess') warn.push('own referral link not found on the site, using a best guess: ' + rec.ref_link);
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
const LAUNCH = { headless: !flag('headed'), args: flag('headed') ? [] : ['--no-sandbox', '--disable-dev-shm-usage', '--disable-gpu', '--disable-extensions', '--disable-background-networking', '--mute-audio'] };   // small-server friendly
let browser = await chromium.launch(LAUNCH), relaunching = null;
async function reviveBrowser() {                       // if Chromium died (usually out of memory on a small server), start a new one
  if (browser.isConnected()) return;
  relaunching = relaunching || (async () => { console.log('        browser crashed (probably out of memory): starting a new one'); try { browser = await chromium.launch(LAUNCH); } finally { relaunching = null; } })();
  await relaunching;
}
if (flag('dry')) { await visit(browser, 1, true); await browser.close(); process.exit(0); }

console.log(`\nReferral bot: ${N} random accounts through\n  ${link}\n(password for every test account: ${PASS})\n`);
const results = [], seen = new Set(); let next = 0; const t0 = Date.now();
await Promise.all(Array.from({ length: PAR }, async () => {
  let ctx = null, used = 0;
  const newCtx = async () => {                         // one browser session per worker: create > log out > create ... renewed every 10 accounts to keep memory low
    if (ctx) await ctx.close().catch(() => {});
    ctx = null; used = 0;
    await reviveBrowser();
    if (!FRESH) ctx = await browser.newContext({ viewport: { width: 390, height: 1000 } });
  };
  await newCtx().catch(() => {});
  while (next < N) {
    const n = ++next;
    if (!FRESH && (!ctx || used >= 10)) await newCtx().catch(() => {});
    used++;
    let r;
    try { r = await visit(browser, n, false, ctx); }
    catch (e) { const m = String(e && e.message).split('\n')[0].slice(0, 90); r = { n, username: 'sim_unknown', email: '', phone: '', password: PASS, sponsor: '', sponsor_filled: false, terms: false, welcome: false, continued: false, popup: '', loggedOut: false, relinked: false, ok: false, problem: 'bot_error', why: `The bot hit an unexpected error (${m}).`, fix: 'Send me that message.', raw: '', warn: '', api: '', ai: '', crashed: /closed/i.test(m) }; }
    if (r.crashed) await newCtx().catch(() => {});
    results[n - 1] = r;
    try { fs.writeFileSync(OUT + '/accounts.json', JSON.stringify(results)); } catch (e) {}
    console.log(`  #${String(n).padStart(3)}  ${r.ok ? 'ACCOUNT CREATED' : 'FAILED'}  ${r.username}${r.api ? '  (' + r.api + ')' : ''}`);
    if (r.ok) {
      const steps = [r.welcome ? 'welcome card seen' : 'no welcome card', r.continued ? 'Continue pressed' : '', r.popup && r.popup !== 'none' ? 'popup closed with ' + r.popup : 'no popup', r.loggedOut ? 'logged out' : 'NOT logged out', r.relinked ? 'link typed again, sponsor refilled' : 'link NOT reopened with sponsor'].filter(Boolean).join(' > ');
      console.log(`        ${steps}${r.warn ? '\n        ! ' + r.warn : ''}`);
    } else {
      console.log(`        ${r.why}`);
      if (!seen.has(r.problem)) { seen.add(r.problem); console.log('        what to check: ' + r.fix); }
      if (r.ai) console.log('        AI brain: ' + r.ai);
    }
    fs.appendFileSync(OUT + '/log.txt', new Date().toISOString() + '  #' + n + '  ' + (r.ok ? 'SUCCESS' : 'FAILED') + '  ' + r.username + '  ' + (r.password || '') + '  ' + (r.ok ? (r.relinked ? 'link reopened' : 'link NOT reopened') : r.why) + '\n');
    if (DELAY) await sleep(DELAY);
  }
  if (ctx) await ctx.close();
}));

// ---------- more links and deeper levels (one account at a time, at your pace) ----------
const link0 = link;
results.forEach((r) => { if (r) { r.level = 1; r.via = link0; r.parent = extra ? extra.refCode(link0) : ''; } });
if (extra && (ALL_LINKS.length > 1 || LEVELS > 1)) {
  let xctx = null, xused = 0;
  const xnew = async () => { if (xctx) await xctx.close().catch(() => {}); xctx = null; xused = 0; await reviveBrowser(); if (!FRESH) xctx = await browser.newContext({ viewport: { width: 390, height: 1000 } }); };
  await xnew().catch(() => {});
  const one = async (lnk, level, parent) => {
    const n = results.length + 1;
    if (!FRESH && (!xctx || xused >= 10)) await xnew().catch(() => {});
    xused++; link = lnk;
    let r;
    try { r = await visit(browser, n, false, xctx); }
    catch (e) { r = { n, username: 'sim_unknown', email: '', phone: '', password: PASS, ok: false, problem: 'bot_error', why: String(e && e.message).split('\n')[0].slice(0, 90), fix: '' }; }
    link = link0;
    if (r.crashed) await xnew().catch(() => {});
    Object.assign(r, { level, via: lnk, parent });
    results[n - 1] = r;
    try { fs.writeFileSync(OUT + '/accounts.json', JSON.stringify(results)); } catch (e) {}
    console.log(`  #${String(n).padStart(3)}  L${level}  ${r.ok ? 'ACCOUNT CREATED' : 'FAILED'}  ${r.username}  (through ${parent || lnk})${r.ok && r.ref_link ? '\n        own referral link: ' + r.ref_link + '  [' + r.ref_source + ']' : ''}${r.ok && r.sponsor ? '\n        sponsor box showed: ' + r.sponsor : ''}${r.ok ? '' : '\n        ' + (r.why || '')}`);
    fs.appendFileSync(OUT + '/log.txt', new Date().toISOString() + '  #' + n + '  ' + (r.ok ? 'SUCCESS' : 'FAILED') + '  ' + r.username + '  ' + (r.password || '') + '  L' + level + '  ' + (r.ref_link || '') + '\n');
    if (DELAY) await sleep(DELAY);
    return r;
  };
  for (const lnk of ALL_LINKS.slice(1)) for (let i = 0; i < N; i++) await one(lnk, 1, extra.refCode(lnk));
  for (let lv = 2; lv <= LEVELS; lv++) {
    const parents = results.filter((r) => r && r.ok && r.ref_link && r.level === lv - 1);
    if (!parents.length) { console.log(`\nLevel ${lv}: no account has a referral link, so there is nothing to sign up through.`); break; }
    console.log(`\nLevel ${lv}: signing up through the own referral links of ${parents.length} level-${lv - 1} account(s)...`);
    let made = 0;
    outer: for (const par of parents) for (let k = 0; k < PER_REF; k++) { if (made >= L_MAX) break outer; await one(par.ref_link, lv, par.username); made++; }
  }
  if (xctx) await xctx.close().catch(() => {});
  N = results.length;                                    // the report below counts every account of every link and level
}
await browser.close();

// ---------- report ----------
const good = results.filter((r) => r.ok), bad = results.filter((r) => !r.ok);
const filled = results.filter((r) => r.sponsor_filled), ticked = results.filter((r) => r.terms);
const loaded = results.filter((r) => !['unreachable', 'no_form', 'still_logged_in'].includes(r.problem)).length;
const csvCell = (v) => '"' + String(v).replace(/"/g, '""') + '"';
fs.writeFileSync(`${OUT}/accounts.csv`, ['n,username,email,phone,password,sponsor,terms_ticked,ok,welcome_seen,popup,logged_out,problem,api,site_message,why,warning,ai_note', ...results.map((r) => [r.n, r.username, r.email, r.phone, r.password, r.sponsor, r.terms, r.ok, r.welcome, r.popup, r.loggedOut, r.problem, r.api, r.raw, r.why, r.warn, r.ai].map(csvCell).join(','))].join('\n'));
fs.writeFileSync(`${OUT}/accounts.json`, JSON.stringify(results, null, 2));

const L = [], say = (s = '') => { L.push(s); console.log(s); };
say(`\n========== REFERRAL BOT REPORT ==========`);
say(`Link:     ${link}`);
say(`Date:     ${new Date().toLocaleString()}   (took ${((Date.now() - t0) / 1000).toFixed(1)}s)`);
say(`Accounts: ${good.length} created, ${bad.length} failed, out of ${N}`);
say(NO_MEM ? 'Memory:   off (--no-memory)' : `Memory:   ${mem.users.size} usernames and ${mem.emails.size} emails remembered for future runs (${MEM_FILE})`);
if (brain) say(`AI brain: ${AI ? 'on, ' + brain.stats().calls + ' AI calls (' + brain.stats().model + ')' : 'off'}`);
say(`Sponsor box auto-filled from the link: ${filled.length} of ${N}`);
say(`Terms box ticked:                      ${ticked.length} of ${N}`);
say(`Welcome card seen after sign-up:       ${good.filter((r) => r.welcome).length} of ${good.length}`);
say(`Popup closed (Later / X):              ${good.filter((r) => r.popup && r.popup !== 'none').length} of ${good.length}`);
say(`Logged out before the next account:    ${good.filter((r) => r.loggedOut).length} of ${good.length}`);
say('Link typed again after logout (sponsor refilled): ' + good.filter((r) => r.relinked).length + ' of ' + good.length);
if (good.length) {
  say(`\nACCOUNTS CREATED (compare with the Users list in your admin panel):`);
  good.forEach((r, i) => say(`  ${String(i + 1).padStart(3)}. ${r.username}   ${r.email}`));
}
if (bad.length) {
  say(`\nWHAT WENT WRONG`);
  const groups = {};
  for (const r of bad) (groups[r.problem] = groups[r.problem] || []).push(r);
  for (const [code, list] of Object.entries(groups).sort((a, b) => b[1].length - a[1].length)) {
    say(`\n * ${list.length} account${list.length > 1 ? 's' : ''}: ${list[0].why}`);
    say(`   What to check: ${list[0].fix}`);
    const msg = list.find((r) => r.raw); if (msg) say(`   The site said: "${msg.raw}"`);
    const aiN = list.find((r) => r.ai); if (aiN) say(`   AI brain: ${aiN.ai}`);
    say(`   e.g. ${list.slice(0, 3).map((r) => '#' + r.n).join(', ')}`);
  }
  const firstBad = results.findIndex((r) => !r.ok), top = Object.entries(groups).sort((a, b) => b[1].length - a[1].length)[0][0];
  if (good.length && firstBad > 0 && ['rate_limit', 'blocked', 'captcha'].includes(top)) say(`\nPattern: the first ${firstBad} accounts worked, then the site started refusing. It usually means a limit per device/IP kicks in after a few sign-ups.`);
  else if (!good.length) say(`\nPattern: every account failed. Fix the first problem above and run again; the rest usually disappear.`);
}
if (good.some((r) => !r.loggedOut)) say(`\nWARNING: the bot could not log out ${good.filter((r) => !r.loggedOut).length} account(s) (it cleared the session instead). Send me a screenshot of the page you land on after Continue, showing where Logout is.`);
if (loaded && filled.length < loaded) say(`\nWARNING: the sponsor box was empty for ${loaded - filled.length} account(s). If the link does not fill it, the referral cannot be credited. Check the link is the live one and still contains the sponsor code.`);
if (loaded && ticked.length < loaded) say(`\nWARNING: the terms box could not be ticked for ${loaded - ticked.length} account(s). See filled.png.`);
if (CAPTURE || ALL_LINKS.length > 1 || LEVELS > 1) {
  const okAll = results.filter((r) => r && r.ok), seenOnSite = okAll.filter((r) => r.ref_link && r.ref_source !== 'guess'), guessed = okAll.filter((r) => r.ref_source === 'guess');
  say(`\nOWN REFERRAL LINKS: read from the site for ${seenOnSite.length} of ${okAll.length} accounts` + (guessed.length ? `, ${guessed.length} are best guesses (the bot did not see them on the site)` : ''));
  const byLevel = {};
  for (const r of okAll) (byLevel[r.level || 1] = byLevel[r.level || 1] || []).push(r);
  for (const [lv, list] of Object.entries(byLevel)) {
    say(`\n  LEVEL ${lv}: ${list.length} account(s)`);
    list.forEach((r) => say(`    ${r.username}  password ${r.password}  through ${r.parent || r.via}${r.ref_link ? '\n       own link: ' + r.ref_link + '  [' + r.ref_source + ']' : '\n       own link: not found'}${Number(lv) > 1 ? '\n       sponsor box showed: "' + (r.sponsor || 'EMPTY') + '"' + (r.sponsor_match === false ? '  (link code was ' + r.expect + ')' : '') : ''}`));
  }
  const cols = ['n', 'level', 'through_code', 'via_link', 'username', 'email', 'phone', 'password', 'ok', 'own_referral_link', 'link_source', 'sponsor_box_showed', 'problem'];
  fs.writeFileSync(`${OUT}/accounts-full.csv`, [cols.join(','), ...results.filter(Boolean).map((r) => [r.n, r.level || 1, r.parent || '', r.via || link, r.username, r.email, r.phone, r.password, r.ok ? 'yes' : 'no', r.ref_link || '', r.ref_source || '', r.sponsor || '', r.problem || ''].map(csvCell).join(','))].join('\n'));
  fs.writeFileSync(`${OUT}/ref-links.txt`, okAll.map((r) => `${r.username}  ${r.password}  ${r.ref_link || '(no link)'}`).join('\n'));
  say(`\n  Saved: ${OUT}/accounts-full.csv  (every account, password and own referral link)   ${OUT}/ref-links.txt`);
}
say(`\nNOTE: "created" only means the site accepted the sign-up. The real referral test is next: log in as the sponsor and check the referral list shows ${good.length} new people (they are listed above).`);
say(`\nFiles: ${OUT}/report.txt  ${OUT}/accounts.csv  (screenshots of failures: ${OUT}/fail-N.png)\n`);
fs.writeFileSync(`${OUT}/report.txt`, L.join('\n'));
process.exit(bad.length === 0 && filled.length === N && ticked.length === N ? 0 : 1);
