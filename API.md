# Comrade Connect API (v7)

Auth: after `POST /api/auth/register`, send headers `X-Aid` and `X-Token` on every call marked [auth].
Admin: header `X-Admin-Key` (the ADMIN_KEY secret). All writes are POST. Errors are `{ "error": "message" }`.

| Area | Endpoint | Notes |
|---|---|---|
| Account | `POST /api/auth/register` | returns `aid, token, recovery_code, referral_code` (show the recovery code once) |
| | `POST /api/auth/recover` `{aid, recovery_code}` | new token, old one stops working |
| | [auth] `GET /api/me`, `POST /api/me/handle`, `POST /api/me/adult {confirm:true}` | |
| Market | [auth] `POST /api/market/listings` | goes to admin review (pending). Needs `contact_phone`. The buyer gets it as `seller_phone` in `GET /api/orders/mine` only after paying |
| | `GET /api/market/listings?page&category&zone`, `GET /api/market/listings/:id` | approved only |
| | [auth] `GET /api/market/mine`, `POST /api/market/listings/:id/remove` | |
| | [auth] `POST /api/market/buy {listing_id, phone}` | returns payment `id`; poll `GET /api/pay/status?id=` (gives `order_id` once paid) |
| Escrow | [auth] `GET /api/orders/mine` | buyer sees the 6-digit `code`; platform fee is 3% (`you_receive` is what the seller gets) |
| | [auth] `POST /api/orders/:id/handed` (seller), `/confirm {code}` (seller), `/received` (buyer, no code needed), `/dispute {reason}` (either) | |
| Wallet | [auth] `GET /api/wallet`, `POST /api/wallet/withdraw {amount, phone}` | needs verified ID |
| Referral | [auth] `POST /api/referral/attribute {code}`, `GET /api/referral/me` | |
| Messages | [auth] `POST /api/messages/send {thread_id | listing_id | ref_type+ref_id | to_aid, body}` | `ref_type`: post, room, service, group (the author is looked up by the Worker, never returned). Hearts chats start from a match |
| | [auth] `GET /api/messages/inbox`, `GET /api/messages/thread/:id` | |
| | [auth] `POST /api/messages/block|unblock|mute {thread_id}`, `/report {message_id, reason}` | mute = 24 h |
| Content | `GET /api/c/{rooms,groups,polls,hearts,wifi,hostels,services,tips}?page&zone` | hearts needs [auth] + 18+ confirm |
| | [auth] `POST /api/c/<same>` create | |
| | [auth] `POST /api/c/groups/:id/join|leave`, `/polls/:id/vote {option}`, `/wifi/:id/vote {value:1|-1}`, `/tips/:id/like`, `/hearts/:id/interest` | |
| | `GET /api/c/zones`, [auth] `POST /api/c/zones/rate {zone,safety,noise,value}` | |
| | [auth] `POST /api/report {type,id,reason}` | type: room group poll hearts wifi hostel service tip clip listing user |
| Public | `GET /api/notices`, `/api/events`, `/api/sponsors` | |
| Media | [auth] `POST /api/media/upload-url {kind, content_type, bytes, listing_id?, caption?}` | then `PUT` the file to the one-time `upload_url` (Supabase Storage; multipart form: `cacheControl` + the file, as supabase-js does), then [auth] `POST /api/media/:id/complete` |
| Clips | `GET /api/clips?page`, [auth] `POST /api/clips/:id/like` | |
| Verify | [auth] `POST /api/verify/upload-url`, `/api/verify/submit {r2_key, full_name, role?, id_number?, group_link?, barcode?}`, `GET /api/verify/status` | class rep and hostel rep need `group_link`; status returns `verified`, `badge`, `request` |
| Live | `GET /api/live`; `POST /api/live/start {title, url}` (club admin or admin key; `url` is a YouTube, Facebook, TikTok or Twitch live link; returns `watch_url` and, for YouTube only, `embed_url`), `/api/live/:id/end` | |
| Club | [auth] `POST /api/club/join`, `GET /api/club/me`, `GET /api/club/products`, [auth] `POST /api/club/order {product_id, qty, phone}`, `GET /api/club/orders/mine` | |
| Tickets | [auth] `POST /api/tickets/buy {event_id, phone}`, `GET /api/tickets/mine` | |
| Payments | [auth] `POST /api/pay` (boost, topup only), `GET /api/pay/status` (manual mode: while `pending` it includes `manual {steps, pay_to, name, amount, ref}`), [auth] `POST /api/pay/confirm {id, code}` (manual mode: the buyer's M-Pesa code; status becomes `submitted`), `POST /api/tinypesa/callback?s=SECRET` (tinypesa mode only) | admin: `POST /api/admin/payments/:id {action: approve\|reject}` confirms or refuses a submitted code |
| Admin | `POST /api/admin/login`, `GET /api/admin/queue`, `GET /api/admin/audit` | |
| | `POST /api/admin/listings/:id {action: approve|reject|remove, reason}` | |
| | `POST /api/admin/verifications/:id {action, note}`, `GET .../image` | |
| | `POST /api/admin/orders/:id {action: release|refund}` | |
| | `POST /api/admin/withdrawals/:id {action: paid|reject, payout_ref}` | |
| | `POST /api/admin/reports/(content|message)/:id {action: action|dismiss, hide, unhide}` | |
| | `POST /api/admin/users/:aid {action: ban|unban|mute|unmute|role, hours, role}` | |
| | `POST /api/admin/(notices|events|sponsors)`, `.../:id {action:"delete"}` | |
| | `POST /api/admin/club/products`, `/club/stock`, `GET /club/orders`, `POST /club/orders/:id/collect`, `/tickets/validate` | |

Rate limits: every write has a per-account and per-IP daily cap (see `throttle(...)` calls). Contact info (phones, links, @handles, spelled-out digits) is rejected server-side on all text.

## v9: money settings (admin-editable)
| Area | Endpoint | Notes |
|---|---|---|
| Public | `GET /api/config` | `fee_percent`, `boost_plans` (`1d`, `3d` with price), `withdraw_min`, `withdraw_fee_percent`, `withdraw_fee_flat`. The app reads this so screens match the server |
| Wallet | [auth] `POST /api/wallet/withdraw/:id/cancel` | only while the request is still waiting; money returns to the wallet |
| | [auth] `GET /api/wallet` | now also returns `rules` and each withdrawal's `fee`, `net`, `payout_ref` |
| Pay | [auth] `POST /api/pay {purpose:'boost', ref_id, plan:'1d'|'3d', phone}` | price and length are fixed by the server from the settings; the phone's amount is ignored |
| Admin | `GET/POST /api/admin/settings {values:{key:number}}` | fee %, boost prices, withdrawal min and fees, referral reward, auto-release days. Applies to new orders/boosts/withdrawals only. Every change is in the audit log |
| | `GET /api/admin/earnings` | market fees (total, last 30 days, in escrow), boosts, withdrawal fees, owed to sellers, paid out |
| | `GET /api/admin/payouts?status=paid|rejected|requested` | payout history |
| | `GET /api/admin/sponsors` | all sponsors incl. paused and ended, with `amount` |
| | `POST /api/admin/(notices|events|sponsors)/:id {action:'update', ...fields}` | edit instead of delete and re-add |

## Points (server-owned)
- `GET /api/points` -> `{ points, per_ksh, value_ksh, daily_cap, earned_today, checked_in, streak }`
- `POST /api/points/checkin` -> once per Kenya day, with a daily cap.
- `POST /api/market/buy` accepts `use_points: true`. Credit = min(fee on the price, floor(points / per_ksh)) KSh, so the seller still receives price - fee.
- Admin settings: `points_per_ksh` (default 10), `points_daily_cap` (default 30). `withdraw_min` now defaults to 1.

## Host an event (user-hosted events and door scanning)
Run `supabase/user-events.sql` once. Any signed-in account can host up to 5 upcoming events. Ticket money goes to the host's wallet (price minus the platform fee).
- [auth] `POST /api/my/events {title, date, venue, ticket_price, capacity?, details?}` returns `id` and `scan_path` (the secret door link)
- [auth] `GET /api/my/events` lists the host's events with `sold`, `scanned`, `you_earn`, `scan_path`
- [auth] `POST /api/my/events/:id/cancel` only while no ticket is sold
- `GET /api/scan/info?e=<event_id>&k=<key>` and `POST /api/scan/check {event_id, key, code}` are the door scanner (no account, the key in the link is the pass). A ticket can be used once.

## Credits
Comrade Connect is built by Ogolla Tech. Developers: Christian N., Peter M.
