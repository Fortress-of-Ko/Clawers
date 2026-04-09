/**
 * Simple in-memory rate limiter.
 * NOTE: On Vercel serverless, this only works within a warm instance's lifetime.
 * For production at scale, replace with Upstash Redis or Vercel KV.
 * Still provides protection against rapid-fire requests within a single instance.
 */
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();

export function checkRateLimit(key: string, maxRequests: number, windowMs = 60_000): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(key);
  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(key, { count: 1, resetAt: now + windowMs });
    return true;
  }
  if (entry.count >= maxRequests) return false;
  entry.count++;
  return true;
}
