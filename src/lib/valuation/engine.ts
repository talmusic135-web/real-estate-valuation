/**
 * מנוע הערכת שווי – שיטת עסקאות השוואה משוקללות (Weighted Comparables).
 *
 * פונקציה טהורה: מקבלת את נתוני הנכס ואת מאגר הרשומות, מחזירה תוצאה מלאה
 * ומוסברת. אין כאן גישה למסד או לרשת, כך שכל צעד ניתן לבדיקה אוטומטית.
 *
 * עקרונות:
 *  - רק עסקאות שהושלמו משתתפות באומדן השווי. מודעות מוצגות בנפרד.
 *  - אין מקדמי התאמה שרירותיים למאפיינים (מעלית, חניה וכו'). מאפיינים
 *    משפיעים רק על מידת הדמיון ולכן על המשקל של כל עסקה.
 *  - התאמת זמן מופעלת רק אם מגמת המחירים המקומית מובהקת סטטיסטית בנתונים עצמם.
 *  - כשאין מספיק עסקאות דומות, לא מוצג אומדן נקודתי.
 */
import type { ValuationInput } from "@/lib/domain/schema";
import type { StoredRecord } from "@/lib/domain/record";
import { tierLabels } from "@/lib/domain/labels";
import { distanceMeters, sameName } from "@/lib/geo";
import {
  clamp,
  effectiveSampleSize,
  linearRegression,
  median,
  robustZScores,
  roundTo,
  weightedQuantile,
} from "@/lib/stats";
import {
  computeSimilarity,
  monthsBetween,
  parkingToCount,
  propertyTypeCompatibility,
  triToBool,
  type SubjectContext,
} from "./similarity";
import type {
  ComparableResult,
  ConfidenceLevel,
  Driver,
  SensitivityScenario,
  Tier,
  ValuationResult,
} from "./types";

export const ALGORITHM_VERSION = "1.0.0-weighted-comps";

/** מינימום עסקאות כדי להציג אומדן נקודתי */
export const MIN_COMPARABLES_FOR_ESTIMATE = 3;
/** מתחת לכמות זו מרחיבים את החיפוש לכל העיר */
export const MIN_COMPARABLES_TARGET = 5;
/** סף לזיהוי חריג (ציון Z חסין) */
export const OUTLIER_Z = 3.5;
/** תוספת רוחב מינימלית לטווח לפי רמת אמינות (הנחת עבודה, מתועדת בדוח) */
export const MIN_HALF_SPREAD: Record<ConfidenceLevel, number> = { high: 0.04, medium: 0.07, low: 0.12, insufficient: 0.2 };

export interface SubjectPoint {
  latitude: number;
  longitude: number;
  precision: "exact" | "street" | "neighborhood" | "city";
}

export interface EngineInput {
  input: ValuationInput;
  subjectPoint: SubjectPoint | null;
  adjacentNeighborhoods: string[];
  records: StoredRecord[];
  priceHistory?: Record<string, { priceIls: number; observedAt: Date }[]>;
  unavailableSources?: string[];
  now?: Date;
}

const TIER_ORDER: Tier[] = ["street", "radius", "neighborhood", "adjacent", "older", "city"];

interface Candidate {
  rec: StoredRecord;
  distanceM: number | null;
  tier: Tier;
  similarity: ReturnType<typeof computeSimilarity>;
}

function recordDate(r: StoredRecord): Date | null {
  return r.transactionDate ?? r.listingDate ?? null;
}

function assignTier(
  r: StoredRecord,
  distanceM: number | null,
  input: ValuationInput,
  adjacent: string[],
  isOld: boolean,
): Tier | null {
  const { location, settings } = input;
  const inRadius = distanceM !== null && distanceM <= settings.radiusM;
  let tier: Tier;
  if (sameName(r.street, location.street) && (distanceM === null || inRadius)) tier = "street";
  else if (inRadius) tier = "radius";
  else if (sameName(r.neighborhood, location.neighborhood)) tier = "neighborhood";
  else if (settings.includeAdjacentNeighborhoods && adjacent.some((n) => sameName(n, r.neighborhood))) tier = "adjacent";
  else tier = "city";
  if (isOld) {
    if (!settings.includeOlderIfInsufficient || tier === "city") return null;
    return "older";
  }
  return tier;
}

