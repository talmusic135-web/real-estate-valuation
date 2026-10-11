import { prisma } from "@/lib/db";

export const DEFAULT_ACCOUNT_ID = "default-account";

/**
 * הקשר המשתמש הנוכחי. בשלב 1 יש חשבון ומשתמש ברירת מחדל אחד.
 * כל שאילתה על הערכות כבר מסוננת לפי accountId, כך שהוספת התחברות
 * (למשל Auth.js) בשלב הבא תחליף רק את הפונקציה הזו.
 */
export async function getCurrentContext() {
  const account = await prisma.account.upsert({
    where: { id: DEFAULT_ACCOUNT_ID },
    update: {},
    create: { id: DEFAULT_ACCOUNT_ID, name: "משרד תיווך (חשבון הדגמה)" },
  });
  return { accountId: account.id, accountName: account.name };
}
