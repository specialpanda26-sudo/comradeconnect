// Single source of truth for the referral/points mechanic.
// Tune these two numbers before launch — nothing else in the codebase
// should hardcode a points value or conversion rate.

// Points credited to the referrer when someone they invited completes a paid purchase.
export const REFERRAL_POINTS_PER_SIGNUP = 100;

// Redemption rate: how many points equal KSh 1 off at checkout.
// 2 points = KSh 1, so 100 points ≈ KSh 50.
export const POINTS_TO_KSH_RATE = 2;

export function pointsToKsh(points) {
  return Math.floor(points / POINTS_TO_KSH_RATE);
}

// Platform commission taken from every ticket sale.
export const COMMISSION_RATE = 0.1; // 10%

export const CATEGORIES = [
  { value: "fashion", label: "Fashion" },
  { value: "dressing", label: "Dressing Comp" },
  { value: "dance", label: "Dance" },
  { value: "campus", label: "Campus" },
  { value: "club", label: "Club Night" },
  { value: "art", label: "Art & Culture" },
  { value: "other", label: "Other" },
];

// Regex used to block phone numbers being pasted into event descriptions
// (buyers must pay through Mtaa Vibes, not a side M-Pesa number).
export const KENYAN_PHONE_REGEX = /(\+?254|0)?[71]\d{8}/g;

// Normalizes Kenyan phone numbers to bare E.164 digits (no leading +) so
// numbers entered as "0712...", "+254712...", or "254712..." all compare
// equal. Used wherever we need to match a buyer's OTP-verified session phone
// against a phone typed at checkout (tickets.buyer_phone).
export function normalizePhone(raw) {
  if (!raw) return "";
  const digits = String(raw).replace(/\D/g, "");
  if (digits.startsWith("254")) return digits;
  if (digits.startsWith("0")) return `254${digits.slice(1)}`;
  if (digits.startsWith("7") || digits.startsWith("1")) return `254${digits}`;
  return digits;
}

// Checkout has always accepted phone numbers in whatever format the buyer
// typed (0712…, 254712…, +254712…); this generates the equivalent set so a
// lookup by the OTP-verified session phone (always normalized) still finds
// tickets stored under any of those historical formats.
export function phoneVariants(normalized) {
  if (!normalized) return [];
  const local = normalized.startsWith("254") ? normalized.slice(3) : normalized;
  return [normalized, `+${normalized}`, `0${local}`, local];
}
