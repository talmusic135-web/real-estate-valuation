// רץ בכל פריסה: יוצר חשבון ברירת מחדל, ומכניס נתוני הדגמה רק אם המסד ריק.
// לא נוגע בנתונים קיימים, כך שהערכות שנשמרו נשארות בין פריסות.
import { PrismaClient } from "@prisma/client";
import { reseedDemoData } from "../src/lib/demo/seed-demo";

const prisma = new PrismaClient();

async function main() {
  await prisma.account.upsert({
    where: { id: "default-account" },
    update: {},
    create: { id: "default-account", name: "משרד תיווך" },
  });
  if (process.env.DEMO_DATA_ENABLED === "false") {
    console.log("נתוני הדגמה כבויים – מדלג");
    return;
  }
  const count = await prisma.propertyRecord.count();
  if (count > 0) {
    console.log(`במסד כבר יש ${count} רשומות – מדלג על נתוני הדגמה`);
    return;
  }
  const res = await reseedDemoData(prisma);
  console.log(`מסד ריק: נוצרו ${res.records} רשומות הדגמה ו-${res.histories} היסטוריות מחיר`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
