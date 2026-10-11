import { NextResponse } from "next/server";
import { apiHandler } from "@/lib/api";
import { prisma } from "@/lib/db";
import { demoEnabled } from "@/lib/services/records";

/** רשימות השלמה אוטומטית לטופס: ערים, שכונות ורחובות שקיימים בנתונים */
export const GET = apiHandler(async (req) => {
  const city = new URL(req.url).searchParams.get("city")?.trim();
  const demo = demoEnabled() ? {} : { isDemo: false };
  const cities = (await prisma.propertyRecord.groupBy({ by: ["city"], where: demo, _count: true, orderBy: { city: "asc" } })).map((c) => c.city);
  if (!city) return NextResponse.json({ cities, neighborhoods: [], streets: [] });
  const rows = await prisma.propertyRecord.groupBy({ by: ["neighborhood", "street"], where: { city, ...demo } });
  const neighborhoods = [...new Set(rows.map((r) => r.neighborhood).filter(Boolean))].sort();
  const streets = [...new Set(rows.map((r) => r.street).filter(Boolean))].sort();
  const streetsByNeighborhood: Record<string, string[]> = {};
  for (const r of rows) if (r.neighborhood && r.street) (streetsByNeighborhood[r.neighborhood] ??= []).push(r.street);
  return NextResponse.json({ cities, neighborhoods, streets, streetsByNeighborhood });
});
