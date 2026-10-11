/**
 * המרת נתונים גולמיים למבנה האחיד. משמש את מחבר ההעלאה (CSV), את מחבר
 * הספק המורשה ואת מחבר המאגר הממשלתי.
 * כלל ברזל: ערך שלא קיים או לא תקין → null. לא משלימים ולא מנחשים.
 */
import { EMPTY_RECORD_FIELDS, type NormalizedRecord, type RecordType } from "@/lib/domain/record";

export function toNum(v: unknown): number | null {
  if (v === null || v === undefined) return null;
  const s = String(v).replace(/[,₪\s]/g, "").trim();
  if (s === "") return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

export function toInt(v: unknown): number | null {
  const n = toNum(v);
  return n === null ? null : Math.round(n);
}

export function toBool(v: unknown): boolean | null {
  if (v === null || v === undefined) return null;
  const s = String(v).trim().toLowerCase();
  if (["1", "true", "yes", "כן", "y", "v", "יש"].includes(s)) return true;
  if (["0", "false", "no", "לא", "n", "אין"].includes(s)) return false;
  return null;
}

export function toDate(v: unknown): Date | null {
  if (v === null || v === undefined || v === "") return null;
  const s = String(v).trim();
  // תמיכה ב-DD/MM/YYYY ו-DD.MM.YYYY (פורמט ישראלי)
  const il = s.match(/^(\d{1,2})[./](\d{1,2})[./](\d{4})$/);
  const d = il ? new Date(Date.UTC(+il[3], +il[2] - 1, +il[1])) : new Date(s);
  return Number.isNaN(d.getTime()) ? null : d;
}

export function toStr(v: unknown): string | null {
  if (v === null || v === undefined) return null;
  const s = String(v).trim();
  return s === "" ? null : s;
}

const PROPERTY_TYPE_MAP: Record<string, string> = {
  דירה: "apartment",
  "דירה בבית קומות": "apartment",
  "דירת גן": "garden",
  "דירת גג": "roof",
  פנטהאוז: "penthouse",
  "דירת פנטהאוז": "penthouse",
  "דירת גג (פנטהאוז)": "penthouse",
  דופלקס: "duplex",
  apartment: "apartment",
  garden: "garden",
  penthouse: "penthouse",
  duplex: "duplex",
  roof: "roof",
};

export function toPropertyType(v: unknown): string | null {
  const s = toStr(v);
  if (!s) return null;
  return PROPERTY_TYPE_MAP[s] ?? (s.includes("גג") ? "roof" : s.includes("גן") ? "garden" : s.includes("דירה") ? "apartment" : "other");
}

const CONDITION_MAP: Record<string, string> = {
  חדש: "new",
  "חדש מקבלן": "new",
  משופץ: "renovated",
  שמור: "maintained",
  "דרוש שיפוץ": "needs_renovation",
  "דורש שיפוץ": "needs_renovation",
  new: "new",
  renovated: "renovated",
  maintained: "maintained",
  needs_renovation: "needs_renovation",
};

export function toCondition(v: unknown): string | null {
  const s = toStr(v);
  return s ? CONDITION_MAP[s] ?? null : null;
}

/** בדיקות סבירות בסיסיות. רשומה לא סבירה נדחית ולא "מתוקנת" */
export function validateRecord(r: NormalizedRecord): string[] {
  const errors: string[] = [];
  if (!r.city) errors.push("חסרה עיר");
  if (!r.sourceRecordId) errors.push("חסר מזהה רשומה במקור");
  if (r.recordType === "completed_transaction") {
    if (!r.transactionPriceIls) errors.push("חסר מחיר עסקה");
    if (!r.transactionDate) errors.push("חסר תאריך עסקה");
  }
  if (r.recordType === "active_listing" && !r.askingPriceIls) errors.push("חסר מחיר מבוקש");
  if (r.areaSqm !== null && (r.areaSqm < 10 || r.areaSqm > 2000)) errors.push("שטח לא סביר");
  if (r.rooms !== null && (r.rooms < 1 || r.rooms > 15)) errors.push("מספר חדרים לא סביר");
  const price = r.transactionPriceIls ?? r.askingPriceIls;
  if (price !== null && (price < 100_000 || price > 200_000_000)) errors.push("מחיר לא סביר");
  if (r.latitude !== null && (r.latitude < 29 || r.latitude > 34)) errors.push("קו רוחב מחוץ לישראל");
  if (r.longitude !== null && (r.longitude < 34 || r.longitude > 36)) errors.push("קו אורך מחוץ לישראל");
  return errors;
}

/**
 * המרה ממבנה "שטוח" (CSV/JSON) במבנה השדות האחיד, עם שמות עמודות באנגלית
 * (source_record_id, transaction_date, ...) – ראו docs/DATA_IMPORT.md.
 */
export function normalizeFlat(
  row: Record<string, unknown>,
  sourceName: string,
  defaults: { recordType?: RecordType; isDemo?: boolean } = {},
): NormalizedRecord {
  const recordType = (toStr(row.record_type) as RecordType | null) ?? defaults.recordType ?? "completed_transaction";
  return {
    ...EMPTY_RECORD_FIELDS,
    sourceName,
    sourceUrl: toStr(row.source_url),
    sourceRecordId: toStr(row.source_record_id) ?? "",
    recordType: ["completed_transaction", "active_listing", "historical_listing"].includes(recordType)
      ? recordType
      : "completed_transaction",
    isDemo: defaults.isDemo ?? false,
    transactionDate: toDate(row.transaction_date),
    listingDate: toDate(row.listing_date),
    lastSeenAt: toDate(row.last_seen_at),
    city: toStr(row.city) ?? "",
    neighborhood: toStr(row.neighborhood),
    street: toStr(row.street),
    houseNumber: toStr(row.house_number),
    address: toStr(row.address),
    block: toStr(row.block),
    parcel: toStr(row.parcel),
    latitude: toNum(row.latitude),
    longitude: toNum(row.longitude),
    propertyType: toPropertyType(row.property_type),
    rooms: toNum(row.rooms),
    areaSqm: toNum(row.area_sqm),
    floor: toInt(row.floor),
    buildingFloors: toInt(row.building_floors),
    elevator: toBool(row.elevator),
    balcony: toBool(row.balcony),
    balconyAreaSqm: toNum(row.balcony_area_sqm),
    parkingSpaces: toInt(row.parking_spaces),
    storage: toBool(row.storage),
    mamad: toBool(row.mamad),
    condition: toCondition(row.condition),
    buildingYear: toInt(row.building_year),
    transactionPriceIls: toInt(row.transaction_price_ils),
    askingPriceIls: toInt(row.asking_price_ils),
    dataConfidence: toNum(row.data_confidence),
    lastVerifiedAt: toDate(row.last_verified_at),
    rawData: row,
  };
}

/**
 * המרה מפורמט הייצוא של אתר מידע הנדל"ן הממשלתי (nadlan.gov.il).
 * שמות השדות מבוססים על מבנה הנתונים שהאתר מציג; יש לאמת מול
 * ממשק/קובץ רשמי בשלב 2 לפני הסתמכות בייצור.
 */
export function normalizeGovIl(row: Record<string, unknown>, city: string): NormalizedRecord {
  const gush = toStr(row.GUSH); // לדוגמה "6638-123-4"
  const [block, parcel] = gush ? gush.split("-") : [null, null];
  const address = toStr(row.FULLADRESS) ?? toStr(row.DISPLAYADRESS);
  const streetMatch = address?.match(/^(.+?)\s+(\d+[א-ת]?)/);
  return {
    ...EMPTY_RECORD_FIELDS,
    sourceName: "govil_nadlan",
    sourceUrl: "https://www.nadlan.gov.il/",
    sourceRecordId: toStr(row.KEYVALUE) ?? [gush, toStr(row.DEALDATETIME), toStr(row.DEALAMOUNT)].join("|"),
    recordType: "completed_transaction",
    isDemo: false,
    transactionDate: toDate(row.DEALDATETIME),
    city,
    street: streetMatch ? streetMatch[1].replace(/,.*$/, "").trim() : null,
    houseNumber: streetMatch ? streetMatch[2] : null,
    address,
    block: block ?? null,
    parcel: parcel ?? null,
    propertyType: toPropertyType(row.DEALNATUREDESCRIPTION),
    rooms: toNum(row.ASSETROOMNUM),
    areaSqm: toNum(row.DEALNATURE),
    floor: parseHebrewFloor(toStr(row.FLOORNO)),
    buildingFloors: toInt(row.BUILDINGFLOORS),
    buildingYear: toInt(row.BUILDINGYEAR),
    transactionPriceIls: toInt(row.DEALAMOUNT),
    dataConfidence: 0.9,
    lastVerifiedAt: new Date(),
    rawData: row,
  };
}

const HEB_FLOORS: Record<string, number> = {
  קרקע: 0,
  ראשונה: 1,
  שניה: 2,
  שנייה: 2,
  שלישית: 3,
  רביעית: 4,
  חמישית: 5,
  שישית: 6,
  שביעית: 7,
  שמינית: 8,
  תשיעית: 9,
  עשירית: 10,
};

export function parseHebrewFloor(s: string | null): number | null {
  if (!s) return null;
  const n = toInt(s);
  if (n !== null) return n;
  const first = s.split(/[\s,]/)[0];
  return HEB_FLOORS[first] ?? null;
}

/** מפתח לזיהוי כפילויות בין מקורות שונים (אותה עסקה שהגיעה פעמיים) */
export function crossSourceKey(r: NormalizedRecord): string | null {
  const price = r.transactionPriceIls ?? r.askingPriceIls;
  const date = r.transactionDate ?? r.listingDate;
  if (!r.street || !price || !date) return null;
  return [r.recordType, r.city, r.street, r.houseNumber ?? "", r.areaSqm ?? "", price, date.toISOString().slice(0, 10)].join("|");
}