function toComparable(
  c: Candidate,
  kind: "transaction" | "listing",
  now: Date,
  history?: { priceIls: number; observedAt: Date }[],
): ComparableResult {
  const r = c.rec;
  const price = (kind === "transaction" ? r.transactionPriceIls : r.askingPriceIls) ?? 0;
  const ppsqm = r.areaSqm ? price / r.areaSqm : 0;
  const date = recordDate(r);
  return {
    recordId: r.id,
    kind,
    sourceName: r.sourceName,
    sourceRecordId: r.sourceRecordId,
    sourceUrl: r.sourceUrl,
    isDemo: r.isDemo,
    date: date ? date.toISOString() : null,
    city: r.city,
    neighborhood: r.neighborhood,
    street: r.street,
    address: r.address ?? ([r.street, r.houseNumber].filter(Boolean).join(" ") || null),
    latitude: r.latitude,
    longitude: r.longitude,
    propertyType: r.propertyType,
    rooms: r.rooms,
    areaSqm: r.areaSqm,
    floor: r.floor,
    elevator: r.elevator,
    balcony: r.balcony,
    parkingSpaces: r.parkingSpaces,
    mamad: r.mamad,
    storage: r.storage,
    condition: r.condition,
    priceIls: price,
    pricePerSqm: Math.round(ppsqm),
    adjustedPricePerSqm: Math.round(ppsqm),
    timeAdjustmentFactor: 1,
    distanceM: c.distanceM === null ? null : Math.round(c.distanceM),
    similarity: c.similarity.score,
    weight: 0,
    tier: c.tier,
    included: true,
    excludedReason: null,
    reasons: c.similarity.reasons,
    // ימים בשוק: רק מנתון מתועד (תאריך פרסום ותאריך שנראתה לאחרונה)
    daysOnMarket:
      kind === "listing" && r.listingDate
        ? Math.max(0, Math.round(((r.lastSeenAt ?? now).getTime() - r.listingDate.getTime()) / 86400000))
        : null,
    priceChanges:
      kind === "listing" && history && history.length > 1
        ? history.map((h) => ({ priceIls: h.priceIls, observedAt: h.observedAt.toISOString() }))
        : null,
  };
}

/** אומדן מתוך רשימת עסקאות כלולות (משמש גם לניתוח רגישות) */
function estimateFrom(comps: { ppsqm: number; w: number }[], areaSqm: number) {
  if (comps.length === 0) return null;
  const ppsqm = weightedQuantile(
    comps.map((c) => c.ppsqm),
    comps.map((c) => c.w),
    0.5,
  );
  return { ppsqm, estimate: ppsqm * areaSqm };
}

