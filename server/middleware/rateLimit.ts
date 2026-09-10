import type { NextFunction, Request, Response } from 'express';

type Bucket = { count: number; resetAt: number };

export function rateLimit(options: { windowMs: number; max: number; message?: string }) {
  const buckets = new Map<string, Bucket>();
  return (req: Request, res: Response, next: NextFunction) => {
    const now = Date.now();
    const key = req.ip || req.socket.remoteAddress || 'unknown';
    const current = buckets.get(key);
    const bucket = !current || current.resetAt <= now ? { count: 0, resetAt: now + options.windowMs } : current;
    bucket.count += 1;
    buckets.set(key, bucket);
    res.setHeader('RateLimit-Limit', options.max);
    res.setHeader('RateLimit-Remaining', Math.max(0, options.max - bucket.count));
    res.setHeader('RateLimit-Reset', Math.ceil(bucket.resetAt / 1000));
    if (bucket.count > options.max) return res.status(429).json({ error: options.message || 'Too many requests. Please try again later.' });
    if (buckets.size > 10_000) for (const [entryKey, entry] of buckets) if (entry.resetAt <= now) buckets.delete(entryKey);
    return next();
  };
}
