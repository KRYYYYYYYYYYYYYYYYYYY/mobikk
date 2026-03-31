# subscription-function

Yandex Cloud Function (Node.js 22) that returns subscription data in a format clients can import.

## Quick answer for your `happ://crypt5/...`

Put your full `happ://crypt5/...` line into **`SUBSCRIPTION_TEXT`**.

- `SUBSCRIPTION_TEXT=<your full happ://crypt5/... string>`
- leave `SUBSCRIPTION_URL` empty / unset

If client import still fails with `UnknownContentType`, your client likely expects parsed server links (for example `vless://`, `vmess://`, etc.) instead of a single `happ://...` deeplink line.

## Modes

1. `SUBSCRIPTION_TEXT` — returns literal text as-is.
2. `SUBSCRIPTION_URL` — fetches from upstream HTTP(S) and returns upstream payload/content-type.

If both are set, `SUBSCRIPTION_TEXT` is used.

## Anti-cold-start behavior (for mobile clients)

Proxy mode now includes:

- in-memory cache of last successful payload,
- timeout + one retry for upstream fetch,
- stale response fallback when upstream is slow/down,
- optional static fallback text.

This helps when first mobile request hits a cold function and would otherwise create an empty subscription placeholder.

## Environment variables

Required:

- `SUBSCRIPTION_TEXT` **or** `SUBSCRIPTION_URL`

Optional (proxy mode):

- `FETCH_TIMEOUT_MS` (default `8000`)
- `CACHE_TTL_MS` (default `300000`)
- `FALLBACK_SUBSCRIPTION_TEXT` (returned if upstream fails and cache is empty)

## Yandex Cloud setup example

### A) Direct happ text mode

In Function settings → Environment variables:

- Key: `SUBSCRIPTION_TEXT`
- Value: full `happ://crypt5/...` line (one line, no quotes)

Do not set `SUBSCRIPTION_URL` in this mode.

### B) Proxy mode (recommended when client wants parsed list)

- `SUBSCRIPTION_URL=https://your-working-subscription-url`
- optional: `FETCH_TIMEOUT_MS=8000`
- optional: `CACHE_TTL_MS=300000`

## Keep function warm (important)

If mobile client creates an empty subscription on first request, add a timer trigger in Yandex Cloud to call the function every 1-3 minutes. That keeps runtime warm and fills cache before user import.
