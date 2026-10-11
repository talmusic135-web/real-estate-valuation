import { afterEach, describe, expect, it } from "vitest";
import { GovmapTransactionsConnector, mercatorToWgs84, normalizeGovmapDeal, wgs84ToMercator, wktCentroid } from "@/lib/connectors/govmap";
import { runConnectors } from "@/lib/connectors/registry";
import { autocomplete, deals, polygons } from "./fixtures/govmap";

afterEach(() => {
  delete process.env.GOVMAP_ENABLED;
});

function fakeFetch(log: string[]) {
  return (async (input: string | URL | Request) => {
    const url = String(input);
    log.push(url);
    const body = url.includes("autocomplete") ? autocomplete : url.includes("/real-estate/deals/") ? polygons : deals;
    return new Response(JSON.stringify(body), { status: 200, headers: { "Content-Type": "application/json" } });
  }) as typeof fetch;
}

const query = {
  city: "חולון",
  street: "סוקולוב",
  houseNumber: "38",
  recordTypes: ["completed_transaction" as const],
  since: new Date("2022-01-01"),
};

describe("GovMap – המרות", () => {
  it("Web Mercator ↔ WGS84 הלוך ושוב", () => {
    const p = mercatorToWgs84(3871467.98, 3766276.97);
    expect(p.lat).toBeGreaterThan(31.9);
    expect(p.lat).toBeLessThan(32.1);
    expect(p.lng).toBeGreaterThan(34.7);
    expect(p.lng).toBeLessThan(34.85);
    const back = wgs84ToMercator(p.lat, p.lng);
    expect(back.x).toBeCloseTo(3871467.98, 3);
    expect(back.y).toBeCloseTo(3766276.97, 3);
  });

  it("מרכז צורת WKT", () => {
    expect(wktCentroid("POINT(10 20)")).toEqual({ x: 10, y: 20 });
    expect(wktCentroid("POLYGON((0 0,2 0,2 2,0 2))")).toEqual({ x: 1, y: 1 });
    expect(wktCentroid(null)).toBeNull();
  });
});

describe("GovMap – נרמול", () => {
  it("עסקת דירה הופכת לעסקה אמיתית ומסומנת במקור", () => {
    const r = normalizeGovmapDeal(deals[0], "חולון")!;
    expect(r.sourceName).toBe("govmap");
    expect(r.isDemo).toBe(false);
    expect(r.recordType).toBe("completed_transaction");
    expect(r.transactionPriceIls).toBe(1_600_000);
    expect(r.areaSqm).toBe(61);
    expect(r.rooms).toBe(3);
    expect(r.floor).toBe(3);
    expect(r.street).toBe("סוקולוב");
    expect(r.houseNumber).toBe("40");
    expect(r.propertyType).toBe("apartment");
    expect(r.latitude).toBeGreaterThan(31.9);
    expect(r.transactionDate?.toISOString().slice(0, 10)).toBe("2025-09-11");
  });

  it("נכס שאינו למגורים (חנות) לא נכנס", () => {
    expect(normalizeGovmapDeal(deals[1], "חולון")).toBeNull();
  });

  it("שם עיר בכתיב אחר מתיישר לעיר שנבחרה", () => {
    const r = normalizeGovmapDeal({ ...deals[0], settlementNameHeb: "תל אביב -יפו" }, "תל אביב-יפו")!;
    expect(r.city).toBe("תל אביב-יפו");
  });

  it("בלי מחיר או תאריך – לא ממציאים", () => {
    expect(normalizeGovmapDeal({ ...deals[0], dealAmount: null }, "חולון")).toBeNull();
    expect(normalizeGovmapDeal({ ...deals[0], dealDate: null }, "חולון")).toBeNull();
  });
});

describe("GovMap – מחבר", () => {
  it("כבוי כברירת מחדל ומדולג בלי להפיל את ההערכה", async () => {
    const c = new GovmapTransactionsConnector(fakeFetch([]));
    expect(c.info().status).toBe("disabled");
    const [run] = await runConnectors(query, [c]);
    expect(run.status).toBe("skipped");
  });

  it("כתובת ← פוליגונים ← עסקאות, רק דירות בטווח התאריכים", async () => {
    process.env.GOVMAP_ENABLED = "true";
    const log: string[] = [];
    const c = new GovmapTransactionsConnector(fakeFetch(log));
    const recs = await c.search(query);
    expect(recs.map((r) => r.sourceRecordId)).toEqual(["3605441001"]); // החנות והעסקה מ-2018 סוננו
    expect(log[0]).toContain("/search-service/autocomplete");
    expect(log[1]).toMatch(/\/real-estate\/deals\/3871467\.98,3766276\.97\/500$/);
    expect(log[2]).toContain("/real-estate/neighborhood-deals/7170-31?");
    expect(log[2]).toContain("startDate=2022-01");
    expect(log.length).toBe(4); // לכל היותר שני פוליגונים
  });

  it("נקודה מהמפה מדלגת על חיפוש הכתובת", async () => {
    process.env.GOVMAP_ENABLED = "true";
    const log: string[] = [];
    await new GovmapTransactionsConnector(fakeFetch(log)).search({ ...query, latitude: 32.01, longitude: 34.77 });
    expect(log.some((u) => u.includes("autocomplete"))).toBe(false);
  });

  it("חסימה (403) מדווחת כשגיאה ולא עוקפים", async () => {
    process.env.GOVMAP_ENABLED = "true";
    const blocked = (async () => new Response("", { status: 403 })) as unknown as typeof fetch;
    const [run] = await runConnectors(query, [new GovmapTransactionsConnector(blocked)]);
    expect(run.status).toBe("error");
    expect(run.message).toContain("403");
  });
});

describe("הפרדת הדגמה מנתונים אמיתיים", () => {
  it("כשיש עסקה אמיתית בעיר, נתוני ההדגמה לא נכנסים לחישוב", async () => {
    const { preferRealOverDemo } = await import("@/lib/services/records");
    const real = { ...normalizeGovmapDeal(deals[0], "חולון")!, id: "r", fetchedAt: new Date() };
    const demo = { ...real, id: "d", isDemo: true, sourceName: "demo", sourceRecordId: "DEMO-1" };
    expect(preferRealOverDemo([real, demo]).map((r) => r.id)).toEqual(["r"]);
    expect(preferRealOverDemo([demo]).map((r) => r.id)).toEqual(["d"]);
  });
});
