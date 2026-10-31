import fs from 'node:fs';
import path from 'node:path';
// Where the WhatsApp login and bot settings live. On Render add a Disk mounted at /data so they survive redeploys.
export const DIR = process.env.WA_SESSION_DIR || (fs.existsSync('/data') ? '/data/wa-session' : path.resolve('wa-session'));
export const ensureDir = () => { try { fs.mkdirSync(DIR, { recursive: true }); } catch (e) {} };
export const readJson = (f, d) => { try { return JSON.parse(fs.readFileSync(path.join(DIR, f), 'utf8')); } catch (e) { return d; } };
export const writeJson = (f, v) => { try { ensureDir(); fs.writeFileSync(path.join(DIR, f), JSON.stringify(v)); } catch (e) {} };
