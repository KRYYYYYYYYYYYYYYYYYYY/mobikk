const DEFAULT_CONTENT_TYPE = "text/plain; charset=utf-8";
const DEFAULT_TIMEOUT_MS = 8000;
const DEFAULT_CACHE_TTL_MS = 5 * 60 * 1000;
const DEFAULT_ENCRYPT_ENDPOINT = "https://api.sayori.cc/v1/encrypt";
const DEFAULT_MAX_ENCRYPT_INPUT_BYTES = 4096;

const cache = {
  body: null,
  contentType: DEFAULT_CONTENT_TYPE,
  updatedAt: 0
};

function toNumber(value, fallback) {
  const parsed = Number.parseInt(value ?? "", 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function baseHeaders(contentType = DEFAULT_CONTENT_TYPE) {
  return {
    "Content-Type": contentType,
    "Cache-Control": "no-store",
    "Access-Control-Allow-Origin": "*"
  };
}

function success(body, contentType = DEFAULT_CONTENT_TYPE, extraHeaders = {}) {
  return {
    statusCode: 200,
    headers: {
      ...baseHeaders(contentType),
      ...extraHeaders
    },
    body
  };
}

function toBase64(input) {
  return Buffer.from(input, "utf-8").toString("base64");
}


function byteLengthUtf8(input) {
  return Buffer.byteLength(input, "utf-8");
}

async function encryptWithSayori(payload) {
  const apiKey = process.env.SAYORI_API_KEY?.trim();

  if (!apiKey) {
    throw new Error("Missing SAYORI_API_KEY");
  }

  const endpoint = process.env.ENCRYPT_ENDPOINT?.trim() || DEFAULT_ENCRYPT_ENDPOINT;
  const version = process.env.ENCRYPT_VERSION?.trim() || "crypt5";
  const timeoutMs = toNumber(process.env.ENCRYPT_TIMEOUT_MS, DEFAULT_TIMEOUT_MS);
  const maxInputBytes = toNumber(process.env.MAX_ENCRYPT_INPUT_BYTES, DEFAULT_MAX_ENCRYPT_INPUT_BYTES);
  const allowLargeEncrypt = (process.env.ALLOW_LARGE_ENCRYPT ?? "false").trim().toLowerCase() === "true";
  const payloadBytes = byteLengthUtf8(payload);

  if (!allowLargeEncrypt && payloadBytes > maxInputBytes) {
    throw new Error(`Encryption input too large (${payloadBytes} bytes). Use OUTPUT_MODE=raw for full subscriptions.`);
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(endpoint, {
      method: "POST",
      signal: controller.signal,
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey
      },
      body: JSON.stringify({
        data: payload,
        version
      })
    });

    if (!response.ok) {
      throw new Error(`Encryption API failed with ${response.status}`);
    }

    const json = await response.json();

    if (!json?.success || typeof json.result !== "string" || !json.result.trim()) {
      throw new Error("Encryption API returned invalid result");
    }

    return json.result.trim();
  } finally {
    clearTimeout(timer);
  }
}

async function applyOutputMode(payload) {
  const outputMode = process.env.OUTPUT_MODE?.trim() || "raw";

  if (outputMode === "base64") {
    return toBase64(payload);
  }

  if (outputMode === "fake_crypt5") {
    return `happ://crypt5/${toBase64(payload)}`;
  }

  if (outputMode === "encrypt_api") {
    return encryptWithSayori(payload);
  }

  return payload;
}

async function fetchWithTimeout(url, timeoutMs) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetch(url, {
      redirect: "follow",
      signal: controller.signal,
      headers: {
        "User-Agent": "YandexCloudFunction/Node22 subscription-proxy"
      }
    });
  } finally {
    clearTimeout(timer);
  }
}

async function fetchUpstream(upstreamUrl, timeoutMs) {
  let lastError;

  for (let attempt = 1; attempt <= 2; attempt += 1) {
    try {
      const upstreamResponse = await fetchWithTimeout(upstreamUrl, timeoutMs);

      if (!upstreamResponse.ok) {
        lastError = new Error(`Upstream status ${upstreamResponse.status}`);
        continue;
      }

      const body = await upstreamResponse.text();
      const contentType = upstreamResponse.headers.get("content-type") || DEFAULT_CONTENT_TYPE;
      return { body, contentType };
    } catch (error) {
      lastError = error;
    }
  }

  throw lastError ?? new Error("Upstream request failed");
}


