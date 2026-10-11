import type { PropertyInput, SettingsInput, TriState } from "@/lib/domain/schema";
import type { NormalizedRecord } from "@/lib/domain/record";
import { propertyTypeLabels, conditionLabels } from "@/lib/domain/labels";
import { clamp } from "@/lib/stats";
import { sameName } from "@/lib/geo";

/**
 * משקלות רכיבי הדמיון. אלה הנחות עבודה שקופות (לא עובדות שוק) – הן קובעות
 * רק את סדר העדיפות בין עסקאות ההשוואה ואת משקלן בחישוב, ולא "מתקנות" מחיר.
 * ניתן לכייל אותן בשלב 3 מול מאגר עסקאות אמיתי (backtesting).
 */
export const SIMILARITY_WEIGHTS = {
  distance: 20,
  area: 18,
  rooms: 14,
  recency: 15,
  propertyType: 10,
  floor: 6,
  elevator: 6,
  balcony: 4,
  parking: 5,
  storage: 2,
  mamad: 4,
  condition: 6,
} as const;

export type SimilarityComponent = keyof typeof SIMILARITY_WEIGHTS;

export interface Reason {
  kind: "match" | "diff" | "unknown";
  text: string;
}

export interface SimilarityResult {
  score: number; // 0-100
  components: Record<SimilarityComponent, number>; // 0-1
  reasons: Reason[];
}

export interface SubjectContext {
  property: PropertyInput;
  settings: SettingsInput;
  street?: string | null;
  neighborhood?: string | null;
  adjacentNeighborhoods: string[];
  now: Date;
}

export const triToBool = (t: TriState): boolean | null => (t === "yes" ? true : t === "no" ? false : null);

export const parkingToCount = (p: PropertyInput["parking"]): number | null =>
  p === "none" ? 0 : p === "one" ? 1 : p === "two_plus" ? 2 : null;

const CONDITION_ORDER: Record<string, number> = { needs_renovation: 0, maintained: 1, renovated: 2, new: 3 };

/** תאימות בין סוגי נכסים (1 = זהה, 0 = לא בר-השוואה) */
export function propertyTypeCompatibility(a: string | null, b: string | null): number {
  if (!a || !b) return 0.5;
  if (a === b) return 1;
  const key = [a, b].sort().join("|");
  const table: Record<string, number> = {
    "apartment|garden": 0.6,
    "apartment|duplex": 0.6,
    "apartment|roof": 0.4,
    "apartment|penthouse": 0.4,
    "penthouse|roof": 0.8,
    "duplex|penthouse": 0.6,
    "duplex|roof": 0.6,
    "duplex|garden": 0.5,
    "garden|roof": 0.2,
    "garden|penthouse": 0.2,
  };
  return table[key] ?? 0;
}

export function monthsBetween(a: Date, b: Date): number {
  return (b.getTime() - a.getTime()) / (1000 * 60 * 60 * 24 * 30.4375);
}

const pct = (x: number) => `${Math.round(x * 100)}%`;

function boolComponent(
  subject: boolean | null,
  comp: boolean | null,
  label: string,
  reasons: Reason[],
): number {
  if (subject === null || comp === null) {
    if (subject !== null && comp === null) reasons.push({ kind: "unknown", text: `${label}: לא ידוע בעסקה` });
    return 0.5;
  }
  if (subject === comp) {
    if (subject) reasons.push({ kind: "match", text: `${label} בשני הנכסים` });
    return 1;
  }
  reasons.push({
    kind: "diff",
    text: subject ? `לנכס הנבדק יש ${label}, לנכס ההשוואה אין` : `לנכס ההשוואה יש ${label}, לנכס הנבדק אין`,
  });
  return 0;
}

