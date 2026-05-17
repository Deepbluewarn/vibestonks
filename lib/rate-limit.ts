/**
 * 인-프로세스 슬라이딩 윈도우 rate limiter.
 *
 * 멀티 인스턴스 배포로 가면 Redis 등으로 교체 필요.
 * 단일 인스턴스(현재 배포)에선 globalThis 싱글턴으로 dev hot reload에도 안전.
 */

const globalForRL = globalThis as unknown as {
  __vibestonksRL?: Map<string, number[]>;
};

if (!globalForRL.__vibestonksRL) {
  globalForRL.__vibestonksRL = new Map();
}

const buckets = globalForRL.__vibestonksRL;

export interface RateLimitOptions {
  /** 슬라이딩 윈도우 길이 (ms) */
  windowMs: number;
  /** 윈도우 안에서 허용되는 최대 호출 수 */
  max: number;
}

export interface RateLimitResult {
  ok: boolean;
  /** 차단 시 다음 호출까지 남은 ms */
  retryAfterMs?: number;
  /** 남은 허용 횟수 */
  remaining: number;
}

export function checkRateLimit(
  key: string,
  opts: RateLimitOptions,
): RateLimitResult {
  const now = Date.now();
  const cutoff = now - opts.windowMs;
  const arr = (buckets.get(key) ?? []).filter((t) => t > cutoff);

  if (arr.length >= opts.max) {
    return {
      ok: false,
      retryAfterMs: opts.windowMs - (now - arr[0]),
      remaining: 0,
    };
  }

  arr.push(now);
  buckets.set(key, arr);
  return { ok: true, remaining: opts.max - arr.length };
}