export function runValuation(e: EngineInput): ValuationResult {
  const now = e.now ?? new Date();
  const { input } = e;
  const { location, property, settings } = input;
  const subject: SubjectContext = {
    property,
    settings,
    street: location.street,
    neighborhood: location.neighborhood,
    adjacentNeighborhoods: e.adjacentNeighborhoods,
    now,
  };
  const warnings: string[] = [];
  const limitations: string[] = [];
  const filterLog = new Map<string, number>();
  const bump = (k: string) => filterLog.set(k, (filterLog.get(k) ?? 0) + 1);

  const cityRecords = e.records.filter((r) => sameName(r.city, location.city));

  // ---------- שלב 1: סינון עסקאות לא רלוונטיות ----------
  const txCandidates: Candidate[] = [];
  const listingCandidates: Candidate[] = [];
  for (const r of cityRecords) {
    const isTx = r.recordType === "completed_transaction";
    const isListing = r.recordType === "active_listing";
    if (!isTx && !isListing) {
      bump("מודעה היסטורית (לא משמשת לחישוב)");
      continue;
    }
    const price = isTx ? r.transactionPriceIls : r.askingPriceIls;
    if (!price || price <= 0) {
      bump("חסר מחיר");
      continue;
    }
    if (!r.areaSqm || r.areaSqm <= 0) {
      bump("חסר שטח (אי אפשר לחשב מחיר למ״ר)");
      continue;
    }
    if (propertyTypeCompatibility(property.propertyType, r.propertyType) === 0) {
      bump("סוג נכס לא בר-השוואה");
      continue;
    }
    if (r.rooms !== null && Math.abs(r.rooms - property.rooms) > settings.roomsTolerance) {
      bump("מספר חדרים מחוץ לטווח הסטייה");
      continue;
    }
    const areaDiff = Math.abs(r.areaSqm - property.areaSqm) / property.areaSqm;
    if (areaDiff > settings.areaTolerancePct / 100) {
      bump("שטח מחוץ לטווח הסטייה");
      continue;
    }
    let isOld = false;
    if (isTx) {
      const d = r.transactionDate;
      if (!d) {
        bump("חסר תאריך עסקה");
        continue;
      }
      const m = monthsBetween(d, now);
      if (m > settings.dateRangeMonths * 2) {
        bump("עסקה ישנה מדי");
        continue;
      }
      isOld = m > settings.dateRangeMonths;
    }
    const distanceM =
      e.subjectPoint && r.latitude !== null && r.longitude !== null
        ? distanceMeters(e.subjectPoint.latitude, e.subjectPoint.longitude, r.latitude, r.longitude)
        : null;
    const tier = assignTier(r, distanceM, input, e.adjacentNeighborhoods, isOld);
    if (!tier) {
      bump("עסקה ישנה (לא נדרשה הרחבת טווח)");
      continue;
    }
    const cand: Candidate = { rec: r, distanceM, tier, similarity: computeSimilarity(subject, r, distanceM) };
    (isTx ? txCandidates : listingCandidates).push(cand);
  }

  // ---------- שלב 2: איתור עסקאות דומות בהרחבה הדרגתית ----------
  const searchExpansion: ValuationResult["searchExpansion"] = [];
  const selectedPool: Candidate[] = [];
  for (const tier of TIER_ORDER) {
    const inTier = txCandidates.filter((c) => c.tier === tier);
    const need =
      tier === "city" ? selectedPool.length < MIN_COMPARABLES_TARGET : selectedPool.length < settings.maxComparables;
    if (need) selectedPool.push(...inTier);
    searchExpansion.push({
      tier,
      label: tierLabels[tier],
      available: inTier.length,
      cumulative: selectedPool.length,
      used: need && inTier.length > 0,
    });
  }
  if (searchExpansion.find((s) => s.tier === "city")?.used) {
    warnings.push("לא נמצאו מספיק עסקאות בסביבה הקרובה ולכן החיפוש הורחב לכל העיר. האומדן פחות מדויק.");
  }
  if (searchExpansion.find((s) => s.tier === "older")?.used) {
    limitations.push(`נכללו עסקאות ישנות מ-${settings.dateRangeMonths} חודשים בגלל מחסור בעסקאות עדכניות.`);
  }

  selectedPool.sort((a, b) => b.similarity.score - a.similarity.score);
  const top = selectedPool.slice(0, settings.maxComparables);
  const comparables = top.map((c) => toComparable(c, "transaction", now));

  // ---------- שלב 4א: מדד זמן מקומי, מכויל מהנתונים עצמם ----------
  const timeAdjustment = computeTimeAdjustment(cityRecords, location.neighborhood, e.adjacentNeighborhoods, now);
  for (const c of comparables) {
    if (timeAdjustment.applied && c.date && timeAdjustment.slope !== null) {
      const years = monthsBetween(new Date(c.date), now) / 12;
      c.timeAdjustmentFactor = Math.round(Math.exp(timeAdjustment.slope * years) * 1000) / 1000;
      c.adjustedPricePerSqm = Math.round(c.pricePerSqm * c.timeAdjustmentFactor);
    }
  }

  // ---------- שלב 3+4ב: מחיר למ״ר וזיהוי חריגים ----------
  if (comparables.length >= 5) {
    const z = robustZScores(comparables.map((c) => c.adjustedPricePerSqm));
    comparables.forEach((c, i) => {
      if (Math.abs(z[i]) > OUTLIER_Z) {
        c.included = false;
        c.excludedReason = `מחיר למ״ר חריג (סטייה חסינה ${z[i].toFixed(1)}) – הוצא מהחישוב, מומלץ לבדוק`;
      }
    });
  }

  // ---------- שלב 5: משקלות ----------
  const included = comparables.filter((c) => c.included);
  const rawW = included.map((c) => (c.similarity / 100) ** 2);
  const sumW = rawW.reduce((a, b) => a + b, 0) || 1;
  included.forEach((c, i) => (c.weight = Math.round((rawW[i] / sumW) * 10000) / 10000));

  // ---------- מודעות פעילות (נפרד לחלוטין מהאומדן) ----------
  const listings = settings.includeActiveListings
    ? listingCandidates
        .filter((c) => c.tier !== "city" || listingCandidates.length < 5)
        .sort((a, b) => b.similarity.score - a.similarity.score)
        .slice(0, 25)
        .map((c) => toComparable(c, "listing", now, e.priceHistory?.[c.rec.id]))
    : [];

  const usesDemoData = [...comparables, ...listings].some((c) => c.isDemo);
  if (usesDemoData) {
    warnings.unshift("התוצאה מבוססת על נתוני הדגמה סינתטיים בלבד ואינה משקפת עסקאות אמיתיות.");
  }

  const n = included.length;
  const nEff = effectiveSampleSize(included.map((c) => c.weight));
  const latest = included.map((c) => c.date).filter(Boolean).sort().at(-1) ?? null;
  const oldest = included.map((c) => c.date).filter(Boolean).sort()[0] ?? null;
  const latestFetched = cityRecords.map((r) => r.fetchedAt.toISOString()).sort().at(-1) ?? null;

  const missingSubject = missingSubjectFields(input);
  if (missingSubject.length) {
    limitations.push(`נתונים חסרים על הנכס הנבדק: ${missingSubject.join(", ")}. הם לא נוחשו, וההשוואה בהם חלקית.`);
  }
  if (e.unavailableSources?.length) {
    limitations.push(`מקורות מידע שלא היו זמינים בהרצה: ${e.unavailableSources.join(", ")}.`);
  }
  if (!e.subjectPoint) {
    limitations.push("לא ידוע מיקום מדויק של הנכס, ולכן המרחק חושב לפי רחוב/שכונה בלבד.");
  } else if (e.subjectPoint.precision !== "exact") {
    limitations.push(
      `מיקום הנכס משוער (לפי ${e.subjectPoint.precision === "street" ? "מרכז הרחוב" : e.subjectPoint.precision === "neighborhood" ? "מרכז השכונה" : "מרכז העיר"}). מומלץ לסמן נקודה על המפה.`,
    );
  }
  limitations.push("המאפיינים (מעלית, חניה, מצב וכו') משפיעים על משקל העסקאות ולא על המחיר ישירות – אין במערכת מקדמי התאמה מכוילים עדיין.");

  const methodology = buildMethodology(settings, timeAdjustment);
  const marketTrend = timeAdjustment.trend;
  const txMedian = n ? median(included.map((c) => c.adjustedPricePerSqm)) : null;
  const lstMedian = listings.length ? median(listings.map((l) => l.pricePerSqm)) : null;
  const listingsVsTransactions = {
    listingMedianPpsqm: lstMedian ? Math.round(lstMedian) : null,
    transactionMedianPpsqm: txMedian ? Math.round(txMedian) : null,
    gapPct: lstMedian && txMedian ? Math.round((lstMedian / txMedian - 1) * 1000) / 10 : null,
  };

  const base = {
    algorithmVersion: ALGORITHM_VERSION,
    computedAt: now.toISOString(),
    counts: {
      candidatesInCity: cityRecords.length,
      passedFilters: txCandidates.length,
      transactionsUsed: n,
      transactionsExcluded: comparables.length - n,
      activeListingsFound: listings.length,
      effectiveSampleSize: Math.round(nEff * 10) / 10,
    },
    dataFreshness: { latestTransactionDate: latest, latestFetchedAt: latestFetched, oldestTransactionDate: oldest },
    subjectLocation: e.subjectPoint,
    searchExpansion,
    filterLog: [...filterLog.entries()].map(([reason, count]) => ({ reason, count })),
    timeAdjustment: {
      applied: timeAdjustment.applied,
      annualChangePct: timeAdjustment.annualChangePct,
      ciPct: timeAdjustment.ciPct,
      sampleSize: timeAdjustment.sampleSize,
      scope: timeAdjustment.scope,
      explanation: timeAdjustment.explanation,
    },
    comparables,
    listings,
    marketTrend,
    listingsVsTransactions,
    methodology,
    usesDemoData,
  };

  // ---------- אין מספיק נתונים: לא מציגים אומדן ----------
  if (n < MIN_COMPARABLES_FOR_ESTIMATE) {
    warnings.push(
      `נמצאו רק ${n} עסקאות דומות (נדרשות לפחות ${MIN_COMPARABLES_FOR_ESTIMATE}). לא מוצג אומדן, כדי לא להציג דיוק למראית עין. נסו להרחיב רדיוס, טווח תאריכים או טווח סטייה.`,
    );
    return {
      ...base,
      status: "insufficient_data",
      estimateIls: null,
      rangeLowIls: null,
      rangeHighIls: null,
      pricePerSqm: null,
      pricePerSqmRange: null,
      askingPrice: null,
      confidence: { level: "insufficient", score: 0, maxScore: 9, explanations: [`רק ${n} עסקאות דומות`] },
      sensitivity: [],
      drivers: [],
      limitations,
      warnings,
      anomalies: anomaliesFrom(comparables, null),
    };
  }

  // ---------- שלב 6: אומדן מרכזי וטווח ----------
  const pts = included.map((c) => ({ ppsqm: c.adjustedPricePerSqm, w: c.weight }));
  const central = estimateFrom(pts, property.areaSqm)!;
  const confidence = computeConfidence(included, nEff, central.ppsqm, missingSubject.length, searchExpansion, now);

  const values = pts.map((p) => p.ppsqm);
  const weights = pts.map((p) => p.w);
  let lowP = weightedQuantile(values, weights, 0.25);
  let highP = weightedQuantile(values, weights, 0.75);
  const minHalf = MIN_HALF_SPREAD[confidence.level];
  lowP = Math.min(lowP, central.ppsqm * (1 - minHalf));
  highP = Math.max(highP, central.ppsqm * (1 + minHalf));
  if (n < MIN_COMPARABLES_TARGET) {
    lowP = Math.min(lowP, Math.min(...values));
    highP = Math.max(highP, Math.max(...values));
  }

  const estimateIls = roundTo(central.estimate, 10000);
  const rangeLowIls = roundTo(lowP * property.areaSqm, 10000);
  const rangeHighIls = roundTo(highP * property.areaSqm, 10000);

  // ---------- שלב 7: ניתוח רגישות ----------
  const sensitivity = computeSensitivity(included, property.areaSqm, central.estimate, timeAdjustment.applied);

  // ---------- מחיר מבוקש מומלץ (נפרד מהשווי) ----------
  const askingPrice = computeAskingPrice(estimateIls, central.ppsqm, listings);

  return {
    ...base,
    status: "completed",
    estimateIls,
    rangeLowIls,
    rangeHighIls,
    pricePerSqm: Math.round(central.ppsqm),
    pricePerSqmRange: [Math.round(lowP), Math.round(highP)],
    askingPrice,
    confidence,
    sensitivity,
    drivers: computeDrivers(input, included),
    limitations,
    warnings,
    anomalies: anomaliesFrom(comparables, central.ppsqm),
  };
}

