import { ApiError, apiHandler } from "@/lib/api";
import { prisma } from "@/lib/db";
import { getCurrentContext } from "@/lib/services/context";
import { SESSION_COOKIE } from "@/lib/auth/session";

export const runtime = "nodejs";

/**
 * ייצוא PDF בצד השרת: Chromium (Playwright) מרנדר את עמוד הדוח.
 * אם CHROMIUM_PATH לא מוגדר, מוחזר 501 והממשק עובר להדפסה מהדפדפן.
 */
export const maxDuration = 60;

export const GET = apiHandler<{ params: Promise<{ id: string }> }>(async (req, { params }) => {
  const { id } = await params;
  const { accountId } = await getCurrentContext();
  const v = await prisma.valuation.findFirst({ where: { id, accountId }, select: { id: true, title: true } });
  if (!v) throw new ApiError("ההערכה לא נמצאה", 404);
  const executablePath = process.env.CHROMIUM_PATH?.trim();
  if (!executablePath) throw new ApiError("ייצוא PDF בשרת לא הוגדר (CHROMIUM_PATH). השתמשו בהדפסה לדפדפן.", 501);

  const { chromium } = await import("playwright-core");
  const browser = await chromium.launch({ executablePath, args: ["--no-sandbox"] });
  try {
    const origin = new URL(req.url).origin;
    const context = await browser.newContext();
    // כשהמערכת מוגנת בסיסמה, הדפדפן הפנימי צריך את עוגיית ההתחברות של המשתמש
    const session = req.headers.get("cookie")?.match(new RegExp(`(?:^|;\\s*)${SESSION_COOKIE}=([^;]+)`))?.[1];
    if (session) await context.addCookies([{ name: SESSION_COOKIE, value: session, url: origin }]);
    const page = await context.newPage();
    await page.goto(`${origin}/valuations/${id}/report?print=1`, { waitUntil: "networkidle", timeout: 30_000 });
    const pdf = await page.pdf({
      format: "A4",
      printBackground: true,
      margin: { top: "14mm", bottom: "14mm", left: "12mm", right: "12mm" },
    });
    const filename = encodeURIComponent(`הערכת-שווי-${v.title}.pdf`.replace(/[\\/:*?"<>|]/g, "-"));
    return new Response(new Uint8Array(pdf), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="valuation-${id}.pdf"; filename*=UTF-8''${filename}`,
      },
    });
  } finally {
    await browser.close();
  }
});
