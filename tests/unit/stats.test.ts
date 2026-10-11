import { describe, expect, it } from "vitest";
import { effectiveSampleSize, linearRegression, median, robustZScores, weightedQuantile } from "@/lib/stats";

describe("stats", () => {
  it("median", () => {
    expect(median([3, 1, 2])).toBe(2);
    expect(median([4, 1, 2, 3])).toBe(2.5);
  });

  it("weighted median equals plain median with equal weights", () => {
    expect(weightedQuantile([10, 20, 30], [1, 1, 1], 0.5)).toBe(20);
  });

  it("weighted median moves toward heavy weight", () => {
    const wm = weightedQuantile([10, 20, 30], [1, 1, 10], 0.5);
    expect(wm).toBeGreaterThan(20);
    expect(wm).toBeLessThanOrEqual(30);
  });

  it("quantiles are monotonic", () => {
    const v = [5, 9, 1, 7, 3];
    const w = [1, 2, 1, 3, 1];
    expect(weightedQuantile(v, w, 0.25)).toBeLessThanOrEqual(weightedQuantile(v, w, 0.5));
    expect(weightedQuantile(v, w, 0.5)).toBeLessThanOrEqual(weightedQuantile(v, w, 0.75));
  });

  it("effective sample size", () => {
    expect(effectiveSampleSize([1, 1, 1, 1])).toBeCloseTo(4);
    expect(effectiveSampleSize([1, 0, 0, 0])).toBeCloseTo(1);
  });

  it("robust z flags an obvious outlier", () => {
    const z = robustZScores([100, 102, 98, 101, 99, 300]);
    expect(Math.abs(z[5])).toBeGreaterThan(3.5);
    expect(Math.abs(z[0])).toBeLessThan(1);
  });

  it("linear regression recovers slope", () => {
    const xs = [0, 1, 2, 3, 4];
    const reg = linearRegression(xs, xs.map((x) => 2 + 0.5 * x));
    expect(reg!.slope).toBeCloseTo(0.5);
    expect(reg!.intercept).toBeCloseTo(2);
  });
});
