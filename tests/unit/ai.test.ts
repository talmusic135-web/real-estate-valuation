import { describe, expect, it } from "vitest";
import { buildFacts } from "@/lib/ai/facts";
import { verifyNumbers } from "@/lib/ai/guard";
import { generateSummary, type AIProvider } from "@/lib/ai/provider";
import { templateSummary } from "@/lib/ai/template";
import { runValuation } from "@/lib/valuation/engine";
import { NOW, demoRecords, makeInput } from "./helpers";

const input = makeInput();
const result = runValuation({
  input,
  subjectPoint: { latitude: 32.0823, longitude: 34.8106, precision: "street" },
  adjacentNeighborhoods: [],
  records: demoRecords(),
  now: NOW,
});
const facts = buildFacts(input, result);

describe("AI guard", () => {
  it("the template summary only uses numbers from the facts", () => {
    const text = templateSummary(facts);
    expect(text).toContain("נתוני הדגמה");
    expect(verifyNumbers(text, facts).ok).toBe(true);
  });

  it("rejects an invented price", () => {
    const check = verifyNumbers("הדירה שווה 9,876,543 ₪ לפי עסקה ברחוב הסמוך", facts);
    expect(check.ok).toBe(false);
    expect(check.unsupported).toContain(9876543);
  });

  it("accepts numbers written in millions", () => {
    const m = Math.round((result.estimateIls! / 1_000_000) * 100) / 100;
    expect(verifyNumbers(`האומדן הוא כ-${m} מיליון ₪`, facts).ok).toBe(true);
  });

  it("falls back to the template when the model invents numbers", async () => {
    const liar: AIProvider = { id: "fake", summarize: async () => "נמכרה דירה זהה ב-12,345,678 ₪" };
    const s = await generateSummary(facts, liar);
    expect(s.provider).toBe("template");
    expect(s.note).toContain("נדחה");
  });

  it("falls back when the model is unavailable", async () => {
    const down: AIProvider = {
      id: "fake",
      summarize: async () => {
        throw new Error("network");
      },
    };
    const s = await generateSummary(facts, down);
    expect(s.provider).toBe("template");
  });
});