export function computeSimilarity(
  subject: SubjectContext,
  rec: NormalizedRecord,
  distanceM: number | null,
): SimilarityResult {
  const p = subject.property;
  const s = subject.settings;
  const reasons: Reason[] = [];
  const c = {} as Record<SimilarityComponent, number>;

  // מרחק
  if (distanceM !== null) {
    c.distance = clamp(1 - distanceM / (2 * s.radiusM), 0, 1);
    reasons.push({
      kind: distanceM <= s.radiusM ? "match" : "diff",
      text: `מרחק ${distanceM < 1000 ? `${Math.round(distanceM)} מ׳` : `${(distanceM / 1000).toFixed(1)} ק״מ`}`,
    });
  } else if (sameName(rec.street, subject.street)) {
    c.distance = 0.9;
  } else if (sameName(rec.neighborhood, subject.neighborhood)) {
    c.distance = 0.6;
  } else if (subject.adjacentNeighborhoods.some((n) => sameName(n, rec.neighborhood))) {
    c.distance = 0.4;
  } else {
    c.distance = 0.2;
  }
  if (sameName(rec.street, subject.street)) reasons.unshift({ kind: "match", text: "אותו רחוב" });
  else if (sameName(rec.neighborhood, subject.neighborhood)) reasons.unshift({ kind: "match", text: "אותה שכונה" });

  // שטח
  if (rec.areaSqm) {
    const d = Math.abs(rec.areaSqm - p.areaSqm) / p.areaSqm;
    c.area = clamp(1 - d / (s.areaTolerancePct / 100), 0, 1);
    reasons.push({
      kind: d <= 0.1 ? "match" : "diff",
      text: `שטח ${rec.areaSqm} מ״ר (${rec.areaSqm >= p.areaSqm ? "+" : "−"}${pct(d)})`,
    });
  } else c.area = 0;

  // חדרים
  if (rec.rooms !== null) {
    const d = Math.abs(rec.rooms - p.rooms);
    c.rooms = clamp(1 - d / (s.roomsTolerance + 0.5), 0, 1);
    reasons.push({ kind: d === 0 ? "match" : "diff", text: d === 0 ? `${rec.rooms} חדרים, כמו הנכס` : `${rec.rooms} חדרים (הפרש ${d})` });
  } else {
    c.rooms = 0.4;
    reasons.push({ kind: "unknown", text: "מספר חדרים לא ידוע" });
  }

  // עדכניות
  const date = rec.transactionDate ?? rec.listingDate;
  if (date) {
    const m = monthsBetween(date, subject.now);
    c.recency = clamp(1 - m / (s.dateRangeMonths * 1.5), 0, 1);
    if (m > s.dateRangeMonths) reasons.push({ kind: "diff", text: `עסקה ישנה (${Math.round(m)} חודשים)` });
  } else c.recency = 0;

  // סוג נכס
  c.propertyType = propertyTypeCompatibility(p.propertyType, rec.propertyType);
  if (rec.propertyType && rec.propertyType !== p.propertyType) {
    reasons.push({
      kind: "diff",
      text: `סוג נכס שונה: ${propertyTypeLabels[rec.propertyType] ?? rec.propertyType}`,
    });
  }

  // קומה
  if (p.floor !== undefined && rec.floor !== null) {
    const d = Math.abs(rec.floor - p.floor);
    c.floor = clamp(1 - d / 6, 0, 1);
    if (d >= 3) reasons.push({ kind: "diff", text: `קומה ${rec.floor} לעומת ${p.floor}` });
  } else c.floor = 0.5;

  c.elevator = boolComponent(triToBool(p.elevator), rec.elevator, "מעלית", reasons);
  c.balcony = boolComponent(triToBool(p.balcony), rec.balcony, "מרפסת", reasons);
  c.storage = boolComponent(triToBool(p.storage), rec.storage, "מחסן", reasons);
  c.mamad = boolComponent(triToBool(p.mamad), rec.mamad, "ממ״ד", reasons);

  const sp = parkingToCount(p.parking);
  if (sp === null || rec.parkingSpaces === null) c.parking = 0.5;
  else {
    const d = Math.abs(Math.min(sp, 2) - Math.min(rec.parkingSpaces, 2));
    c.parking = d === 0 ? 1 : d === 1 ? 0.4 : 0;
    if (d > 0) reasons.push({ kind: "diff", text: `חניות: ${rec.parkingSpaces} לעומת ${sp === 2 ? "2+" : sp}` });
  }

  const so = CONDITION_ORDER[p.condition];
  const ro = rec.condition ? CONDITION_ORDER[rec.condition] : undefined;
  if (so === undefined || ro === undefined) c.condition = 0.5;
  else {
    const d = Math.abs(so - ro);
    c.condition = clamp(1 - d / 3, 0, 1);
    if (d >= 1) reasons.push({ kind: "diff", text: `מצב: ${conditionLabels[rec.condition!]}` });
  }

  let total = 0;
  let wsum = 0;
  for (const k of Object.keys(SIMILARITY_WEIGHTS) as SimilarityComponent[]) {
    total += SIMILARITY_WEIGHTS[k] * c[k];
    wsum += SIMILARITY_WEIGHTS[k];
  }
  return { score: Math.round((total / wsum) * 1000) / 10, components: c, reasons };
}