// =====================================================================

function missingSubjectFields(input: ValuationInput): string[] {
  const p = input.property;
  const out: string[] = [];
  if (p.floor === undefined) out.push("קומה");
  if (p.elevator === "unknown") out.push("מעלית");
  if (p.parking === "unknown") out.push("חניה");
  if (p.condition === "unknown") out.push("מצב הנכס");
  if (p.mamad === "unknown") out.push("ממ״ד");
  if (p.balcony === "unknown") out.push("מרפסת");
  return out;
}

interface TimeAdjustmentInternal {
  applied: boolean;
  slope: number | null;
  annualChangePct: number | null;
  ciPct: [number, number] | null;
  sampleSize: number;
  scope: string;
  explanation: string;
  trend: { period: string; medianPricePerSqm: number; count: number }[];
}

/**
 * מגמת מחיר למ״ר: רגרסיה של ln(מחיר למ״ר) על הזמן, על כל העסקאות באזור
 * ב-5 השנים האחרונות. מופעלת רק אם n≥30 והשיפוע מובהק (|t|>2).
 */
export function computeTimeAdjustment(
  cityRecords: StoredRecord[],
  neighborhood: string | undefined,
  adjacent: string[],
  now: Date,
): TimeAdjustmentInternal {
  const tx = cityRecords.filter(
    (r) =>
      r.recordType === "completed_transaction" &&
      r.transactionDate &&
      r.transactionPriceIls &&
      r.areaSqm &&
      monthsBetween(r.transactionDate, now) <= 60,
  );
  const local = neighborhood
    ? tx.filter((r) => sameName(r.neighborhood, neighborhood) || adjacent.some((a) => sameName(a, r.neighborhood)))
    : [];
  const pool = local.length >= 30 ? local : tx;
  const scope = local.length >= 30 ? "בשכונה ובשכונות הסמוכות" : "בכל העיר";

  const byQuarter = new Map<string, number[]>();
  for (const r of pool) {
    const d = r.transactionDate!;
    const key = `${d.getUTCFullYear()}-Q${Math.floor(d.getUTCMonth() / 3) + 1}`;
    const arr = byQuarter.get(key) ?? [];
    arr.push(r.transactionPriceIls! / r.areaSqm!);
    byQuarter.set(key, arr);
  }
  const trend = [...byQuarter.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([period, arr]) => ({ period, medianPricePerSqm: Math.round(median(arr)), count: arr.length }));

  const xs = pool.map((r) => -monthsBetween(r.transactionDate!, now) / 12);
  const ys = pool.map((r) => Math.log(r.transactionPriceIls! / r.areaSqm!));
  const reg = linearRegression(xs, ys);
  if (!reg || pool.length < 30) {
    return {
      applied: false,
      slope: null,
      annualChangePct: null,
      ciPct: null,
      sampleSize: pool.length,
      scope,
      explanation: `אין מספיק עסקאות (${pool.length}, נדרשות 30) לכיול מדד זמן מקומי, ולכן לא בוצעה התאמת זמן.`,
      trend,
    };
  }
  const t = reg.slope / (reg.slopeSe || Infinity);
  const annual = Math.round((Math.exp(reg.slope) - 1) * 1000) / 10;
  const ci: [number, number] = [
    Math.round((Math.exp(reg.slope - 1.96 * reg.slopeSe) - 1) * 1000) / 10,
    Math.round((Math.exp(reg.slope + 1.96 * reg.slopeSe) - 1) * 1000) / 10,
  ];
  const applied = Math.abs(t) > 2;
  return {
    applied,
    slope: applied ? reg.slope : null,
    annualChangePct: annual,
    ciPct: ci,
    sampleSize: pool.length,
    scope,
    explanation: applied
      ? `נמצאה מגמה של ${annual}% לשנה (רווח סמך 95%: ${ci[0]}% עד ${ci[1]}%) על בסיס ${pool.length} עסקאות ${scope}. מחירי העסקאות הותאמו להיום לפי מגמה זו.`
      : `המגמה שנמדדה (${annual}% לשנה) אינה מובהקת סטטיסטית, ולכן לא בוצעה התאמת זמן.`,
    trend,
  };
}

