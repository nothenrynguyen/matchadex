type RateLimitOptions = {
  key: string;
  maxRequests: number;
  windowMs: number;
};

type RateLimitState = {
  count: number;
  windowStart: number;
};

const globalRateLimitStore = global as unknown as {
  rateLimitStore?: Map<string, RateLimitState>;
};

const rateLimitStore = globalRateLimitStore.rateLimitStore ?? new Map<string, RateLimitState>();

if (!globalRateLimitStore.rateLimitStore) {
  globalRateLimitStore.rateLimitStore = rateLimitStore;
}

export function enforceRateLimit(options: RateLimitOptions) {
  const now = Date.now();
  const existing = rateLimitStore.get(options.key);

  if (!existing || now - existing.windowStart >= options.windowMs) {
    rateLimitStore.set(options.key, {
      count: 1,
      windowStart: now,
    });

    return {
      allowed: true,
      remaining: options.maxRequests - 1,
    };
  }

  if (existing.count >= options.maxRequests) {
    return {
      allowed: false,
      remaining: 0,
    };
  }

  existing.count += 1;
  rateLimitStore.set(options.key, existing);

  return {
    allowed: true,
    remaining: options.maxRequests - existing.count,
  };
}
