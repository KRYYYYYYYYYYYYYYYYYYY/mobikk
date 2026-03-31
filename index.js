const DEFAULT_CONTENT_TYPE = "text/plain; charset=utf-8";
const DEFAULT_TIMEOUT_MS = 8000;
const DEFAULT_CACHE_TTL_MS = 5 * 60 * 1000;

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

function applyOutputMode(payload) {
  const outputMode = process.env.OUTPUT_MODE?.trim() || "raw";

  if (outputMode === "base64") {
    return toBase64(payload);
  }

  if (outputMode === "fake_crypt5") {
    return `happ://crypt5/${toBase64(payload)}`;
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

export async function handler() {
  const inlineSubscription = process.env.SUBSCRIPTION_TEXT?.trim();
  const fallbackSubscription = process.env.FALLBACK_SUBSCRIPTION_TEXT?.trim();
  const upstreamUrl = process.env.SUBSCRIPTION_URL?.trim();

  if (inlineSubscription) {
    return success(applyOutputMode(inlineSubscription));
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
    return success(applyOutputMode(cache.body), cache.contentType, { "X-Subscription-Cache": "HIT" });
  }

  try {
    const fetched = await fetchUpstream(upstreamUrl, timeoutMs);
    cache.body = fetched.body;
    cache.contentType = fetched.contentType;
    cache.updatedAt = now;

    return success(applyOutputMode(fetched.body), fetched.contentType, { "X-Subscription-Cache": "MISS" });
  } catch {
    if (cache.body) {
      return success(applyOutputMode(cache.body), cache.contentType, {
        "X-Subscription-Cache": "STALE",
        Warning: '110 - "Response is stale"'
      });
    }

    if (fallbackSubscription) {
      return success(applyOutputMode(fallbackSubscription), DEFAULT_CONTENT_TYPE, {
        "X-Subscription-Cache": "FALLBACK_TEXT"
      });
    }

    return {
      statusCode: 502,
      headers: baseHeaders(),
      body: "Upstream request failed"
    };
  }
}
