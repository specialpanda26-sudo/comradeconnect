// Password strength for accounts people create themselves. The sign-up screen shows the same score as it types
// (frontend/cc-pass.js); this is the check that cannot be skipped. Admin-made passwords keep the older, lighter rule.
import { goodPassword } from './lib.js';

const COMMON = new Set(('password,password1,password12,password123,passw0rd,p@ssw0rd,qwerty,qwerty12,qwerty123,qwertyui,qwertyuiop,asdfghjk,asdfghjkl,zxcvbnm,zxcvbnm1,' +
  '12345678,123456789,1234567890,11111111,00000000,87654321,abc12345,abcd1234,abcdefgh,iloveyou,iloveyou1,letmein1,welcome1,welcome123,admin123,administrator,' +
  'monkey123,dragon123,football,football1,baseball,superman,princess,sunshine,master123,shadow123,trustno1,whatever,freedom1,' +
  'comrade,comrade1,comrade123,comrades,comradeconnect,connect123,kirinyaga,kirinyaga1,kirinyaga123,kyu12345,kenya123,kenya254,kenya2024,kenya2025,kenya2026,' +
  'nairobi1,nairobi123,mombasa1,kisumu123,nakuru123,mpesa123,mpesa1234,safaricom,harambee,harambee1,jambo123,hakuna123,mamamia1,god12345,jesus123,blessed1,blessing,' +
  'student1,student123,university,campus123,school123,jomo1234,0722000000,0712345678,0700000000,qazwsxedc,1q2w3e4r,1qaz2wsx,q1w2e3r4,zaq12wsx,pass1234,test1234,user1234').split(','));

export function passwordScore(pw, handle) {
  pw = String(pw || ''); const low = pw.toLowerCase();
  if (pw.length < 8) return 0;
  if (COMMON.has(low) || COMMON.has(low.replace(/[^a-z0-9]/g, ''))) return 0;
  if (/^(.)\1+$/.test(pw)) return 0;
  const pool = (/[a-z]/.test(pw) ? 26 : 0) + (/[A-Z]/.test(pw) ? 26 : 0) + (/[0-9]/.test(pw) ? 10 : 0) + (/[^A-Za-z0-9]/.test(pw) ? 33 : 0);
  const uniq = new Set(pw).size;
  let bits = Math.min(pw.length, uniq * 1.6) * Math.log2(Math.max(pool, 2));
  // walking the keyboard or the alphabet, or counting up: worth much less than random characters
  const seq = 'abcdefghijklmnopqrstuvwxyz0123456789', kb = ['qwertyuiop', 'asdfghjkl', 'zxcvbnm', '1234567890'];
  let runs = 0; for (let i = 0; i + 3 <= low.length; i++) { const t = low.slice(i, i + 3); if (seq.includes(t) || kb.some((r) => r.includes(t)) || seq.includes([...t].reverse().join(''))) runs++; }
  bits -= runs * 3;
  if (/(19|20)\d\d$/.test(pw)) bits -= 8;                                   // ends with a year
  if (/^[A-Z]?[a-z]+\d{1,4}[!@#$%^&*.?]?$/.test(pw)) bits -= 8;             // Word + digits, the commonest pattern
  if (handle && String(handle).length >= 3 && low.includes(String(handle).toLowerCase())) bits = Math.min(bits, 27);
  return bits < 28 ? 0 : bits < 38 ? 1 : bits < 52 ? 2 : bits < 66 ? 3 : 4;
}
export const SCORE_LABELS = ['Very weak', 'Weak', 'Fair', 'Good', 'Strong'];

// Seen in a data breach? Uses the free Have I Been Pwned range API: only the first 5 characters of the SHA-1 leave the server (k-anonymity).
// If the service is slow or down, the password is allowed: sign-up never depends on it.
export function pwnedFromRange(text, suffix) {
  for (const line of String(text || '').split('\n')) { const [s, n] = line.trim().split(':'); if (s && s.toUpperCase() === suffix) return Number(n) || 0; }
  return 0;
}
export async function pwnedCount(env, pw) {
  if ((env.PWNED_CHECK ?? '1') === '0') return 0;
  try {
    const d = new Uint8Array(await crypto.subtle.digest('SHA-1', new TextEncoder().encode(String(pw))));
    const hex = [...d].map((b) => b.toString(16).padStart(2, '0')).join('').toUpperCase();
    const ctl = new AbortController(), to = setTimeout(() => ctl.abort(), 2500);
    const r = await fetch('https://api.pwnedpasswords.com/range/' + hex.slice(0, 5), { headers: { 'Add-Padding': 'true' }, signal: ctl.signal }); clearTimeout(to);
    return r.ok ? pwnedFromRange(await r.text(), hex.slice(5)) : 0;
  } catch (e) { return 0; }
}

// Returns a message for the person, or null if the password is fine.
export async function passwordProblem(env, pw, handle) {
  pw = String(pw ?? '');
  if (!goodPassword(pw, handle)) return 'Password: 8 to 100 characters, and not the same as your username';
  if (handle && String(handle).length >= 3 && pw.toLowerCase().includes(String(handle).toLowerCase())) return 'Your password should not contain your username';
  if (passwordScore(pw, handle) < 2) return 'That password is too easy to guess. Make it longer, or mix letters, numbers and symbols.';
  if ((await pwnedCount(env, pw)) >= 5) return 'That password has appeared in known data breaches. Pick a different one.';
  return null;
}
