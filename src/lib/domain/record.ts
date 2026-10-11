/**
 * המבנה האחיד של רשומת נכס (ללא תלות ב-Prisma) שבו משתמשים המנוע והמחברים.
 * שדה לא ידוע = null. לעולם לא ממלאים ערך מומצא.
 */
export type RecordType = "completed_transaction" | "active_listing" | "historical_listing";

export interface NormalizedRecord {
  sourceName: string;
  sourceUrl: string | null;
  sourceRecordId: string;
  recordType: RecordType;
  isDemo: boolean;
  transactionDate: Date | null;
  listingDate: Date | null;
  lastSeenAt: Date | null;
  city: string;
  neighborhood: string | null;
  street: string | null;
  houseNumber: string | null;
  address: string | null;
  block: string | null;
  parcel: string | null;
  latitude: number | null;
  longitude: number | null;
  propertyType: string | null;
  rooms: number | null;
  areaSqm: number | null;
  floor: number | null;
  buildingFloors: number | null;
  elevator: boolean | null;
  balcony: boolean | null;
  balconyAreaSqm: number | null;
  parkingSpaces: number | null;
  storage: boolean | null;
  mamad: boolean | null;
  condition: string | null;
  buildingYear: number | null;
  transactionPriceIls: number | null;
  askingPriceIls: number | null;
  dataConfidence: number | null;
  lastVerifiedAt: Date | null;
  rawData?: unknown;
}

/** רשומה כפי שנשמרה במסד, עם מזהה פנימי */
export interface StoredRecord extends NormalizedRecord {
  id: string;
  fetchedAt: Date;
}

export const EMPTY_RECORD_FIELDS: Omit<NormalizedRecord, "sourceName" | "sourceRecordId" | "recordType" | "city" | "isDemo"> = {
  sourceUrl: null,
  transactionDate: null,
  listingDate: null,
  lastSeenAt: null,
  neighborhood: null,
  street: null,
  houseNumber: null,
  address: null,
  block: null,
  parcel: null,
  latitude: null,
  longitude: null,
  propertyType: null,
  rooms: null,
  areaSqm: null,
  floor: null,
  buildingFloors: null,
  elevator: null,
  balcony: null,
  balconyAreaSqm: null,
  parkingSpaces: null,
  storage: null,
  mamad: null,
  condition: null,
  buildingYear: null,
  transactionPriceIls: null,
  askingPriceIls: null,
  dataConfidence: null,
  lastVerifiedAt: null,
};
