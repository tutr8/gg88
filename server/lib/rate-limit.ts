interface Bucket {
  tokens: number;
  updatedAt: number;
}

const buckets = new Map<string, Bucket>();

export class RateLimiter {
  constructor(
    private readonly capacity: number,
    private readonly windowMs: number,
  ) {}

  consume(key: string, tokens = 1) {
    const now = Date.now();
    const bucket = buckets.get(key) || {
      tokens: this.capacity,
      updatedAt: now,
    };
    const elapsed = now - bucket.updatedAt;
    if (elapsed > this.windowMs) {
      bucket.tokens = this.capacity;
      bucket.updatedAt = now;
    }
    if (bucket.tokens < tokens) {
      const retryAfter = Math.max(0, this.windowMs - (now - bucket.updatedAt));
      buckets.set(key, bucket);
      return { allowed: false, retryAfter } as const;
    }
    bucket.tokens -= tokens;
    bucket.updatedAt = now;
    buckets.set(key, bucket);
    return { allowed: true } as const;
  }
}

export const messageRateLimiter = new RateLimiter(20, 60_000);
