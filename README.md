# subscription-function

Yandex Cloud Function (Node.js 22) that returns subscription data in a format clients can import.

## What changed for real `crypt5`

You can now use Happ encryption API directly from this function.

If your raw source works (for example GitHub raw `.txt`), configure:

- `SUBSCRIPTION_URL=https://raw.githubusercontent.com/.../wifi.txt`
- `OUTPUT_MODE=encrypt_api`
- `SAYORI_API_KEY=<your api key>`
- optional: `ENCRYPT_VERSION=crypt5`

Function flow:

1. downloads plain subscription from `SUBSCRIPTION_URL`
2. sends it to encryption API (`/v1/encrypt`)
3. returns API `result` (expected `happ://crypt...`)

## Output modes

- `OUTPUT_MODE=raw` (default) — returns source exactly as-is.
- `OUTPUT_MODE=base64` — returns base64 text of subscription.
- `OUTPUT_MODE=fake_crypt5` — local wrapper `happ://crypt5/<base64_payload>` (not real encryption).
- `OUTPUT_MODE=encrypt_api` — real encryption through API (`x-api-key` required).

## Required env vars by mode

### A) Inline mode

- `SUBSCRIPTION_TEXT=<your text>`

### B) Proxy mode

- `SUBSCRIPTION_URL=<http/https source>`

### C) Real Happ encryption mode

- `SUBSCRIPTION_URL` (or `SUBSCRIPTION_TEXT`)
- `OUTPUT_MODE=encrypt_api`
- `SAYORI_API_KEY=<key>`
- optional `ENCRYPT_VERSION=crypt5` (`crypt`, `crypt2`, `crypt3`, `crypt4`, `crypt5`)
- optional `ENCRYPT_ENDPOINT=https://api.sayori.cc/v1/encrypt`
- optional `ENCRYPT_TIMEOUT_MS=8000`

## Proxy reliability features

- in-memory cache of last successful payload,
- timeout + one retry for upstream fetch,
- stale response fallback,
- optional `FALLBACK_SUBSCRIPTION_TEXT`.

## Keep function warm

Add a timer trigger in Yandex Cloud to call function every 1–3 minutes to reduce first-request cold-start failures.
