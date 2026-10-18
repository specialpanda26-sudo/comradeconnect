// Best-effort per-IP rate limiter for API routes. Sliding-window counter
// held in memory.
//
// IMPORTANT: this resets on every deploy/cold-start and does NOT share state
// across serverless instances — on Vercel each instance gets its own bucket,
// so this is a soft speed bump against casual abuse, not a real defense.
// Before going to production, swap this for Upstash Redis + @upstash/ratelimit
// (or Vercel's Edge Config / KV) so limits are enforced globally.
const buckets = new Map();

export function rateLimit(key, { limit = 10, windowMs = 60_000 } = {}) {
  const now = Date.now();
  const bucket = buckets.get(key);

  if (!bucket || now - bucket.start > windowMs) {
    buckets.set(key, { start: now, count: 1 });
    return { ok: true, remaining: limit - 1 };
  }

  if (bucket.count >= limit) {
    return { ok: false, remaining: 0, retryAfterMs: windowMs - (now - bucket.start) };
  }

  bucket.count += 1;
  return { ok: true, remaining: limit - bucket.count };
}

// Best-effort client identifier from standard proxy headers (Vercel sets
// x-forwarded-for). Falls back to a constant so local dev doesn't crash —
// that means local dev shares one bucket, which is fine for testing.
export function getClientIp(req) {
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim();
  return req.headers.get("x-real-ip") ?? "unknown";
}
