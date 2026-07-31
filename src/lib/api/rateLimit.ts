/**
 * 인스턴스 메모리 슬라이딩 윈도우 rate limit (베타용).
 * 서버리스 인스턴스마다 별도이므로 완벽한 전역 한도는 아님.
 */

type Bucket = { timestamps: number[] };

const buckets = new Map<string, Bucket>();

export type RateLimitResult =
  | { ok: true }
  | { ok: false; response: Response };

export function checkRateLimit(opts: {
  key: string;
  limit: number;
  windowMs: number;
}): RateLimitResult {
  const now = Date.now();
  const windowStart = now - opts.windowMs;
  let bucket = buckets.get(opts.key);
  if (!bucket) {
    bucket = { timestamps: [] };
    buckets.set(opts.key, bucket);
  }

  bucket.timestamps = bucket.timestamps.filter((t) => t > windowStart);
  if (bucket.timestamps.length >= opts.limit) {
    const retryAfterSec = Math.max(
      1,
      Math.ceil((bucket.timestamps[0]! + opts.windowMs - now) / 1000)
    );
    return {
      ok: false,
      response: Response.json(
        {
          error: "요청이 너무 많습니다. 잠시 후 다시 시도해 주세요.",
          code: "RATE_LIMITED",
        },
        {
          status: 429,
          headers: { "Retry-After": String(retryAfterSec) },
        }
      ),
    };
  }

  bucket.timestamps.push(now);
  return { ok: true };
}

/** LLM 생성 API 기본: 유저당 분당 20회 */
export function checkLlmRateLimit(userId: string): RateLimitResult {
  return checkRateLimit({
    key: `llm:${userId}`,
    limit: 20,
    windowMs: 60_000,
  });
}

export function clientIpFromRequest(req: Request): string {
  const xf = req.headers.get("x-forwarded-for");
  if (xf) {
    const first = xf.split(",")[0]?.trim();
    if (first) return first;
  }
  return req.headers.get("x-real-ip")?.trim() || "unknown";
}