function computeConfidence(
  included: ComparableResult[],
  nEff: number,
  centralPpsqm: number,
  missingCount: number,
  expansion: ValuationResult["searchExpansion"],
  now: Date,
): ValuationResult["confidence"] {
  const explanations: string[] = [];
  let score = 0;
  const n = included.length;

  if (nEff >= 8) score += 2;
  else if (nEff >= 5) score += 1;
  explanations.push(`${n} עסקאות השוואה (מדגם אפקטיבי ${nEff.toFixed(1)} לאחר שקלול)`);

  const vals = included.map((c) => c.adjustedPricePerSqm);
  const w = included.map((c) => c.weight);
  const iqr = (weightedQuantile(vals, w, 0.75) - weightedQuantile(vals, w, 0.25)) / centralPpsqm;
  if (iqr < 0.12) score += 2;
  else if (iqr < 0.22) score += 1;
  explanations.push(`פיזור המחיר למ״ר בין העסקאות: ${Math.round(iqr * 100)}% (טווח בין-רבעוני יחסי)`);

  const meanSim = included.reduce((s, c) => s + c.similarity, 0) / n;
  if (meanSim >= 75) score += 2;
  else if (meanSim >= 60) score += 1;
  explanations.push(`דמיון ממוצע לנכס: ${Math.round(meanSim)} מתוך 100`);

  const ages = included.filter((c) => c.date).map((c) => monthsBetween(new Date(c.date!), now));
  const medAge = ages.length ? median(ages) : Infinity;
  if (medAge <= 12) score += 1;
  explanations.push(`גיל חציוני של העסקאות: ${Number.isFinite(medAge) ? Math.round(medAge) : "?"} חודשים`);

  const close = included.filter((c) => ["street", "radius", "neighborhood"].includes(c.tier)).length;
  if (close / n >= 0.6) score += 1;
  else explanations.push("רוב העסקאות מחוץ לסביבה הקרובה");

  if (missingCount <= 1) score += 1;
  else explanations.push(`${missingCount} מאפיינים של הנכס לא ידועים`);

  if (expansion.find((s) => s.tier === "city")?.used) score -= 1;

  let level: ConfidenceLevel = score >= 7 ? "high" : score >= 4 ? "medium" : "low";
  if (n < MIN_COMPARABLES_TARGET) {
    level = "low";
    explanations.push(`פחות מ-${MIN_COMPARABLES_TARGET} עסקאות – האמינות מוגבלת לנמוכה`);
  }
  return { level, score: Math.max(0, score), maxScore: 9, explanations };
}

