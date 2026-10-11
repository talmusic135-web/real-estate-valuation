/**
 * מגביל קצב פשוט (Token Bucket) בזיכרון.
 * בייצור עם כמה שרתים יש להחליף ב-Redis או בשירות דומה.
 */
export class TokenBucket {
  private tokens: number;
  private last: number;
  constructor(
    private readonly capacity: number,
    private readonly refillPerSecond: number,
  ) {
    this.tokens = capacity;
    this.last = Date.now();
  }
  tryTake(n = 1): boolean {
    const now = Date.now();
    this.tokens = Math.min(this.capacity, this.tokens + ((now - this.last) / 1000) * this.refillPerSecond);
    this.last = now;
    if (this.tokens < n) return false;
    this.tokens -= n;
    return true;
  }
}

const buckets = new Map<string, TokenBucket>();

/** הגבלת קצב לפי מפתח (למשל IP של משתמש או מזהה מחבר) */
export function rateLimit(key: string, perMinute: number): boolean {
  let b = buckets.get(key);
  if (!b) {
    b = new TokenBucket(perMinute, perMinute / 60);
    buckets.set(key, b);
  }
  return b.tryTake();
}
