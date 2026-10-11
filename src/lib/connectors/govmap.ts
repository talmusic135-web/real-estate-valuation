import type { NormalizedRecord } from "@/lib/domain/record";
import { EMPTY_RECORD_FIELDS } from "@/lib/domain/record";
import { normalizeName } from "@/lib/geo";
import { parseHebrewFloor, toDate, toInt, toNum, toPropertyType, toStr, validateRecord } from "./normalize";
import { TokenBucket } from "./rate-limit";
import { NotConfiguredError, RateLimitedError, type ConnectorInfo, type DataConnector, type SearchQuery } from "./types";

/**
 * עסקאות נדל"ן שדווחו לרשות המסים, כפי שהן מוצגות במפה הממשלתית GovMap.
 *
 * חשוב: אלה נקודות הקצה הציבוריות שהאתר עצמו משתמש בהן, ולא API רשמי ומתועד.
 * לכן המחבר כבוי כברירת מחדל (GOVMAP_ENABLED=true), שולח מעט בקשות בקצב איטי,
 * מזדהה בבירור, ואינו עוקף CAPTCHA, הרשאות או חסימות. אם השירות חוסם או משתנה –
 * המחבר נכשל בשקט והמערכת ממשיכה עם שאר המקורות.
 */

const DEFAULT_BASE = "https://www.govmap.gov.il/api";
const env = (k: string) => process.env[k]?.trim() || "";

// ---------------------------------------------------------------------------
// המרת קואורדינטות: GovMap מחזיר Web Mercator (EPSG:3857)
// ---------------------------------------------------------------------------
const R = 6378137;
export function mercatorToWgs84(x: number, y: number): { lat: number; lng: number } {
  const lng = (x / R) * (180 / Math.PI);
  const lat = (2 * Math.atan(Math.exp(y / R)) - Math.PI / 2) * (180 / Math.PI);
  return { lat, lng };
}
export function wgs84ToMercator(lat: number, lng: number): { x: number; y: number } {
  const x = (lng * Math.PI * R) / 180;
  const y = R * Math.log(Math.tan(Math.PI / 4 + (lat * Math.PI) / 360));
  return { x, y };
}

/** מרכז גס של צורת WKT (POINT / POLYGON / MULTIPOLYGON): ממוצע הקודקודים */
export function wktCentroid(wkt: string | null | undefined): { x: number; y: number } | null {
  if (!wkt) return null;
  const nums = wkt.match(/-?\d+(?:\.\d+)?/g)?.map(Number) ?? [];
  if (nums.length < 2) return null;
  let sx = 0;
  let sy = 0;
  let n = 0;
  for (let i = 0; i + 1 < nums.length; i += 2) {
    sx += nums[i];
    sy += nums[i + 1];
    n++;
  }
  return { x: sx / n, y: sy / n };
}

// ---------------------------------------------------------------------------
// נרמול עסקה
// ---------------------------------------------------------------------------
const RESIDENTIAL = /דיר|דופלקס|פנטהאוז|גג|גן|קוטג|בית|וילה|טריפלקס|מגורים/;
const NON_RESIDENTIAL = /חנות|משרד|מחסן|חניה|מסחר|תעשי|קרקע|מגרש|בנין|בניין/;

/** השדות מגיעים לפעמים ב-camelCase ולפעמים ב-snake_case; לוקחים את הראשון שקיים */
function pick(row: Record<string, unknown>, ...keys: string[]): unknown {
  for (const k of keys) if (row[k] !== undefined && row[k] !== null && row[k] !== "") return row[k];
  return null;
}

