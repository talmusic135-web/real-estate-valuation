import { describe, expect, it } from "vitest";
import { runValuation, MIN_COMPARABLES_FOR_ESTIMATE } from "@/lib/valuation/engine";
import { computeSimilarity } from "@/lib/valuation/similarity";
import { NOW, demoRecords, makeInput, tx } from "./helpers";

const point = { latitude: 32.0823, longitude: 34.8106, precision: "street" as const };

function run(input = makeInput(), records = demoRecords()) {
  return runValuation({ input, subjectPoint: point, adjacentNeighborhoods: ["נחלת גנים"], records, now: NOW });
}

describe("valuation engine", () => {
  it("produces an estimate inside its range from completed transactions only", () => {
    const r = run();
    expect(r.status).toBe("completed");
    expect(r.estimateIls).not.toBeNull();
    expect(r.rangeLowIls!).toBeLessThanOrEqual(r.estimateIls!);
    expect(r.rangeHighIls!).toBeGreaterThanOrEqual(r.estimateIls!);
    expect(r.counts.transactionsUsed).toBeGreaterThanOrEqual(MIN_COMPARABLES_FOR_ESTIMATE);
    expect(r.comparables.every((c) => c.kind === "transaction")).toBe(true);
    expect(r.listings.every((c) => c.kind === "listing")).toBe(true);
  });

  it("estimate equals weighted-median price per sqm × area (explainable)", () => {
    const r = run();
    expect(Math.abs(r.estimateIls! - r.pricePerSqm! * 95)).toBeLessThanOrEqual(10_000);
    const weightSum = r.comparables.filter((c) => c.included).reduce((s, c) => s + c.weight, 0);
    expect(weightSum).toBeCloseTo(1, 2);
  });

  it("is in a plausible range for the synthetic market", () => {
    // מחיר בסיס סינתטי במרכז רמת גן: 36,000 ₪ למ״ר
    const r = run();
    expect(r.pricePerSqm!).toBeGreaterThan(30_000);
    expect(r.pricePerSqm!).toBeLessThan(48_000);
  });

  it("changing rooms or area changes the comparables", () => {
    const a = run(makeInput({ property: { rooms: 3, areaSqm: 70 } }));
    const b = run(makeInput({ property: { rooms: 5, areaSqm: 125 } }));
    const idsA = new Set(a.comparables.map((c) => c.recordId));
    const overlap = b.comparables.filter((c) => idsA.has(c.recordId)).length;
    expect(overlap).toBeLessThan(b.comparables.length / 2);
    expect(a.comparables.every((c) => c.rooms === null || Math.abs(c.rooms - 3) <= 1)).toBe(true);
    expect(b.estimateIls!).toBeGreaterThan(a.estimateIls!);
  });

  it("does not show an estimate when there is not enough data", () => {
    const r = run(makeInput({ location: { city: "מצפה רמון", neighborhood: undefined, street: undefined } }));
    expect(r.status).toBe("insufficient_data");
    expect(r.estimateIls).toBeNull();
    expect(r.confidence.level).toBe("insufficient");
    expect(r.warnings.join(" ")).toContain("לא מוצג אומדן");
  });

  it("excludes and flags an outlier transaction", () => {
    const base = Array.from({ length: 10 }, (_, i) =>
      tx(`t${i}`, { transactionPriceIls: 2_000_000 + i * 20_000, transactionDate: new Date(`2026-0${(i % 8) + 1}-15`) }),
    );
    const outlier = tx("bad", { transactionPriceIls: 7_000_000 });
    const r = run(
      makeInput({ location: { city: "עיר בדיקה", neighborhood: "שכונה", street: "הרחוב" }, property: { areaSqm: 100 } }),
      [...base, outlier],
    );
    const bad = r.comparables.find((c) => c.recordId === "bad");
    expect(bad?.included).toBe(false);
    expect(r.anomalies.some((a) => a.recordId === "bad")).toBe(true);
    expect(r.estimateIls!).toBeLessThan(2_300_000);
  });

  it("never treats asking prices as sale prices", () => {
    const records = [
      ...Array.from({ length: 6 }, (_, i) => tx(`t${i}`, { transactionPriceIls: 2_000_000 })),
      ...Array.from({ length: 6 }, (_, i) =>
        tx(`l${i}`, { recordType: "active_listing", transactionPriceIls: null, askingPriceIls: 9_000_000, transactionDate: null, listingDate: new Date("2026-09-01") }),
      ),
    ];
    const r = run(makeInput({ location: { city: "עיר בדיקה", neighborhood: "שכונה", street: "הרחוב" }, property: { areaSqm: 100 } }), records);
    expect(r.estimateIls).toBe(2_000_000);
    expect(r.listings).toHaveLength(6);
    expect(r.askingPrice).not.toBeNull();
    // המחיר המבוקש מוגבל ל-15% מעל השווי גם כשהמודעות גבוהות בהרבה
    expect(r.askingPrice!.highIls).toBeLessThanOrEqual(2_300_000);
  });

  it("expands the search progressively and reports it", () => {
    const r = run(makeInput({ settings: { radiusM: 250, maxComparables: 30 } }));
    expect(r.searchExpansion[0].tier).toBe("street");
    expect(r.searchExpansion.some((s) => s.used)).toBe(true);
  });

  it("detects the synthetic upward price trend and adjusts for time", () => {
    const r = run();
    expect(r.timeAdjustment.applied).toBe(true);
    expect(r.timeAdjustment.annualChangePct!).toBeGreaterThan(1);
    expect(r.timeAdjustment.annualChangePct!).toBeLessThan(10);
  });

  it("explains every comparable with reasons and a similarity score", () => {
    const r = run();
    for (const c of r.comparables) {
      expect(c.similarity).toBeGreaterThan(0);
      expect(c.similarity).toBeLessThanOrEqual(100);
      expect(c.reasons.length).toBeGreaterThan(0);
    }
  });

  it("returns a sensitivity analysis and methodology", () => {
    const r = run();
    expect(r.sensitivity.length).toBeGreaterThanOrEqual(3);
    expect(r.methodology.length).toBeGreaterThan(5);
    expect(r.usesDemoData).toBe(true);
  });
});

describe("similarity", () => {
  it("identical property scores higher than a different one", () => {
    const input = makeInput({ location: { city: "עיר בדיקה" } });
    const ctx = { property: input.property, settings: input.settings, street: "הרחוב", neighborhood: "שכונה", adjacentNeighborhoods: [], now: NOW };
    const same = tx("a", { rooms: 4, areaSqm: 95, floor: 3, elevator: true, mamad: true, parkingSpaces: 1, condition: "maintained" });
    const diff = tx("b", { rooms: 3, areaSqm: 75, floor: 0, elevator: false, mamad: false, parkingSpaces: 0, condition: "needs_renovation", street: "אחר" });
    expect(computeSimilarity(ctx, same, 50).score).toBeGreaterThan(computeSimilarity(ctx, diff, 900).score);
  });
});
