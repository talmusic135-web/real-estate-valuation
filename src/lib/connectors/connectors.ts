import type { NormalizedRecord } from "@/lib/domain/record";
import { normalizeFlat, normalizeGovIl, validateRecord } from "./normalize";
import { TokenBucket } from "./rate-limit";
import { NotConfiguredError, RateLimitedError, type ConnectorInfo, type DataConnector, type SearchQuery } from "./types";

const env = (k: string) => process.env[k]?.trim() || "";

// ---------------------------------------------------------------------------
// 1. נתוני הדגמה (סינתטיים)
// ---------------------------------------------------------------------------
export class DemoConnector implements DataConnector {
  readonly id = "demo";
  info(): ConnectorInfo {
    const enabled = env("DEMO_DATA_ENABLED") !== "false";
    return {
      id: this.id,
      name: "נתוני הדגמה (סינתטיים)",
      description: "עסקאות ומודעות שנוצרו באופן סינתטי כדי לבדוק את המערכת. אינן עסקאות אמיתיות.",
      kind: "demo",
      recordTypes: ["completed_transaction", "active_listing"],
      status: enabled ? "connected" : "disabled",
      statusMessage: enabled ? "פעיל – כל תוצאה מסומנת כ״הדגמה״" : "כבוי (DEMO_DATA_ENABLED=false)",
      requirements: [],
      termsNote: "נתונים פנימיים, ללא מגבלת שימוש. אין להציג ללקוח כנתוני שוק.",
      storedLocally: true,
    };
  }
  async search(): Promise<NormalizedRecord[]> {
    return [];
  }
}

// ---------------------------------------------------------------------------
// 2. מאגר עסקאות הנדל"ן הממשלתי
// ---------------------------------------------------------------------------
export class GovIlTransactionsConnector implements DataConnector {
  readonly id = "govil_nadlan";
  private bucket = new TokenBucket(5, 0.5); // עד 5 בקשות ברצף, ואז אחת לשתי שניות

  private configured() {
    return env("GOVIL_NADLAN_ENABLED") === "true" && env("GOVIL_NADLAN_API_URL") !== "";
  }

  info(): ConnectorInfo {
    return {
      id: this.id,
      name: "מאגר עסקאות הנדל״ן הממשלתי (רשות המסים)",
      description:
        "עסקאות מכירה שדווחו לרשות המסים ומוצגות באתר מידע הנדל״ן הממשלתי. המקור המועדף לעסקאות שבוצעו בפועל.",
      kind: "official_transactions",
      recordTypes: ["completed_transaction"],
      status: this.configured() ? "connected" : "not_configured",
      statusMessage: this.configured()
        ? "מוגדר"
        : "לא מחובר. לא נמצא ממשק API ציבורי ומתועד; נדרש ערוץ גישה מאושר (שלב 2). בינתיים אפשר להעלות קובץ עסקאות שיוצא מהאתר.",
      requirements: [
        "בדיקה מול רשות המסים / data.gov.il לגבי ממשק רשמי או קובץ נתונים פתוח",
        "GOVIL_NADLAN_ENABLED=true",
        "GOVIL_NADLAN_API_URL – כתובת ממשק מאושר",
      ],
      termsNote:
        "יש לפעול לפי תנאי השימוש של האתר הממשלתי. המערכת לא עוקפת CAPTCHA, הגבלות גישה או אמצעי הגנה.",
      officialUrl: "https://www.nadlan.gov.il/",
      storedLocally: false,
    };
  }

  async search(q: SearchQuery, signal?: AbortSignal): Promise<NormalizedRecord[]> {
    if (!this.configured()) throw new NotConfiguredError("המאגר הממשלתי לא מחובר");
    if (!this.bucket.tryTake()) throw new RateLimitedError();
    const url = new URL(env("GOVIL_NADLAN_API_URL"));
    url.searchParams.set("city", q.city);
    if (q.street) url.searchParams.set("street", q.street);
    if (q.neighborhood) url.searchParams.set("neighborhood", q.neighborhood);
    url.searchParams.set("since", q.since.toISOString().slice(0, 10));
    const res = await fetch(url, { signal, headers: { Accept: "application/json" } });
    if (!res.ok) throw new Error(`המאגר הממשלתי החזיר שגיאה ${res.status}`);
    const body = (await res.json()) as { AllResults?: Record<string, unknown>[] } | Record<string, unknown>[];
    const rows = Array.isArray(body) ? body : (body.AllResults ?? []);
    return rows.map((r) => normalizeGovIl(r, q.city)).filter((r) => validateRecord(r).length === 0);
  }
}

