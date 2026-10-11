import { PrismaClient } from "@prisma/client";
import { reseedDemoData } from "../src/lib/demo/seed-demo";

const prisma = new PrismaClient();

async function main() {
  await prisma.account.upsert({
    where: { id: "default-account" },
    update: {},
    create: { id: "default-account", name: "משרד תיווך (חשבון הדגמה)" },
  });
  await prisma.user.upsert({
    where: { email: "broker@example.com" },
    update: {},
    create: { email: "broker@example.com", name: "מתווך לדוגמה", role: "ADMIN", accountId: "default-account" },
  });
  const res = await reseedDemoData(prisma);
  console.log(`נוצרו ${res.records} רשומות הדגמה ו-${res.histories} היסטוריות מחיר`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
