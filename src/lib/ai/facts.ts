import type { ValuationInput } from "@/lib/domain/schema";
import type { ValuationResult } from "@/lib/valuation/types";
import { propertyTypeLabels, confidenceLabels } from "@/lib/domain/labels";

/**
 * "גיליון העובדות" – הדבר היחיד שמודל השפה מקבל. כל מספר בסיכום חייב
 * להופיע כאן (נבדק אוטומטית ב-guard). המודל לא מקבל גישה למקורות אחרים.
 */
export function buildFacts(input: ValuationInput, r: ValuationResult) {
  const p = input.property;
  return {
    property: {
      city: input.location.city,
      neighborhood: input.location.neighborhood ?? null,
      street: input.location.street ?? null,
      type: propertyTypeLabels[p.propertyType],
      rooms: p.rooms,
      areaSqm: p.areaSqm,
      floor: p.floor ?? null,
      buildingFloors: p.buildingFloors ?? null,
    },
    status: r.status,
    usesDemoData: r.usesDemoData,
    estimateIls: r.estimateIls,
    rangeIls: r.rangeLowIls && r.rangeHighIls ? [r.rangeLowIls, r.rangeHighIls] : null,
    pricePerSqm: r.pricePerSqm,
    pricePerSqmRange: r.pricePerSqmRange,
    askingPrice: r.askingPrice ? { low: r.askingPrice.lowIls, high: r.askingPrice.highIls, basis: r.askingPrice.basis } : null,
    confidence: { level: confidenceLabels[r.confidence.level], reasons: r.confidence.explanations },
    counts: r.counts,
    timeAdjustment: r.timeAdjustment,
    listingsVsTransactions: r.listingsVsTransactions,
    comparables: r.comparables
      .filter((c) => c.included)
      .slice(0, 8)
      .map((c) => ({
        id: c.sourceRecordId,
        date: c.date?.slice(0, 10),
        address: c.address,
        rooms: c.rooms,
        areaSqm: c.areaSqm,
        priceIls: c.priceIls,
        pricePerSqm: c.pricePerSqm,
        distanceM: c.distanceM,
        similarity: c.similarity,
      })),
    drivers: r.drivers.map((d) => d.text),
    anomalies: r.anomalies.map((a) => `${a.sourceRecordId}: ${a.text}`),
    warnings: r.warnings,
    limitations: r.limitations,
    sensitivity: r.sensitivity.map((s) => ({ label: s.label, estimateIls: s.estimateIls, deltaPct: s.deltaPct })),
  };
}

export type ValuationFacts = ReturnType<typeof buildFacts>;
