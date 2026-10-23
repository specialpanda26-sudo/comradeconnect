// Spill Bot text filter. Returns { ok, action: 'allow'|'review'|'block', reasons }
const VULGAR = ['fuck','shit','bitch','malaya','kuma','pumbavu','mavi','mbwa wewe'];
const LEET = { '0':'o','1':'i','3':'e','4':'a','5':'s','@':'a','$':'s' };

export function checkText(text = '', blockedNames = []) {
  const raw = String(text);
  const lower = raw.toLowerCase();
  const clean = lower.replace(/[013458@$]/g, c => LEET[c] || c).replace(/[^a-z\s]/g, '');
  const reasons = [];
  let action = 'allow';

  for (const w of VULGAR) {
    if (clean.includes(w)) { reasons.push('vulgar'); action = 'block'; break; }
  }
  const digits = raw.replace(/[^\d+]/g, '');
  if (/(?:\+?254|0)[17]\d{8}/.test(digits)) { reasons.push('phone_number'); action = 'block'; }
  if (/\b\d{7,8}\b/.test(raw) && action !== 'block') { reasons.push('id_like_number'); action = 'review'; }
  for (const n of blockedNames) {
    const name = String(n || '').trim().toLowerCase();
    if (name.length > 2 && lower.includes(name)) {
      reasons.push('student_name');
      if (action !== 'block') action = 'review';
      break;
    }
  }
  return { ok: action === 'allow', action, reasons };
}
