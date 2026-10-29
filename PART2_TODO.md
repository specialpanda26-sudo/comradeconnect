# Payment fixes: what is left (Part 2)
Part 1 done: payout endpoint (/api/v2/withdraw), env vars in render.yaml, expired deposits run onFailed, paid-but-not-delivered reopens the payment, webhook needs an amount and matching phone, STK rate limit, tests/finoq.test.mjs.
Part 2 to do:
1. Double payout: before settlePayout moves a 'sending' withdrawal back to 'requested', ask PayHero GET /api/v2/transaction-status?reference=...
2. Webhook verification against PayHero's transaction-status API (store PayHero's reference when the STK push is accepted).
3. Repair the ~86 stale tests (tests/helpers.mjs still fakes TinyPesa/IntaSend) so npm test is green.
4. Stale text: payments.html, trust.html, trust.js GATEWAYS['finoq'], RENDER.md, DEPLOY.md, .env.example, wrangler.toml.
