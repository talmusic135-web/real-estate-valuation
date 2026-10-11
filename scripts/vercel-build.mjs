// בנייה לאירוח (Vercel ודומיו): יצירת הטבלאות, נתוני הדגמה בפעם הראשונה, ואז בניית האתר.
// כתובת המסד נלקחת מהמשתנים שהאינטגרציות של Neon / Supabase / Vercel Postgres יוצרות אוטומטית.
import { execSync } from "node:child_process";

const env = process.env;
const pooled = env.DATABASE_URL || env.POSTGRES_PRISMA_URL || env.POSTGRES_URL;
// למיגרציות עדיף חיבור ישיר (לא דרך pooler)
const direct = env.DATABASE_URL_UNPOOLED || env.POSTGRES_URL_NON_POOLING || env.DIRECT_URL || pooled;

const run = (cmd, extraEnv = {}) => execSync(cmd, { stdio: "inherit", env: { ...env, ...extraEnv } });

run("npx prisma generate");
if (direct) {
  run("npx prisma migrate deploy", { DATABASE_URL: direct });
  run("npx tsx scripts/ensure-seed.ts", { DATABASE_URL: direct });
} else {
  console.warn("\n⚠ לא נמצאה כתובת מסד נתונים (DATABASE_URL). האתר ייבנה, אבל לא יעבוד עד שיחובר מסד נתונים.\n");
}
if (!env.APP_PASSWORD) {
  console.warn("\n⚠ APP_PASSWORD לא מוגדר – האתר יהיה פתוח לכל מי שיש לו את הכתובת.\n");
}
run("npx next build", pooled ? { DATABASE_URL: pooled } : {});
