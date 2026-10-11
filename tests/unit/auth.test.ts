import { afterEach, describe, expect, it } from "vitest";
import { authEnabled, checkPassword, isValidSession, safeNext, sessionToken } from "@/lib/auth/session";

afterEach(() => {
  delete process.env.APP_PASSWORD;
});

describe("הגנת סיסמה", () => {
  it("כבויה כשאין APP_PASSWORD", async () => {
    expect(authEnabled()).toBe(false);
    expect(await isValidSession(undefined)).toBe(true);
  });

  it("מקבלת רק את הסיסמה הנכונה ואת העוגייה שנגזרה ממנה", async () => {
    process.env.APP_PASSWORD = "סוד-המשרד-2026";
    expect(await checkPassword("סוד-המשרד-2026")).toBe(true);
    expect(await checkPassword("שגוי")).toBe(false);
    const token = await sessionToken();
    expect(await isValidSession(token)).toBe(true);
    expect(await isValidSession(undefined)).toBe(false);
    expect(await isValidSession(token.replace(/.$/, "0") === token ? token.replace(/.$/, "1") : token.replace(/.$/, "0"))).toBe(false);
  });

  it("החלפת סיסמה מבטלת עוגיות ישנות", async () => {
    process.env.APP_PASSWORD = "ישנה";
    const old = await sessionToken();
    process.env.APP_PASSWORD = "חדשה";
    expect(await isValidSession(old)).toBe(false);
  });

  it("הפניה אחרי כניסה רק לנתיב פנימי", () => {
    expect(safeNext("/valuations/abc?x=1")).toBe("/valuations/abc?x=1");
    expect(safeNext("https://evil.example")).toBe("/");
    expect(safeNext("//evil.example")).toBe("/");
    expect(safeNext("/\\evil.example")).toBe("/");
    expect(safeNext(undefined)).toBe("/");
  });
});