// ---------------------------------------------------------------------------
// 3. ספק מודעות מורשה (למשל ספק נתונים בהסכם עם אתר מודעות)
// ---------------------------------------------------------------------------
export class LicensedListingsConnector implements DataConnector {
  readonly id = "licensed_listings";
  private bucket = new TokenBucket(10, 1);

  private configured() {
    return env("LISTINGS_PROVIDER_URL") !== "" && env("LISTINGS_PROVIDER_API_KEY") !== "";
  }

  info(): ConnectorInfo {
    return {
      id: this.id,
      name: "מודעות נדל״ן – ספק נתונים מורשה",
      description:
        "מודעות פעילות מאתרי מודעות (כגון יד2) דרך API מורשה או ספק נתונים בהסכם. משמש לניתוח מתחרים בלבד, לא לאומדן השווי.",
      kind: "listings",
      recordTypes: ["active_listing", "historical_listing"],
      status: this.configured() ? "connected" : "not_configured",
      statusMessage: this.configured()
        ? "מוגדר"
        : "לא מחובר. לאתרי המודעות אין API ציבורי פתוח; נדרש הסכם עם האתר או עם ספק נתונים מורשה.",
      requirements: [
        "הסכם שימוש בנתונים עם אתר המודעות או ספק מורשה",
        "LISTINGS_PROVIDER_URL – כתובת ה-API של הספק",
        "LISTINGS_PROVIDER_API_KEY – מפתח גישה (בשרת בלבד)",
      ],
      termsNote: "אין גריפה (scraping) של אתרי מודעות בניגוד לתנאי השימוש. חלופה: העלאת קובץ או הזנה ידנית.",
      storedLocally: false,
    };
  }

  async search(q: SearchQuery, signal?: AbortSignal): Promise<NormalizedRecord[]> {
    if (!this.configured()) throw new NotConfiguredError("ספק המודעות לא מחובר");
    if (!this.bucket.tryTake()) throw new RateLimitedError();
    const url = new URL(env("LISTINGS_PROVIDER_URL"));
    url.searchParams.set("city", q.city);
    if (q.neighborhood) url.searchParams.set("neighborhood", q.neighborhood);
    const res = await fetch(url, {
      signal,
      headers: { Accept: "application/json", Authorization: `Bearer ${env("LISTINGS_PROVIDER_API_KEY")}` },
    });
    if (!res.ok) throw new Error(`ספק המודעות החזיר שגיאה ${res.status}`);
    const rows = (await res.json()) as Record<string, unknown>[];
    return rows
      .map((r) => normalizeFlat(r, "licensed_listings", { recordType: "active_listing" }))
      .filter((r) => validateRecord(r).length === 0);
  }
}

// ---------------------------------------------------------------------------
// 4. העלאת קובץ (CSV) על ידי המשתמש
// ---------------------------------------------------------------------------
export class CsvUploadConnector implements DataConnector {
  readonly id = "csv_upload";
  info(): ConnectorInfo {
    return {
      id: this.id,
      name: "העלאת קובץ נתונים (CSV)",
      description:
        "ייבוא עסקאות או מודעות מקובץ: במבנה השדות האחיד של המערכת, או בפורמט הייצוא של אתר מידע הנדל״ן הממשלתי.",
      kind: "upload",
      recordTypes: ["completed_transaction", "active_listing", "historical_listing"],
      status: "connected",
      statusMessage: "זמין – מסך מקורות מידע ← העלאת קובץ",
      requirements: [],
      termsNote: "באחריות המעלה לוודא שיש לו זכות להשתמש בנתונים.",
      storedLocally: true,
    };
  }
  async search(): Promise<NormalizedRecord[]> {
    return [];
  }
}

// ---------------------------------------------------------------------------
// 5. הזנה ידנית על ידי המתווך
// ---------------------------------------------------------------------------
export class ManualEntryConnector implements DataConnector {
  readonly id = "manual";
  info(): ConnectorInfo {
    return {
      id: this.id,
      name: "הזנה ידנית של המתווך",
      description: "עסקאות שהמתווך מכיר מניסיונו (למשל עסקה שתיווך בעצמו) או מודעות שאיתר.",
      kind: "manual",
      recordTypes: ["completed_transaction", "active_listing"],
      status: "connected",
      statusMessage: "זמין – מסך מקורות מידע ← הוספת רשומה",
      requirements: [],
      termsNote: "מסומן כמקור ״הזנה ידנית״ בכל דוח.",
      storedLocally: true,
    };
  }
  async search(): Promise<NormalizedRecord[]> {
    return [];
  }
}

export const SOURCE_LABELS: Record<string, string> = {
  demo: "הדגמה",
  govil_nadlan: "מאגר ממשלתי",
  licensed_listings: "ספק מודעות",
  csv_upload: "קובץ שהועלה",
  manual: "הזנה ידנית",
};
