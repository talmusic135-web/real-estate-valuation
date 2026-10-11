import { describe, expect, it } from "vitest";
import { runConnectors } from "@/lib/connectors/registry";
import { GovIlTransactionsConnector, LicensedListingsConnector } from "@/lib/connectors/connectors";
import { NotConfiguredError, type DataConnector } from "@/lib/connectors/types";
import { normalizeFlat, normalizeGovIl, parseHebrewFloor, validateRecord } from "@/lib/connectors/normalize";
import { parseCsv } from "@/lib/csv";
import { EMPTY_RECORD_FIELDS } from "@/lib/domain/record";

const query = { city: "רמת גן", recordTypes: ["completed_transaction" as const], since: new Date("2020-01-01") };

function fake(id: string, impl: () => Promise<never[] | ReturnType<typeof normalizeFlat>[]>): DataConnector {
  return {
    id,
    info: () => ({
      id,
      name: id,
      description: "",
      kind: "official_transactions",
      recordTypes: ["completed_transaction"],
      status: "connected",
      statusMessage: "",
      requirements: [],
      termsNote: "",
      storedLocally: false,
    }),
    search: impl,
  };
}

describe("connector registry", () => {
  it("a failing source does not break the search", async () => {
    const ok = fake("ok", async () => [
      { ...EMPTY_RECORD_FIELDS, sourceName: "ok", sourceRecordId: "1", recordType: "completed_transaction", isDemo: false, city: "רמת גן" },
    ]);
    const broken = fake("broken", async () => {
      throw new Error("503 Service Unavailable");
    });
    const res = await runConnectors(query, [broken, ok]);
    expect(res.find((r) => r.connectorId === "broken")!.status).toBe("error");
    expect(res.find((r) => r.connectorId === "ok")!.status).toBe("success");
    expect(res.find((r) => r.connectorId === "ok")!.records).toHaveLength(1);
  });

  it("times out a hanging source", async () => {
    const hang = fake("hang", () => new Promise(() => {}));
    const res = await runConnectors(query, [hang], 50);
    expect(res[0].status).toBe("error");
    expect(res[0].message).toContain("לא הגיב");
  });

  it("unconfigured real sources are reported as not connected, not as errors", async () => {
    delete process.env.GOVIL_NADLAN_ENABLED;
    delete process.env.LISTINGS_PROVIDER_URL;
    const gov = new GovIlTransactionsConnector();
    const listings = new LicensedListingsConnector();
    expect(gov.info().status).toBe("not_configured");
    expect(listings.info().status).toBe("not_configured");
    await expect(gov.search(query)).rejects.toBeInstanceOf(NotConfiguredError);
    const res = await runConnectors(query, [gov, listings]);
    expect(res.every((r) => r.status === "skipped")).toBe(true);
  });
});

describe("normalization", () => {
  it("maps a government-format row and keeps unknowns as null", () => {
    const r = normalizeGovIl(
      {
        DEALDATETIME: "2026-03-14T00:00:00",
        FULLADRESS: "ביאליק 12, רמת גן",
        GUSH: "6147-123-4",
        DEALNATUREDESCRIPTION: "דירה בבית קומות",
        ASSETROOMNUM: 4,
        FLOORNO: "שלישית",
        DEALNATURE: 98,
        DEALAMOUNT: 2_950_000,
        BUILDINGYEAR: 1978,
      },
      "רמת גן",
    );
    expect(r.street).toBe("ביאליק");
    expect(r.houseNumber).toBe("12");
    expect(r.block).toBe("6147");
    expect(r.parcel).toBe("123");
    expect(r.floor).toBe(3);
    expect(r.propertyType).toBe("apartment");
    expect(r.elevator).toBeNull();
    expect(r.parkingSpaces).toBeNull();
    expect(validateRecord(r)).toEqual([]);
  });

  it("parses Hebrew floor names", () => {
    expect(parseHebrewFloor("קרקע")).toBe(0);
    expect(parseHebrewFloor("חמישית מתוך 8")).toBe(5);
    expect(parseHebrewFloor("7")).toBe(7);
    expect(parseHebrewFloor("מרתף")).toBeNull();
  });

  it("rejects implausible records", () => {
    const r = normalizeFlat({ source_record_id: "x", city: "חיפה", transaction_price_ils: "50", transaction_date: "2026-01-01" }, "csv_upload");
    expect(validateRecord(r)).toContain("מחיר לא סביר");
  });

  it("parses CSV with quotes and Israeli dates", () => {
    const rows = parseCsv('source_record_id,city,street,transaction_date,transaction_price_ils\n1,"תל אביב-יפו","דיזנגוף, פינת גורדון",14/03/2026,"3,100,000"\n');
    expect(rows).toHaveLength(1);
    const r = normalizeFlat(rows[0], "csv_upload");
    expect(r.street).toBe("דיזנגוף, פינת גורדון");
    expect(r.transactionDate!.toISOString().slice(0, 10)).toBe("2026-03-14");
    expect(r.transactionPriceIls).toBe(3_100_000);
  });
});
