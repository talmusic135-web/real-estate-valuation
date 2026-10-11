import { NextResponse } from "next/server";
import { apiHandler } from "@/lib/api";
import { prisma } from "@/lib/db";
import { reseedDemoData } from "@/lib/demo/seed-demo";

export const maxDuration = 60;

export const POST = apiHandler(async () => {
  const res = await reseedDemoData(prisma);
  await prisma.connectorRun.create({
    data: { connectorId: "demo", status: "success", finishedAt: new Date(), recordsFetched: res.records, recordsNew: res.records, message: "נתוני ההדגמה נוצרו מחדש" },
  });
  return NextResponse.json(res);
});

export const DELETE = apiHandler(async () => {
  const ids = (await prisma.propertyRecord.findMany({ where: { isDemo: true }, select: { id: true } })).map((r) => r.id);
  await prisma.valuationComparable.deleteMany({ where: { recordId: { in: ids } } });
  const res = await prisma.propertyRecord.deleteMany({ where: { isDemo: true } });
  return NextResponse.json({ deleted: res.count });
});
