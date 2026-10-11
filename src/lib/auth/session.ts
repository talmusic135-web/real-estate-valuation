/**
 * הגנת סיסמה פשוטה לכל המערכת.
 * כשמוגדר APP_PASSWORD, כל עמוד ו-API דורשים עוגייה חתומה שנוצרת אחרי הזנת הסיסמה.
 * העוגייה היא HMAC של הסיסמה, כך שהחלפת הסיסמה מנתקת את כל המחוברים.
 * עובד גם ב-Edge (middleware) וגם ב-Node, באמצעות Web Crypto.
 */
export const SESSION_COOKIE = "erech_session";
export const SESSION_MAX_AGE = 60 * 60 * 24 * 30; // 30 יום

export function authEnabled(): boolean {
  return (process.env.APP_PASSWORD ?? "").trim() !== "";
}

async function hmacHex(key: string, message: string): Promise<string> {
  const enc = new TextEncoder();
  const k = await crypto.subtle.importKey("raw", enc.encode(key), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", k, enc.encode(message));
  return Array.from(new Uint8Array(sig), (b) => b.toString(16).padStart(2, "0")).join("");
}

export async function sessionToken(password = process.env.APP_PASSWORD ?? ""): Promise<string> {
  return hmacHex(password.trim(), "erech-session-v1");
}

/** השוואה בזמן קבוע */
export function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export async function isValidSession(cookieValue: string | undefined): Promise<boolean> {
  if (!authEnabled()) return true;
  if (!cookieValue) return false;
  return safeEqual(cookieValue, await sessionToken());
}

export async function checkPassword(input: string): Promise<boolean> {
  const expected = (process.env.APP_PASSWORD ?? "").trim();
  if (!expected) return true;
  // משווים את ה-HMAC ולא את הסיסמה עצמה, כדי שאורך הסיסמה לא ידלוף בזמן ההשוואה
  return safeEqual(await sessionToken(input), await sessionToken(expected));
}

/** רק נתיב פנימי, כדי שלא יהיה אפשר להפנות מכאן לאתר חיצוני */
export function safeNext(next: string | null | undefined): string {
  if (!next || !next.startsWith("/") || next.startsWith("//") || next.startsWith("/\\")) return "/";
  return next;
}
