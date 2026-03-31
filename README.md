# subscription-function

Yandex Cloud Function (Node.js 22) for subscription delivery.

## Core limitation (important)

You cannot reliably "fake browser fingerprint" for subscription import.
When Happ updates subscription by URL, it usually performs backend HTTP fetch and expects subscription/config format directly.
It does **not** execute browser JavaScript redirect flow the same way as manual tap/open in browser.

So there are two separate flows:

1. **Subscription URL update** → must return valid config list (`raw` mode recommended).
2. **Manual browser open** → can redirect/open `happ://...` deeplink.

## Stable mode for subscriptions (recommended)

- `SUBSCRIPTION_URL=https://raw.githubusercontent.com/.../Goida.txt`
- `OUTPUT_MODE=raw`

If this file already contains valid configs (vless/vmess/etc), this is the mode that should work for background updates.

## Deeplink mode for manual open

Set:

- `HAPP_DEEPLINK_URL=happ://crypt5/...`

Then use function URL with query:

- `?open=redirect` → HTTP 302 to `happ://...`
- `?open=page` → HTML page that calls `window.location.href='happ://...'`

This mode is for manual click/open and may not work for subscription parser update jobs.

## Encryption mode (`encrypt_api`)

Still available, but only for small payloads:

- `OUTPUT_MODE=encrypt_api`
- `SAYORI_API_KEY=<key>`
- optional `MAX_ENCRYPT_INPUT_BYTES=4096`

Large full subscriptions converted into one deeplink often break client parsing.

## Other output modes

- `raw` (default)
- `base64`
- `fake_crypt5` (wrapper, not real crypt)
- `encrypt_api` (real API)

## Proxy reliability

- in-memory cache,
- timeout + retry,
- stale fallback,
- optional `FALLBACK_SUBSCRIPTION_TEXT`.

## Keep function warm

Add timer trigger every 1–3 minutes to reduce first-request cold starts.
