import type { Prisma, PrismaClient } from "@prisma/client";
import { DEMO_SOURCE, generateDemoData } from "./generator";

/** מחיקת נתוני ההדגמה ויצירתם מחדש. לא נוגע בנתונים ממקורות אמיתיים. */
export async function reseedDemoData(prisma: PrismaClient, now = new Date()) {
  const { records, histories } = generateDemoData(now);
  const demoIds = (await prisma.propertyRecord.findMany({ where: { isDemo: true }, select: { id: true } })).map((r) => r.id);
  // הערכות קיימות שמצביעות על רשומות הדגמה – מנותקות (התוצאה השמורה נשארת בהערכה עצמה)
  await prisma.valuationComparable.deleteMany({ where: { recordId: { in: demoIds } } });
  await prisma.propertyRecord.deleteMany({ where: { isDemo: true } });
  const chunk = 1000;
  for (let i = 0; i < records.length; i += chunk) {
    await prisma.propertyRecord.createMany({
      data: records.slice(i, i + chunk).map(({ rawData, ...r }) => ({ ...r, rawData: rawData as Prisma.InputJsonValue })),
    });
  }
  const idMap = new Map(
    (
      await prisma.propertyRecord.findMany({
        where: { sourceName: DEMO_SOURCE, sourceRecordId: { in: histories.map((h) => h.sourceRecordId) } },
        select: { id: true, sourceRecordId: true },
      })
    ).map((r) => [r.sourceRecordId, r.id]),
  );
  await prisma.priceHistory.createMany({
    data: histories.flatMap((h) =>
      h.points.map((p) => ({ recordId: idMap.get(h.sourceRecordId)!, priceIls: p.priceIls, observedAt: p.observedAt })),
    ),
  });
  return { records: records.length, histories: histories.length };
}