function computeSensitivity(
  included: ComparableResult[],
  areaSqm: number,
  baseEstimate: number,
  timeApplied: boolean,
): SensitivityScenario[] {
  const pts = included.map((c) => ({ ppsqm: c.adjustedPricePerSqm, w: c.weight, raw: c.pricePerSqm, sim: c.similarity }));
  const out: SensitivityScenario[] = [];
  const add = (key: string, label: string, est: number | null, note?: string) =>
    out.push({
      key,
      label,
      estimateIls: est === null ? null : roundTo(est, 10000),
      deltaPct: est === null ? null : Math.round((est / baseEstimate - 1) * 1000) / 10,
      note,
    });

  if (pts.length >= 4) {
    const loo = pts.map((_, i) => estimateFrom(pts.filter((__, j) => j !== i), areaSqm)!.estimate);
    add("loo_min", "השמטת עסקה אחת – התרחיש הנמוך", Math.min(...loo), "בודק את התלות בעסקה בודדת");
    add("loo_max", "השמטת עסקה אחת – התרחיש הגבוה", Math.max(...loo));
  }
  add(
    "equal_weights",
    "ללא שקלול (חציון פשוט)",
    median(pts.map((p) => p.ppsqm)) * areaSqm,
    "בודק את השפעת משקלות הדמיון",
  );
  const medSim = median(pts.map((p) => p.sim));
  const topHalf = pts.filter((p) => p.sim >= medSim);
  if (topHalf.length >= 2 && topHalf.length < pts.length) {
    add("top_similar", "רק מחצית העסקאות הדומות ביותר", estimateFrom(topHalf, areaSqm)!.estimate);
  }
  if (timeApplied) {
    add("no_time_adj", "ללא התאמת זמן", estimateFrom(pts.map((p) => ({ ppsqm: p.raw, w: p.w })), areaSqm)!.estimate);
  }
  add("area_minus5", "שטח קטן ב-5% (אי-ודאות במדידה)", baseEstimate * 0.95, "השטח הרשום והשטח בפועל נבדלים לעיתים");
  add("area_plus5", "שטח גדול ב-5%", baseEstimate * 1.05);
  return out;
}

