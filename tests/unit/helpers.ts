import { generateDemoData } from "@/lib/demo/generator";
import { ValuationInputSchema, type ValuationInput } from "@/lib/domain/schema";
import { EMPTY_RECORD_FIELDS, type StoredRecord } from "@/lib/domain/record";

export const NOW = new Date("2026-10-01T00:00:00Z");

let cached: StoredRecord[] | null = null;
export function demoRecords(): StoredRecord[] {
  if (!cached) {
    cached = generateDemoData(NOW).records.map((r, i) => ({ ...r, id: `r${i}`, fetchedAt: NOW }));
  }
  return cached;
}

export function makeInput(overrides: {
  location?: Partial<ValuationInput["location"]>;
  property?: Partial<ValuationInput["property"]>;
  settings?: Partial<ValuationInput["settings"]>;
} = {}): ValuationInput {
  return ValuationInputSchema.parse({
    location: { city: "רמת גן", neighborhood: "מרכז העיר", street: "ביאליק", ...overrides.location },
    property: {
      propertyType: "apartment",
      rooms: 4,
      areaSqm: 95,
      floor: 3,
      buildingFloors: 6,
      elevator: "yes",
      balcony: "yes",
      parking: "one",
      storage: "no",
      mamad: "yes",
      condition: "maintained",
      ...overrides.property,
    },
    settings: { ...overrides.settings },
  });
}

export function tx(id: string, fields: Partial<StoredRecord>): StoredRecord {
  return {
    ...EMPTY_RECORD_FIELDS,
    id,
    fetchedAt: NOW,
    sourceName: "test",
    sourceRecordId: id,
    recordType: "completed_transaction",
    isDemo: false,
    city: "עיר בדיקה",
    neighborhood: "שכונה",
    street: "הרחוב",
    propertyType: "apartment",
    rooms: 4,
    areaSqm: 100,
    transactionDate: new Date("2026-06-01"),
    transactionPriceIls: 2_000_000,
    ...fields,
  };
}
