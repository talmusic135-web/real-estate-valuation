import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { rateLimit } from "@/lib/connectors/rate-limit";

/**
 * עטיפה לכל נתיבי ה-API: הגבלת קצב לפי IP, טיפול אחיד בשגיאות אימות, ולוגים.
 * פרטי שגיאות פנימיות לא נחשפים ללקוח.
 */
export function apiHandler<Ctx>(handler: (req: Request, ctx: Ctx) => Promise<Response>) {
  return async (req: Request, ctx: Ctx) => {
    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
    const limit = Number(process.env.RATE_LIMIT_PER_MINUTE || 60);
    if (req.method !== "GET" && !rateLimit(`api:${ip}`, limit)) {
      return NextResponse.json({ error: "יותר מדי בקשות. נסו שוב בעוד דקה." }, { status: 429 });
    }
    try {
      return await handler(req, ctx);
    } catch (err) {
      if (err instanceof ZodError) {
        return NextResponse.json(
          { error: "נתונים לא תקינים", issues: err.issues.map((i) => ({ path: i.path.join("."), message: i.message })) },
          { status: 400 },
        );
      }
      if (err instanceof ApiError) return NextResponse.json({ error: err.message }, { status: err.status });
      console.error(`[api] ${req.method} ${new URL(req.url).pathname}`, err);
      return NextResponse.json({ error: "שגיאה פנימית. הפרטים נרשמו ביומן השרת." }, { status: 500 });
    }
  };
}

export class ApiError extends Error {
  constructor(
    message: string,
    public status = 400,
  ) {
    super(message);
  }
}
