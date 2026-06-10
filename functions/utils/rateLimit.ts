type Bucket = { count: number; resetAt: number };

const memoryBuckets = new Map<string, Bucket>();

export function clientIp(request: Request): string {
  return (
    request.headers.get("CF-Connecting-IP") ??
    request.headers.get("X-Forwarded-For")?.split(",")[0]?.trim() ??
    "unknown"
  );
}

export function rateLimitResponse(retryAfterSec: number): Response {
  return new Response(JSON.stringify({ error: "요청이 너무 많습니다. 잠시 후 다시 시도해 주세요." }), {
    status: 429,
    headers: {
      "Content-Type": "application/json",
      "Retry-After": String(retryAfterSec),
    },
  });
}

function checkMemory(key: string, limit: number, windowMs: number): { allowed: boolean; retryAfterSec?: number } {
  const now = Date.now();
  const bucket = memoryBuckets.get(key);

  if (!bucket || now >= bucket.resetAt) {
    memoryBuckets.set(key, { count: 1, resetAt: now + windowMs });
    return { allowed: true };
  }

  if (bucket.count >= limit) {
    return {
      allowed: false,
      retryAfterSec: Math.max(1, Math.ceil((bucket.resetAt - now) / 1000)),
    };
  }

  bucket.count += 1;
  return { allowed: true };
}

async function checkKv(
  kv: KVNamespace,
  key: string,
  limit: number,
  windowMs: number,
): Promise<{ allowed: boolean; retryAfterSec?: number }> {
  const now = Date.now();
  const raw = await kv.get(key);
  let bucket: Bucket;

  if (!raw) {
    bucket = { count: 1, resetAt: now + windowMs };
    await kv.put(key, JSON.stringify(bucket), {
      expirationTtl: Math.max(60, Math.ceil(windowMs / 1000)),
    });
    return { allowed: true };
  }

  try {
    bucket = JSON.parse(raw) as Bucket;
  } catch {
    bucket = { count: 1, resetAt: now + windowMs };
  }

  if (now >= bucket.resetAt) {
    bucket = { count: 1, resetAt: now + windowMs };
    await kv.put(key, JSON.stringify(bucket), {
      expirationTtl: Math.max(60, Math.ceil(windowMs / 1000)),
    });
    return { allowed: true };
  }

  if (bucket.count >= limit) {
    return {
      allowed: false,
      retryAfterSec: Math.max(1, Math.ceil((bucket.resetAt - now) / 1000)),
    };
  }

  bucket.count += 1;
  await kv.put(key, JSON.stringify(bucket), {
    expirationTtl: Math.max(60, Math.ceil((bucket.resetAt - now) / 1000)),
  });
  return { allowed: true };
}

async function checkD1(
  db: D1Database,
  key: string,
  limit: number,
  windowMs: number,
): Promise<{ allowed: boolean; retryAfterSec?: number }> {
  const now = Date.now();
  const row = await db
    .prepare("SELECT count, reset_at FROM rate_limit_buckets WHERE bucket_key = ?")
    .bind(key)
    .first<{ count: number; reset_at: number }>();

  if (!row || now >= row.reset_at) {
    await db
      .prepare(
        `INSERT INTO rate_limit_buckets (bucket_key, count, reset_at) VALUES (?, 1, ?)
         ON CONFLICT(bucket_key) DO UPDATE SET count = 1, reset_at = excluded.reset_at`,
      )
      .bind(key, now + windowMs)
      .run();
    return { allowed: true };
  }

  if (row.count >= limit) {
    return {
      allowed: false,
      retryAfterSec: Math.max(1, Math.ceil((row.reset_at - now) / 1000)),
    };
  }

  await db
    .prepare("UPDATE rate_limit_buckets SET count = count + 1 WHERE bucket_key = ?")
    .bind(key)
    .run();
  return { allowed: true };
}

/** KV → D1 → 인메모리 순으로 분산 rate limit */
export async function checkRateLimit(
  env: { DB?: D1Database; RATE_LIMIT_KV?: KVNamespace },
  key: string,
  limit: number,
  windowMs: number,
): Promise<{ allowed: boolean; retryAfterSec?: number }> {
  try {
    if (env.RATE_LIMIT_KV) {
      return await checkKv(env.RATE_LIMIT_KV, key, limit, windowMs);
    }
    if (env.DB) {
      return await checkD1(env.DB, key, limit, windowMs);
    }
  } catch {
    /* KV/D1 오류 시 인메모리 폴백 */
  }
  return checkMemory(key, limit, windowMs);
}