export function normalizeGovmapDeal(row: Record<string, unknown>, fallbackCity: string): NormalizedRecord | null {
  const nature = toStr(pick(row, "dealNatureDescription", "deal_nature_description"));
  const typeDesc = toStr(pick(row, "propertyTypeDescription", "property_type_description"));
  const kind = nature ?? typeDesc ?? "";
  // רק נכסי מגורים; חנויות, חניות, מגרשים וכו׳ לא נכנסים להשוואה
  if (kind && NON_RESIDENTIAL.test(kind) && !RESIDENTIAL.test(kind)) return null;

  const id = toStr(pick(row, "dealId", "deal_id", "objectid"));
  const price = toInt(pick(row, "dealAmount", "deal_amount"));
  const date = toDate(pick(row, "dealDate", "deal_date"));
  if (!id || !price || !date) return null;

  const street = toStr(pick(row, "streetNameHeb", "streetName", "street_name"));
  const house = toStr(pick(row, "houseNum", "houseNumber", "house_number"));
  // שם העיר כפי שהמשתמש בחר, כשזו אותה עיר בכתיב אחר ("תל אביב -יפו" / "תל אביב-יפו")
  const govCity = toStr(pick(row, "settlementNameHeb", "settlement_name_heb"));
  const city = !govCity || normalizeName(govCity) === normalizeName(fallbackCity) ? fallbackCity : govCity;
  const c = wktCentroid(toStr(row.shape));
  const pt = c ? mercatorToWgs84(c.x, c.y) : null;
  const floorRaw = pick(row, "floorNo", "floorNumber", "floor_number", "floor");

  return {
    ...EMPTY_RECORD_FIELDS,
    sourceName: "govmap",
    sourceUrl: "https://www.govmap.gov.il/?lay=nadlan",
    sourceRecordId: id,
    recordType: "completed_transaction",
    isDemo: false,
    transactionDate: date,
    city,
    neighborhood: toStr(row.neighborhood),
    street,
    houseNumber: house,
    address: street ? [street, house].filter(Boolean).join(" ") + `, ${city}` : null,
    block: toStr(pick(row, "gushNum", "gush")),
    parcel: toStr(pick(row, "parcelNum", "parcel")),
    // נקודת המפה היא מרכז החלקה/הבניין ולא הדירה עצמה
    latitude: pt && pt.lat > 29 && pt.lat < 34 ? pt.lat : null,
    longitude: pt && pt.lng > 34 && pt.lng < 36 ? pt.lng : null,
    propertyType: kind ? toPropertyType(kind) : null,
    rooms: toNum(pick(row, "assetRoomNum", "rooms")),
    areaSqm: toNum(pick(row, "assetArea", "asset_area")),
    floor: typeof floorRaw === "number" ? floorRaw : parseHebrewFloor(toStr(floorRaw)),
    transactionPriceIls: price,
    dataConfidence: 0.9,
    lastVerifiedAt: new Date(),
    rawData: { ...row, shape: undefined },
  };
}

// ---------------------------------------------------------------------------
// המחבר
// ---------------------------------------------------------------------------
type Fetcher = typeof fetch;

export class GovmapTransactionsConnector implements DataConnector {
  readonly id = "govmap";
  // עד 4 בקשות ברצף ואז בקשה בשנייה: שליפה אחת להערכה, לא סריקה
  private bucket = new TokenBucket(4, 1);
  constructor(
    private fetcher: Fetcher = fetch,
    /** הפעלה ממסך מקורות המידע (נשמר בהגדרות החשבון) */
    private enabledByAccount = false,
  ) {}

  private enabled() {
    return this.enabledByAccount || env("GOVMAP_ENABLED") === "true";
  }
  private base() {
    return (env("GOVMAP_API_URL") || DEFAULT_BASE).replace(/\/$/, "");
  }

  info(): ConnectorInfo {
    const on = this.enabled();
    return {
      id: this.id,
      name: "עסקאות נדל״ן – רשות המסים דרך GovMap",
      description:
        "עסקאות מכירה אמיתיות שדווחו לרשות המסים, כפי שהן מוצגות במפה הממשלתית GovMap. נשלפות בזמן ההערכה לפי כתובת הנכס, ונשמרות במסד.",
      kind: "official_transactions",
      recordTypes: ["completed_transaction"],
      status: on ? "connected" : "disabled",
      statusMessage: on
        ? "פעיל – שליפה לפי כתובת בכל הרצת הערכה"
        : "כבוי. אפשר להפעיל כאן בלחיצה, אחרי שבדקתם את תנאי השימוש של GovMap.",
      requirements: on ? [] : ["אישור שהשימוש תואם את תנאי השימוש של GovMap"],
      termsNote:
        "הנתונים ציבוריים, אבל נקודות הקצה אינן API רשמי ומתועד. המערכת שולחת מעט בקשות בקצב איטי ולא עוקפת חסימות. אם GovMap יחסום או ישנה את הממשק – המקור ייכשל והמערכת תמשיך עם שאר המקורות.",
      officialUrl: "https://www.govmap.gov.il/?lay=nadlan",
      storedLocally: false,
    };
  }

