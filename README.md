# subscription-function

Yandex Cloud Function (Node.js 22) for subscription delivery.

## Important: why encrypted mode broke your client

If your source subscription has many servers (for example tens/hundreds of lines), converting the **whole list** into one `happ://crypt5/...` deeplink usually becomes too large and clients can fail with parse/database errors.

For full subscription lists, use:

- `OUTPUT_MODE=raw` (recommended)
- `SUBSCRIPTION_URL=<working raw txt url>`

This is the stable mode.

## Real encryption mode (`encrypt_api`)

Use only when payload is small enough for deeplink style usage.

Required vars:

- `OUTPUT_MODE=encrypt_api`
- `SAYORI_API_KEY=<key>`
- `SUBSCRIPTION_URL` or `SUBSCRIPTION_TEXT`

Optional vars:

- `ENCRYPT_VERSION=crypt5`
- `ENCRYPT_ENDPOINT=https://api.sayori.cc/v1/encrypt`
- `ENCRYPT_TIMEOUT_MS=8000`
- `MAX_ENCRYPT_INPUT_BYTES=4096` (default guard)
- `ALLOW_LARGE_ENCRYPT=true` (override guard, risky)

If encryption fails, function now defaults to **fail-open** and returns raw payload with headers:

- `X-Output-Mode-Fallback: raw`
- `X-Output-Mode-Error: <reason>`

Set `OUTPUT_FAIL_OPEN=false` if you want hard failure instead.

## Output modes

- `raw` (default) — return source as-is.
- `base64` — return base64 text.
- `fake_crypt5` — `happ://crypt5/<base64>` wrapper (not real crypt).
- `encrypt_api` — real API encryption.

## Proxy reliability

- in-memory cache of last successful payload,
- timeout + one retry for upstream fetch,
- stale response fallback,
- optional `FALLBACK_SUBSCRIPTION_TEXT`.

## Minimal config that should work for your case

- `SUBSCRIPTION_URL=https://raw.githubusercontent.com/.../wifi.txt`
- `OUTPUT_MODE=raw`
- do **not** set encryption vars

## Keep function warm

Add a timer trigger every 1–3 minutes to reduce first-request cold starts.