function getQueryParam(event, key) {
  return event?.queryStringParameters?.[key] ?? event?.queryString?.[key] ?? null;
}

function htmlDeeplinkPage(url) {
  const safeUrl = String(url).replace(/"/g, "&quot;");
  return `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <title>Open Happ</title>
</head>
<body>
  <p>Opening Happ...</p>
  <p><a href="${safeUrl}">If not opened automatically, tap here</a></p>
  <script>window.location.href = "${safeUrl}";</script>
</body>
</html>`;
}

async function formatSuccess(payload, contentType, extraHeaders = {}) {
  try {
    const transformed = await applyOutputMode(payload);
    return success(transformed, contentType, extraHeaders);
  } catch (error) {
    const failOpen = (process.env.OUTPUT_FAIL_OPEN ?? "true").trim().toLowerCase() === "true";

    if (failOpen) {
      return success(payload, contentType, {
        ...extraHeaders,
        "X-Output-Mode-Fallback": "raw",
        "X-Output-Mode-Error": error.message
      });
    }

    throw error;
  }
}

export async function handler(event = {}) {
  const inlineSubscription = process.env.SUBSCRIPTION_TEXT?.trim();
  const fallbackSubscription = process.env.FALLBACK_SUBSCRIPTION_TEXT?.trim();
  const upstreamUrl = process.env.SUBSCRIPTION_URL?.trim();
  const happDeeplink = process.env.HAPP_DEEPLINK_URL?.trim();
  const deeplinkMode = getQueryParam(event, "open");

  try {
    if (happDeeplink && deeplinkMode === "redirect") {
      return {
        statusCode: 302,
        headers: {
          ...baseHeaders(DEFAULT_CONTENT_TYPE),
          Location: happDeeplink
        },
        body: ""
      };
    }

    if (happDeeplink && deeplinkMode === "page") {
      return success(htmlDeeplinkPage(happDeeplink), "text/html; charset=utf-8");
    }
    if (inlineSubscription) {
      return await formatSuccess(inlineSubscription, DEFAULT_CONTENT_TYPE);
    }

    if (!upstreamUrl) {
      return {
        statusCode: 500,
        headers: baseHeaders(),
        body: "Missing SUBSCRIPTION_TEXT or SUBSCRIPTION_URL"
      };
    }

    const timeoutMs = toNumber(process.env.FETCH_TIMEOUT_MS, DEFAULT_TIMEOUT_MS);
    const cacheTtlMs = toNumber(process.env.CACHE_TTL_MS, DEFAULT_CACHE_TTL_MS);
    const now = Date.now();
    const isFresh = cache.body && now - cache.updatedAt < cacheTtlMs;

    if (isFresh) {
      return await formatSuccess(cache.body, cache.contentType, { "X-Subscription-Cache": "HIT" });
    }

    try {
      const fetched = await fetchUpstream(upstreamUrl, timeoutMs);
      cache.body = fetched.body;
      cache.contentType = fetched.contentType;
      cache.updatedAt = now;

      return await formatSuccess(fetched.body, fetched.contentType, { "X-Subscription-Cache": "MISS" });
    } catch {
      if (cache.body) {
        return await formatSuccess(cache.body, cache.contentType, {
          "X-Subscription-Cache": "STALE",
          Warning: '110 - "Response is stale"'
        });
      }

      if (fallbackSubscription) {
        return await formatSuccess(fallbackSubscription, DEFAULT_CONTENT_TYPE, {
          "X-Subscription-Cache": "FALLBACK_TEXT"
        });
      }

      return {
        statusCode: 502,
        headers: baseHeaders(),
        body: "Upstream request failed"
      };
    }
  } catch (error) {
    return {
      statusCode: 500,
      headers: baseHeaders(),
      body: `Output transform failed: ${error.message}. Tip: use OUTPUT_MODE=raw for full subscription lists.`
    };
  }
}