  private async call<T>(path: string, init: RequestInit & { signal?: AbortSignal }): Promise<T> {
    if (!this.bucket.tryTake()) throw new RateLimitedError();
    let res: Response;
    try {
      res = await this.fetcher(`${this.base()}${path}`, {
        ...init,
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
          "User-Agent": "ErechPlus/0.2 (real-estate valuation for brokers)",
          ...(init.headers ?? {}),
        },
      });
    } catch (err) {
      if (init.signal?.aborted) throw err;
      throw new Error("לא הצלחנו להתחבר ל-GovMap (השרת לא זמין או חוסם את הגישה)");
    }
    if (res.status === 403 || res.status === 429) throw new Error(`GovMap סירב לבקשה (${res.status}). לא מנסים לעקוף.`);
    if (!res.ok) throw new Error(`GovMap החזיר שגיאה ${res.status}`);
    return (await res.json()) as T;
  }

  /** נקודת הנכס ב-Web Mercator: מהמפה אם סומנה, אחרת מחיפוש הכתובת ב-GovMap */
  private async locate(q: SearchQuery, signal?: AbortSignal): Promise<{ x: number; y: number } | null> {
    if (q.latitude != null && q.longitude != null) return wgs84ToMercator(q.latitude, q.longitude);
    const text = [q.street, q.houseNumber, q.city].filter(Boolean).join(" ") || [q.neighborhood, q.city].filter(Boolean).join(" ");
    const body = await this.call<{ results?: { shape?: string }[] }>("/search-service/autocomplete", {
      method: "POST",
      body: JSON.stringify({ searchText: text, language: "he", isAccurate: false, maxResults: 5 }),
      signal,
    });
    for (const r of body.results ?? []) {
      const c = wktCentroid(r.shape);
      if (c) return c;
    }
    return null;
  }

  async search(q: SearchQuery, signal?: AbortSignal): Promise<NormalizedRecord[]> {
    if (!this.enabled()) throw new NotConfiguredError("GovMap כבוי");
    if (!q.recordTypes.includes("completed_transaction")) return [];
    const pt = await this.locate(q, signal);
    if (!pt) throw new Error("GovMap לא מצא את הכתובת");

    // פוליגונים (גושים/רחובות) עם עסקאות סביב הנקודה
    const polys = await this.call<{ polygon_id?: string; dealscount?: string | number }[]>(
      `/real-estate/deals/${pt.x},${pt.y}/500`,
      { method: "GET", signal },
    );
    const ids = [...new Set((Array.isArray(polys) ? polys : []).map((p) => p.polygon_id).filter((x): x is string => !!x))];
    if (!ids.length) return [];

    // עסקאות השכונה כוללות את הרחוב ואת הבניין; שתי קריאות לכל היותר כדי לשמור על קצב נמוך
    const startDate = q.since.toISOString().slice(0, 7);
    const endDate = new Date().toISOString().slice(0, 7);
    const out = new Map<string, NormalizedRecord>();
    for (const pid of ids.slice(0, 2)) {
      const params = new URLSearchParams({ limit: "500", dealType: "2", startDate, endDate });
      const deals = await this.call<Record<string, unknown>[] | { data?: Record<string, unknown>[] }>(
        `/real-estate/neighborhood-deals/${encodeURIComponent(pid)}?${params}`,
        { method: "GET", signal },
      );
      const rows = Array.isArray(deals) ? deals : (deals.data ?? []);
      for (const row of rows) {
        const rec = normalizeGovmapDeal(row, q.city);
        if (rec && validateRecord(rec).length === 0 && rec.transactionDate! >= q.since) out.set(rec.sourceRecordId, rec);
      }
    }
    return [...out.values()];
  }
}
