import type { Reason } from "./similarity";

export type Tier = "street" | "radius" | "neighborhood" | "adjacent" | "older" | "city";
export type ConfidenceLevel = "high" | "medium" | "low" | "insufficient";

export interface ComparableResult {
  recordId: string;
  kind: "transaction" | "listing";
  sourceName: string;
  sourceRecordId: string;
  sourceUrl: string | null;
  isDemo: boolean;
  date: string | null;
  city: string;
  neighborhood: string | null;
  street: string | null;
  address: string | null;
  latitude: number | null;
  longitude: number | null;
  propertyType: string | null;
  rooms: number | null;
  areaSqm: number | null;
  floor: number | null;
  elevator: boolean | null;
  balcony: boolean | null;
  parkingSpaces: number | null;
  mamad: boolean | null;
  storage: boolean | null;
  condition: string | null;
  priceIls: number; // מחיר עסקה (לעסקאות) או מחיר מבוקש (למודעות)
  pricePerSqm: number;
  /** מחיר למ״ר לאחר התאמת זמן (רק לעסקאות, רק אם מדד הזמן מבוסס סטטיסטית) */
  adjustedPricePerSqm: number;
  timeAdjustmentFactor: number;
  distanceM: number | null;
  similarity: number;
  weight: number; // משקל מנורמל (סכום = 1 בין הכלולים)
  tier: Tier;
  included: boolean;
  excludedReason: string | null;
  reasons: Reason[];
  daysOnMarket: number | null;
  priceChanges: { priceIls: number; observedAt: string }[] | null;
}

export interface SensitivityScenario {
  key: string;
  label: string;
  estimateIls: number | null;
  deltaPct: number | null;
  note?: string;
}

export interface Driver {
  direction: "up" | "down" | "neutral";
  text: string;
  basis: "data" | "qualitative";
}

export interface ValuationResult {
  algorithmVersion: string;
  computedAt: string;
  status: "completed" | "insufficient_data";
  estimateIls: number | null;
  rangeLowIls: number | null;
  rangeHighIls: number | null;
  pricePerSqm: number | null;
  pricePerSqmRange: [number, number] | null;
  askingPrice: {
    lowIls: number;
    highIls: number;
    basis: "listings_premium" | "assumption";
    explanation: string;
  } | null;
  confidence: { level: ConfidenceLevel; score: number; maxScore: number; explanations: string[] };
  counts: {
    candidatesInCity: number;
    passedFilters: number;
    transactionsUsed: number;
    transactionsExcluded: number;
    activeListingsFound: number;
    effectiveSampleSize: number;
  };
  dataFreshness: { latestTransactionDate: string | null; latestFetchedAt: string | null; oldestTransactionDate: string | null };
  subjectLocation: { latitude: number; longitude: number; precision: string } | null;
  searchExpansion: { tier: Tier; label: string; available: number; cumulative: number; used: boolean }[];
  filterLog: { reason: string; count: number }[];
  timeAdjustment: {
    applied: boolean;
    annualChangePct: number | null;
    ciPct: [number, number] | null;
    sampleSize: number;
    scope: string;
    explanation: string;
  };
  comparables: ComparableResult[];
  listings: ComparableResult[];
  sensitivity: SensitivityScenario[];
  drivers: Driver[];
  limitations: string[];
  warnings: string[];
  anomalies: { recordId: string; sourceRecordId: string; text: string }[];
  marketTrend: { period: string; medianPricePerSqm: number; count: number }[];
  listingsVsTransactions: { listingMedianPpsqm: number | null; transactionMedianPpsqm: number | null; gapPct: number | null };
  methodology: string[];
  usesDemoData: boolean;
}
