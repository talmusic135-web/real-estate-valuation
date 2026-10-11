import type { NormalizedRecord, RecordType } from "@/lib/domain/record";

export type ConnectorStatus = "connected" | "not_configured" | "disabled" | "error";

export type ConnectorKind = "official_transactions" | "listings" | "upload" | "manual" | "demo";

export interface ConnectorInfo {
  id: string;
  name: string;
  description: string;
  kind: ConnectorKind;
  recordTypes: RecordType[];
  status: ConnectorStatus;
  statusMessage: string;
  /** מה נדרש כדי לחבר את המקור (משתני סביבה, אישורים, הסכמים) */
  requirements: string[];
  /** הערה על תנאי שימוש / רישוי */
  termsNote: string;
  officialUrl?: string;
  /** נתוני המקור כבר שמורים במסד (העלאה, הזנה ידנית, הדגמה) */
  storedLocally: boolean;
}

export interface SearchQuery {
  city: string;
  neighborhood?: string;
  street?: string;
  houseNumber?: string;
  /** נקודת הנכס אם המשתמש סימן במפה (WGS84) */
  latitude?: number;
  longitude?: number;
  recordTypes: RecordType[];
  since: Date;
}

export interface DataConnector {
  readonly id: string;
  info(): ConnectorInfo;
  /**
   * שליפה מהמקור החיצוני והמרה למבנה האחיד.
   * מקורות מקומיים מחזירים [] (הנתונים כבר במסד).
   * חייב לזרוק NotConfiguredError אם המקור לא מוגדר.
   */
  search(query: SearchQuery, signal?: AbortSignal): Promise<NormalizedRecord[]>;
}

export class NotConfiguredError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "NotConfiguredError";
  }
}

export class RateLimitedError extends Error {
  constructor(message = "חרגנו ממגבלת קצב הבקשות למקור") {
    super(message);
    this.name = "RateLimitedError";
  }
}

export interface ConnectorRunResult {
  connectorId: string;
  name: string;
  status: "success" | "skipped" | "error";
  records: NormalizedRecord[];
  message: string | null;
  durationMs: number;
}
