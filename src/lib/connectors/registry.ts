import {
  CsvUploadConnector,
  DemoConnector,
  GovIlTransactionsConnector,
  LicensedListingsConnector,
  ManualEntryConnector,
} from "./connectors";
import { NotConfiguredError, type ConnectorRunResult, type DataConnector, type SearchQuery } from "./types";

/**
 * רישום המחברים. כדי להוסיף מקור חדש: לממש DataConnector ולהוסיף כאן.
 * לוגיקת ההערכה לא משתנה.
 */
export function getConnectors(): DataConnector[] {
  return [
    new GovIlTransactionsConnector(),
    new LicensedListingsConnector(),
    new CsvUploadConnector(),
    new ManualEntryConnector(),
    new DemoConnector(),
  ];
}

const DEFAULT_TIMEOUT_MS = 15_000;

/**
 * מריץ את כל המחברים במקביל. כשל של מקור אחד לא מפיל את החיפוש:
 * כל מקור מחזיר סטטוס משלו, והמערכת ממשיכה עם המקורות שעבדו.
 */
export async function runConnectors(
  query: SearchQuery,
  connectors: DataConnector[] = getConnectors(),
  timeoutMs = DEFAULT_TIMEOUT_MS,
): Promise<ConnectorRunResult[]> {
  return Promise.all(
    connectors.map(async (c): Promise<ConnectorRunResult> => {
      const info = c.info();
      const start = Date.now();
      if (info.status === "disabled") {
        return { connectorId: c.id, name: info.name, status: "skipped", records: [], message: info.statusMessage, durationMs: 0 };
      }
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);
      try {
        const records = await Promise.race([
          c.search(query, controller.signal),
          new Promise<never>((_, rej) =>
            controller.signal.addEventListener("abort", () => rej(new Error(`המקור לא הגיב תוך ${timeoutMs / 1000} שניות`))),
          ),
        ]);
        return { connectorId: c.id, name: info.name, status: "success", records, message: null, durationMs: Date.now() - start };
      } catch (err) {
        const notConfigured = err instanceof NotConfiguredError;
        if (!notConfigured) console.error(`[connector:${c.id}]`, err);
        return {
          connectorId: c.id,
          name: info.name,
          status: notConfigured ? "skipped" : "error",
          records: [],
          message: err instanceof Error ? err.message : String(err),
          durationMs: Date.now() - start,
        };
      } finally {
        clearTimeout(timer);
      }
    }),
  );
}