function computeAskingPrice(
  estimateIls: number,
  centralPpsqm: number,
  listings: ComparableResult[],
): ValuationResult["askingPrice"] {
  if (listings.length >= 3) {
    const lstMed = median(listings.map((l) => l.pricePerSqm));
    const gap = lstMed / centralPpsqm - 1;
    const premium = clamp(gap, 0, 0.15);
    const low = roundTo(estimateIls * (1 + premium * 0.5), 10000);
    const high = roundTo(estimateIls * (1 + Math.max(premium, 0.02)), 10000);
    return {
      lowIls: low,
      highIls: high,
      basis: "listings_premium",
      explanation: `המחיר המבוקש החציוני למ״ר ב-${listings.length} מודעות דומות גבוה ב-${Math.round(gap * 1000) / 10}% מהאומדן למ״ר לפי עסקאות. הטווח מבוסס על פער זה (מוגבל ל-0%–15%). זהו מחיר שיווק ולא שווי.`,
    };
  }
  return {
    lowIls: roundTo(estimateIls * 1.03, 10000),
    highIls: roundTo(estimateIls * 1.06, 10000),
    basis: "assumption",
    explanation: "אין מספיק מודעות פעילות להשוואה. הטווח (3%–6% מעל האומדן) הוא הנחת עבודה למרווח מיקוח, לא נתון שוק.",
  };
}

/** גורמים מסבירים – רק השוואה מתועדת בין הנכס לעסקאות, ללא מקדמים מומצאים */
function computeDrivers(input: ValuationInput, included: ComparableResult[]): Driver[] {
  const p = input.property;
  const out: Driver[] = [];
  const features: { key: "elevator" | "parkingSpaces" | "mamad" | "balcony" | "storage"; label: string; subject: boolean | null }[] = [
    { key: "elevator", label: "מעלית", subject: triToBool(p.elevator) },
    { key: "parkingSpaces", label: "חניה", subject: parkingToCount(p.parking) === null ? null : parkingToCount(p.parking)! > 0 },
    { key: "mamad", label: "ממ״ד", subject: triToBool(p.mamad) },
    { key: "balcony", label: "מרפסת", subject: triToBool(p.balcony) },
    { key: "storage", label: "מחסן", subject: triToBool(p.storage) },
  ];
  for (const f of features) {
    const known = included.filter((c) => c[f.key] !== null);
    if (f.subject === null || known.length < 3) continue;
    const has = (c: ComparableResult) => (f.key === "parkingSpaces" ? (c.parkingSpaces ?? 0) > 0 : Boolean(c[f.key]));
    const withF = known.filter(has);
    const share = withF.length / known.length;
    let evidence = "";
    const without = known.filter((c) => !has(c));
    if (withF.length >= 3 && without.length >= 3) {
      const diff = median(withF.map((c) => c.adjustedPricePerSqm)) / median(without.map((c) => c.adjustedPricePerSqm)) - 1;
      evidence = ` במדגם זה, החציון למ״ר של עסקאות עם ${f.label} ${diff >= 0 ? "גבוה" : "נמוך"} ב-${Math.abs(Math.round(diff * 100))}% (מתאם במדגם קטן, לא קשר סיבתי).`;
    }
    if (f.subject && share < 0.5) {
      out.push({
        direction: "up",
        basis: evidence ? "data" : "qualitative",
        text: `לנכס יש ${f.label}, ורק ל-${Math.round(share * 100)}% מעסקאות ההשוואה יש.${evidence}`,
      });
    } else if (!f.subject && share > 0.5) {
      out.push({
        direction: "down",
        basis: evidence ? "data" : "qualitative",
        text: `לנכס אין ${f.label}, ול-${Math.round(share * 100)}% מעסקאות ההשוואה יש.${evidence}`,
      });
    }
  }
  const CO: Record<string, number> = { needs_renovation: 0, maintained: 1, renovated: 2, new: 3 };
  const sc = CO[p.condition];
  const knownCond = included.filter((c) => c.condition && CO[c.condition] !== undefined);
  if (sc !== undefined && knownCond.length >= 3) {
    const avg = knownCond.reduce((s, c) => s + CO[c.condition!], 0) / knownCond.length;
    if (sc - avg >= 0.75) out.push({ direction: "up", basis: "qualitative", text: "מצב הנכס טוב מהממוצע בעסקאות ההשוואה." });
    if (avg - sc >= 0.75) out.push({ direction: "down", basis: "qualitative", text: "מצב הנכס פחות טוב מהממוצע בעסקאות ההשוואה." });
  }
  const medArea = median(included.map((c) => c.areaSqm ?? 0).filter(Boolean));
  if (medArea && p.areaSqm / medArea - 1 > 0.1) {
    out.push({
      direction: "down",
      basis: "qualitative",
      text: `הנכס גדול מהחציון בעסקאות (${Math.round(medArea)} מ״ר). בדירות גדולות המחיר למ״ר נוטה להיות נמוך יותר; ההשפעה לא כוילה במודל.`,
    });
  } else if (medArea && 1 - p.areaSqm / medArea > 0.1) {
    out.push({
      direction: "up",
      basis: "qualitative",
      text: `הנכס קטן מהחציון בעסקאות (${Math.round(medArea)} מ״ר). בדירות קטנות המחיר למ״ר נוטה להיות גבוה יותר; ההשפעה לא כוילה במודל.`,
    });
  }
  const floors = included.map((c) => c.floor).filter((f): f is number => f !== null);
  if (p.floor !== undefined && floors.length >= 3) {
    const mf = median(floors);
    if (p.floor - mf >= 3) out.push({ direction: "up", basis: "qualitative", text: `קומה גבוהה מהחציון בעסקאות (קומה ${mf}).` });
    if (mf - p.floor >= 3) out.push({ direction: "down", basis: "qualitative", text: `קומה נמוכה מהחציון בעסקאות (קומה ${mf}).` });
  }
  if (out.length === 0) out.push({ direction: "neutral", basis: "qualitative", text: "מאפייני הנכס דומים לממוצע בעסקאות ההשוואה." });
  return out;
}

