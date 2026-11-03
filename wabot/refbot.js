// Referral tester (admin only). Runs scripts/referral-bot.mjs (Playwright) as a child process on this server,
// keeps its live log, and hands the result to the admin panel (Bot > Referral tester).
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import dns from 'node:dns/promises';
import net from 'node:net';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const MAX_ACCOUNTS = 100;
let run = null;                                         // the current or last run (one at a time)

const clean = (s) => String(s).replace(/\x1b\[[0-9;]*[A-Za-z]/g, '').replace(/\r/g, '');

function privateIp(ip) {
  if (net.isIPv6(ip)) return /^(::1?|fc|fd|fe80)/i.test(ip) || /^::ffff:(127\.|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|169\.254\.)/i.test(ip);
  const [a, b] = ip.split('.').map(Number);
  return a === 0 || a === 10 || a === 127 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || a >= 224;
}
// The bot only visits public websites (never this server's own network). Optional: REFBOT_HOSTS=site1.com,site2.com limits it further.
async function checkLink(raw, env) {
  let u; try { u = new URL(String(raw || '').trim()); } catch (e) { throw new Error('That is not a link. It must start with https://'); }
  if (!/^https?:$/.test(u.protocol)) throw new Error('The link must start with https://');
  const host = u.hostname.toLowerCase();
  if (env.REFBOT_HOSTS) {
    const ok = String(env.REFBOT_HOSTS).toLowerCase().split(',').map((x) => x.trim()).filter(Boolean).some((h) => host === h || host.endsWith('.' + h));
    if (!ok) throw new Error('This site is not on the allowed list (REFBOT_HOSTS) on the server.');
  }
  if (host === 'localhost' || /\.(local|internal|localdomain)$/.test(host)) throw new Error('The bot only tests public websites.');
  const ips = net.isIP(host) ? [host] : (await dns.lookup(host, { all: true }).catch(() => [])).map((x) => x.address);
  if (!ips.length) throw new Error('The server could not find that website. Check the link spelling.');
  if (ips.some(privateIp)) throw new Error('The bot only tests public websites.');
  return u.toString();
}

function playwrightInstalled() { try { createRequire(import.meta.url).resolve('playwright'); return true; } catch (e) { return false; } }
function browserInstalled() { try { const { chromium } = createRequire(import.meta.url)('playwright'); return fs.existsSync(chromium.executablePath()); } catch (e) { return false; } }
function scriptPath(env) { return env.REFBOT_SCRIPT || path.join(ROOT, 'scripts', 'referral-bot.mjs'); }

function view(withResult) {
  if (!run) return { state: 'idle', ready: playwrightInstalled(), browser: browserInstalled(), hasScript: fs.existsSync(scriptPath(process.env)), ai: !!(process.env.GEMINI_API_KEY || process.env.GROQ_API_KEY) };
  const r = run;
  const out = { state: r.state, ready: true, hasScript: true, ai: !!(process.env.GEMINI_API_KEY || process.env.GROQ_API_KEY), link: r.link, dry: r.dry, count: r.count, created: r.created, failed: r.failed, startedAt: r.startedAt, endedAt: r.endedAt, log: r.log.slice(-120), hint: r.hint || '' };
  if (withResult || r.state !== 'running') { out.accounts = r.accounts; out.report = r.report; out.shots = r.shots; }
  return out;
}

function readResult(r) {
  const d = path.join(r.dir, 'referral-bot-out');
  try {
    const list = JSON.parse(fs.readFileSync(path.join(d, 'accounts.json'), 'utf8'));
    r.accounts = list.filter(Boolean).map((a) => ({ n: a.n, username: a.username, password: a.password, ok: !!a.ok, sponsor: a.sponsor_filled ? 'filled' : 'empty', welcome: !!a.welcome, popup: a.popup || '', loggedOut: !!a.loggedOut, relinked: !!a.relinked, problem: a.problem || '', why: a.why || '', warn: a.warn || '', api: a.api || '' }));
  } catch (e) { r.accounts = []; }
  try { r.report = fs.readFileSync(path.join(d, 'report.txt'), 'utf8').slice(0, 20000); } catch (e) { r.report = ''; }
  try { r.shots = fs.readdirSync(d).filter((f) => /^(page|filled|welcome|fail-\d+)\.png$/.test(f)).slice(0, 30); } catch (e) { r.shots = []; }
}

async function start(body, env) {
  if (run && run.state === 'running') throw new Error('A test is already running. Stop it first or wait for it to finish.');
  if (!body.dry && body.confirm !== true) throw new Error('Tick the box to confirm this is your own site and the accounts will be real.');
  const link = await checkLink(body.link, env);
  const dry = !!body.dry;
  const count = Math.max(1, Math.min(MAX_ACCOUNTS, parseInt(body.count, 10) || 5));
  const delay = Math.max(500, Math.min(30000, parseInt(body.delay, 10) || 1500));
  const domain = String(body.domain || '').trim().toLowerCase();
  if (domain && !/^[a-z0-9][a-z0-9.-]{1,60}\.[a-z]{2,}$/.test(domain)) throw new Error('The email domain looks wrong. Use something like mydomain.com');
  const pass = String(body.pass || '').trim();
  if (pass && !/^[A-Za-z0-9!@#$%^&*_.+=-]{8,40}$/.test(pass)) throw new Error('Password: 8 to 40 letters, numbers or the symbols ! @ # $ % ^ & * _ . + = -');
  const script = scriptPath(env);
  if (!fs.existsSync(script)) throw new Error('scripts/referral-bot.mjs is not in the repo. Add it, push, and let Render redeploy.');
  if (!playwrightInstalled()) throw new Error('Playwright is not installed on the server yet. Add it to package.json and the Render build command (see the setup steps).');

  if (run && run.dir) { try { fs.rmSync(run.dir, { recursive: true, force: true }); } catch (e) {} }
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'refbot-'));
  const args = [script, link, ...(dry ? ['--dry'] : [String(count), '--yes', '--delay=' + delay]), ...(domain ? ['--domain=' + domain] : []), ...(pass ? ['--pass=' + pass] : [])];
  const cenv = { PATH: process.env.PATH, HOME: process.env.HOME || dir, TMPDIR: os.tmpdir(), NODE_ENV: 'production' };
  if (process.env.PLAYWRIGHT_BROWSERS_PATH) cenv.PLAYWRIGHT_BROWSERS_PATH = process.env.PLAYWRIGHT_BROWSERS_PATH;
  for (const k of ['GEMINI_API_KEY', 'GEMINI_MODEL', 'GEMINI_FALLBACK', 'GROQ_API_KEY', 'GROQ_MODEL', 'REFBOT_EMAIL_BASE']) if (process.env[k]) cenv[k] = process.env[k];   // the AI brain (scripts/referral-brain.mjs) uses the site's own Gemini key
  const r = run = { id: Date.now(), state: 'running', link, dry, count: dry ? 1 : count, created: 0, failed: 0, startedAt: Date.now(), endedAt: 0, log: [], dir, accounts: [], report: '', shots: [], hint: '', child: null };
  const push = (chunk) => {
    for (const raw of clean(chunk).split('\n')) {
      const line = raw.trimEnd(); if (!line.trim()) continue;
      r.log.push(line.slice(0, 300)); if (r.log.length > 400) r.log.shift();
      const m = line.match(/^\s*#\s*\d+\s+(ACCOUNT CREATED|FAILED)/);
      if (m) { if (m[1] === 'FAILED') r.failed++; else r.created++; }
      if (/Executable doesn't exist|browserType\.launch|error while loading shared libraries/i.test(line)) r.hint = 'The browser (Chromium) is not installed on the server, or it is missing system libraries. See the setup steps: the Render build command must also run the Playwright install.';
      if (/Playwright is not installed/i.test(line)) r.hint = 'Playwright is not installed on the server.';
    }
  };
  const child = spawn(process.execPath, args, { cwd: dir, env: cenv, stdio: ['ignore', 'pipe', 'pipe'] });
  r.child = child;
  child.stdout.on('data', push); child.stderr.on('data', push);
  const killer = setTimeout(() => { if (r.state === 'running') { r.timedOut = true; try { child.kill('SIGKILL'); } catch (e) {} } }, Math.min(7200e3, (dry ? 150 : 180 + count * 70) * 1000));
  child.on('error', (e) => { push('Could not start the bot: ' + e.message); });
  child.on('close', (code) => {
    clearTimeout(killer);
    readResult(r);
    r.endedAt = Date.now(); r.child = null;
    const okN = r.accounts.filter((a) => a.ok).length;
    if (!dry && r.accounts.length) { r.created = okN; r.failed = r.accounts.length - okN; }
    r.state = r.stopped ? 'stopped' : r.timedOut ? 'timeout' : (code === 0 || (code === 1 && (r.accounts.length || dry))) ? ((dry || okN) ? 'done' : 'nocreate') : 'failed';
    if (r.state === 'failed' && !r.hint && !r.log.length) r.hint = 'The bot stopped without saying why.';
  });
  return view();
}

function stop() {
  if (run && run.state === 'running' && run.child) { run.stopped = true; try { run.child.kill('SIGTERM'); } catch (e) {} setTimeout(() => { try { run.child && run.child.kill('SIGKILL'); } catch (e) {} }, 4000).unref(); }
  return view();
}

function shot(name) {
  if (!run || !/^(page|filled|welcome|fail-\d+)\.png$/.test(String(name))) throw new Error('No such screenshot.');
  const f = path.join(run.dir, 'referral-bot-out', name);
  const st = fs.statSync(f);
  if (st.size > 3e6) throw new Error('That screenshot is too large to show here.');
  return { data: 'data:image/png;base64,' + fs.readFileSync(f).toString('base64') };
}

// p = path after /api/admin/wa/refbot/
export async function handle(p, method, body, env) {
  if (p === 'status' && method === 'GET') return view();
  if (p === 'start' && method === 'POST') return start(body || {}, env);
  if (p === 'stop' && method === 'POST') return stop();
  if (p === 'shot' && method === 'POST') return shot(body && body.name);
  const e = new Error('Not found'); throw e;
}
