// Spill Bot text filter. Returns { ok, action: 'allow'|'review'|'block', reasons }
const VULGAR = ['fuck','shit','bitch','malaya','kuma','pumbavu','mavi','mbwa wewe'];
const VRE = VULGAR.map(w => new RegExp('(^|\\s)' + w));
const LEET = { '0':'o','1':'i','3':'e','4':'a','5':'s','@':'a','$':'s' };
const PHONE = /(?:\+?254|\b0)[\s.\-]?[17](?:[\s.\-]?\d){8}\b/;

export function checkText(text = '', blockedNames = []) {
  const raw = String(text);
  const lower = raw.toLowerCase();
  const clean = lower.replace(/[013458@$]/g, c => LEET[c] || c).replace(/[^a-z\s]/g, '').replace(/\s+/g, ' ');
  const reasons = [];
  let action = 'allow';
  if (VRE.some(r => r.test(clean))) { reasons.push('vulgar'); action = 'block'; }
  if (PHONE.test(raw)) { reasons.push('phone_number'); action = 'block'; }
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
