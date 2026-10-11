import type { Prisma, PropertyRecord } from "@prisma/client";
import { prisma } from "@/lib/db";
import type { NormalizedRecord, StoredRecord } from "@/lib/domain/record";
import { crossSourceKey, validateRecord } from "@/lib/connectors/normalize";
import { distanceMeters, sameName } from "@/lib/geo";
import type { LocationInput } from "@/lib/domain/schema";
import type { SubjectPoint } from "@/lib/valuation/engine";
import { DEMO_CITIES } from "@/lib/demo/gazetteer";

export const demoEnabled = () => process.env.DEMO_DATA_ENABLED !== "false";

export function toStored(r: PropertyRecord): StoredRecord {
  return { ...r, rawData: undefined } as unknown as StoredRecord;
}

function toCreateData(r: NormalizedRecord): Prisma.PropertyRecordCreateInput {
  const { rawData, ...rest } = r;
  return { ...rest, rawData: (rawData ?? undefined) as Prisma.InputJsonValue | undefined };
}

/** שמירת רשומות עם מניעת כפילויות (מפתח ייחודי: מקור + מזהה רשומה במקור) */
export async function upsertRecords(records: NormalizedRecord[]) {
  let created = 0;
  let updated = 0;
  const rejected: { sourceRecordId: string; errors: string[] }[] = [];
  for (const r of records) {
    const errors = validateRecord(r);
    if (errors.length) {
      rejected.push({ sourceRecordId: r.sourceRecordId || "(ללא מזהה)", errors });
      continue;
    }
    const data = toCreateData(r);
    const existing = await prisma.propertyRecord.findUnique({
      where: { sourceName_sourceRecordId: { sourceName: r.sourceName, sourceRecordId: r.sourceRecordId } },
      select: { id: true },
    });
    if (existing) {
      await prisma.propertyRecord.update({ where: { id: existing.id }, data: { ...data, fetchedAt: new Date() } });
      updated++;
    } else {
      await prisma.propertyRecord.create({ data });
      created++;
    }
  }
  return { created, updated, rejected };
}

/** טעינת כל הרשומות בעיר, ללא כפילויות בין מקורות */
export async function loadCityRecords(city: string): Promise<StoredRecord[]> {
  const rows = await prisma.propertyRecord.findMany({
    where: { city: { equals: city.trim(), mode: "insensitive" }, ...(demoEnabled() ? {} : { isDemo: false }) },
  });
  return dedupe(preferRealOverDemo(rows.map(toStored)));
}

/**
 * לא מערבבים: אם בעיר יש עסקאות אמיתיות, נתוני ההדגמה של אותה עיר לא נכנסים לחישוב.
 * נתוני הדגמה משמשים רק בעיר שאין בה אף עסקה אמיתית (והתוצאה מסומנת כהדגמה).
 */
export function preferRealOverDemo(records: StoredRecord[]): StoredRecord[] {
  const hasReal = records.some((r) => !r.isDemo && r.recordType === "completed_transaction");
  return hasReal ? records.filter((r) => !r.isDemo) : records;
}

/** אותה עסקה שהגיעה משני מקורות: נשמרת הרשומה האמינה יותר (ולא נתוני הדגמה) */
export function dedupe(records: StoredRecord[]): StoredRecord[] {
  const byKey = new Map<string, StoredRecord>();
  const out: StoredRecord[] = [];
  for (const r of records) {
    const k = crossSourceKey(r);
    if (!k) {
      out.push(r);
      continue;
    }
    const prev = byKey.get(k);
    const score = (x: StoredRecord) => (x.isDemo ? 0 : 1) * 10 + (x.dataConfidence ?? 0);
    if (!prev || score(r) > score(prev)) byKey.set(k, r);
  }
  return [...out, ...byKey.values()];
}

/** מיקום הנכס: נקודה שהוזנה, אחרת מרכז הרחוב/השכונה/העיר לפי הנתונים הקיימים */
export function resolveSubjectPoint(loc: LocationInput, records: StoredRecord[]): SubjectPoint | null {
  if (loc.latitude !== undefined && loc.longitude !== undefined) {
    return { latitude: loc.latitude, longitude: loc.longitude, precision: "exact" };
  }
  const centroid = (rs: StoredRecord[]) => {
    const pts = rs.filter((r) => r.latitude !== null && r.longitude !== null);
    if (pts.length === 0) return null;
    return {
      latitude: pts.reduce((s, r) => s + r.latitude!, 0) / pts.length,
      longitude: pts.reduce((s, r) => s + r.longitude!, 0) / pts.length,
    };
  };
  if (loc.street) {
    const onStreet = records.filter(
      (r) => sameName(r.street, loc.street) && (!loc.neighborhood || sameName(r.neighborhood, loc.neighborhood)),
    );
    const c = centroid(onStreet.length ? onStreet : records.filter((r) => sameName(r.street, loc.street)));
    if (c) return { ...c, precision: "street" };
  }
  if (loc.neighborhood) {
    const c = centroid(records.filter((r) => sameName(r.neighborhood, loc.neighborhood)));
    if (c) return { ...c, precision: "neighborhood" };
  }
  const city = DEMO_CITIES.find((c) => sameName(c.name, loc.city));
  if (city) return { latitude: city.lat, longitude: city.lng, precision: "city" };
  const c = centroid(records);
  return c ? { ...c, precision: "city" } : null;
}

/** שכונות סמוכות: מרכז השכונה במרחק עד 2.5 ק״מ ממרכז שכונת הנכס */
export function findAdjacentNeighborhoods(neighborhood: string | undefined, records: StoredRecord[], maxKm = 2.5): string[] {
  if (!neighborhood) return [];
  const groups = new Map<string, { lat: number; lng: number; n: number }>();
  for (const r of records) {
    if (!r.neighborhood || r.latitude === null || r.longitude === null) continue;
    const g = groups.get(r.neighborhood) ?? { lat: 0, lng: 0, n: 0 };
    g.lat += r.latitude;
    g.lng += r.longitude;
    g.n++;
    groups.set(r.neighborhood, g);
  }
  const own = [...groups.entries()].find(([name]) => sameName(name, neighborhood));
  if (!own) return [];
  const [ownName, o] = own;
  return [...groups.entries()]
    .filter(([name, g]) => name !== ownName && distanceMeters(o.lat / o.n, o.lng / o.n, g.lat / g.n, g.lng / g.n) <= maxKm * 1000)
    .map(([name]) => name);
}
