# subscription-function

Yandex Cloud Function (Node.js 22) that returns subscription data in a format clients can import.

## Your new tactic (works with GitHub raw URL)

If `https://raw.githubusercontent.com/.../wifi.txt` imports perfectly, use it as upstream:

- `SUBSCRIPTION_URL=https://raw.githubusercontent.com/.../wifi.txt`
- keep `SUBSCRIPTION_TEXT` empty

Then choose output mode with `OUTPUT_MODE`.

## Output modes

- `OUTPUT_MODE=raw` (default) — returns source exactly as-is.
- `OUTPUT_MODE=base64` — returns base64 text of subscription.
- `OUTPUT_MODE=fake_crypt5` — wraps as `happ://crypt5/<base64_payload>`.

⚠️ `fake_crypt5` is only obfuscation, **not real happ crypt5 encryption/signature**. If your client validates real crypt5 format, it may reject this mode.

## Modes

1. `SUBSCRIPTION_TEXT` — returns literal text as-is (or transformed by `OUTPUT_MODE`).
2. `SUBSCRIPTION_URL` — fetches from upstream HTTP(S) and returns upstream payload/content-type (or transformed by `OUTPUT_MODE`).

If both are set, `SUBSCRIPTION_TEXT` is used.

## Anti-cold-start behavior (for mobile clients)

Proxy mode includes:

- in-memory cache of last successful payload,
- timeout + one retry for upstream fetch,
- stale response fallback when upstream is slow/down,
- optional static fallback text.

## Environment variables

Required:

- `SUBSCRIPTION_TEXT` **or** `SUBSCRIPTION_URL`

Optional:

- `OUTPUT_MODE` = `raw` | `base64` | `fake_crypt5` (default `raw`)
- `FETCH_TIMEOUT_MS` (default `8000`)
- `CACHE_TTL_MS` (default `300000`)
- `FALLBACK_SUBSCRIPTION_TEXT` (returned if upstream fails and cache is empty)

## Recommended setup for your case

1. Put working source in `SUBSCRIPTION_URL` (the same raw GitHub link that already works).
2. Start with `OUTPUT_MODE=raw` and verify import.
3. If you only need “hidden text” try `OUTPUT_MODE=base64`.
4. If you specifically need `happ://crypt5/...` shape, test `OUTPUT_MODE=fake_crypt5`.
5. If client rejects fake mode, you need the **real crypt5 encoder from Happ**, not this function wrapper.

## Keep function warm (important)

Add a timer trigger in Yandex Cloud to call the function every 1–3 minutes to reduce cold-start issues on first mobile import.