function anomaliesFrom(comps: ComparableResult[], central: number | null) {
  const out: ValuationResult["anomalies"] = [];
  for (const c of comps) {
    if (!c.included && c.excludedReason) out.push({ recordId: c.recordId, sourceRecordId: c.sourceRecordId, text: c.excludedReason });
    else if (central && Math.abs(c.adjustedPricePerSqm / central - 1) > 0.25) {
      out.push({
        recordId: c.recordId,
        sourceRecordId: c.sourceRecordId,
        text: `מחיר למ״ר (${c.adjustedPricePerSqm.toLocaleString("he-IL")} ₪) רחוק ביותר מ-25% מהאומדן – כדאי לבדוק את פרטי העסקה`,
      });
    }
  }
  return out;
}

function buildMethodology(settings: ValuationInput["settings"], t: TimeAdjustmentInternal): string[] {
  return [
    `סינון: עסקאות שהושלמו בלבד, באותה עיר, סוג נכס בר-השוואה, ±${settings.roomsTolerance} חדרים, ±${settings.areaTolerancePct}% שטח, עד ${settings.dateRangeMonths} חודשים אחורה${settings.includeOlderIfInsufficient ? " (עם אפשרות להרחבה עד פי 2 כשחסרים נתונים)" : ""}.`,
    `חיפוש מדורג: אותו רחוב, אחר כך רדיוס ${settings.radiusM} מ׳, אחר כך השכונה${settings.includeAdjacentNeighborhoods ? ", השכונות הסמוכות" : ""}, ורק אם נמצאו פחות מ-${MIN_COMPARABLES_TARGET} עסקאות – כל העיר.`,
    `ציון דמיון (0–100) לכל עסקה לפי מרחק, שטח, חדרים, עדכניות, סוג נכס, קומה, מעלית, מרפסת, חניה, מחסן, ממ״ד ומצב. נבחרו ${settings.maxComparables} העסקאות הדומות ביותר.`,
    `התאמת זמן: ${t.explanation}`,
    `זיהוי חריגים: עסקה שמחירה למ״ר סוטה ביותר מ-${OUTLIER_Z} סטיות חסינות (MAD) מהחציון הוצאה מהחישוב ומוצגת לבדיקה.`,
    "משקל כל עסקה = (ציון הדמיון/100)². עסקאות דומות מקבלות משקל גבוה משמעותית.",
    "אומדן מרכזי = חציון משוקלל של המחיר למ״ר × שטח הנכס. חציון ולא ממוצע, כדי שעסקה בודדת לא תטה את התוצאה.",
    `טווח = רבעון תחתון ועליון משוקללים של המחיר למ״ר, עם רוחב מינימלי לפי רמת האמינות (±${Math.round(MIN_HALF_SPREAD.high * 100)}% גבוהה, ±${Math.round(MIN_HALF_SPREAD.medium * 100)}% בינונית, ±${Math.round(MIN_HALF_SPREAD.low * 100)}% נמוכה).`,
    "מודעות פעילות לא משתתפות באומדן השווי. הן משמשות רק לניתוח מתחרים ולהמלצה על מחיר מבוקש.",
  ];
}
