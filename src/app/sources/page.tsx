import { prisma } from "@/lib/db";
import { getConnectors } from "@/lib/connectors/registry";
import { getCurrentContext } from "@/lib/services/context";
import { getSourceToggles } from "@/lib/services/source-toggles";
import { SOURCE_LABELS } from "@/lib/connectors/connectors";
import { CsvUpload, DemoControls, ManualRecordForm, SourceToggle } from "@/components/SourceTools";
import { PageHeader, StatusBadge } from "@/components/ui";
import { listCities } from "@/lib/services/queries";
import { formatDateTime, formatNum } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function SourcesPage() {
  const { accountId: ctxAccountId } = await getCurrentContext();
  const connectors = getConnectors(await getSourceToggles(ctxAccountId)).map((c) => c.info());
  const [counts, runs, cities, demoCount] = await Promise.all([
    prisma.propertyRecord.groupBy({ by: ["sourceName", "recordType"], _count: true, _max: { fetchedAt: true } }),
    prisma.connectorRun.findMany({ orderBy: { startedAt: "desc" }, take: 15 }),
    listCities(),
    prisma.propertyRecord.count({ where: { isDemo: true } }),
  ]);
  const countFor = (id: string) => counts.filter((c) => c.sourceName === id).reduce((s, c) => s + c._count, 0);
  const lastFor = (id: string) =>
    counts
      .filter((c) => c.sourceName === id)
      .map((c) => c._max.fetchedAt)
      .sort((a, b) => (b?.getTime() ?? 0) - (a?.getTime() ?? 0))[0];

  return (
    <>
      <PageHeader title="מקורות מידע" subtitle="כל מקור הוא מחבר נפרד. כשל של מקור אחד לא עוצר את המערכת." />
      <div className="grid gap-4 lg:grid-cols-2" data-testid="connectors">
        {connectors.map((c) => (
          <section key={c.id} className="card">
            <div className="mb-2 flex items-start justify-between gap-2">
              <h2 className="font-semibold">{c.name}</h2>
              <StatusBadge status={c.status} />
            </div>
            <p className="text-sm text-slate-600">{c.description}</p>
            <p className="mt-2 text-sm">
              <span className="text-slate-500">מצב: </span>
              {c.statusMessage}
            </p>
            <p className="mt-1 text-sm">
              <span className="text-slate-500">רשומות במאגר: </span>
              {formatNum(countFor(c.id))}
              {lastFor(c.id) && <span className="text-slate-500"> · עודכן {formatDateTime(lastFor(c.id))}</span>}
            </p>
            {c.requirements.length > 0 && (
              <div className="mt-2 text-sm">
                <div className="text-slate-500">נדרש לחיבור:</div>
                <ul className="list-disc pr-5">
                  {c.requirements.map((r) => (
                    <li key={r}>{r}</li>
                  ))}
                </ul>
              </div>
            )}
            <p className="mt-2 text-xs text-slate-500">{c.termsNote}</p>
            {c.officialUrl && (
              <a href={c.officialUrl} target="_blank" rel="noreferrer" className="mt-1 inline-block text-xs text-brand-600 underline">
                אתר המקור
              </a>
            )}
            {c.id === "govmap" && (
              <div className="mt-3">
                <SourceToggle id="govmap" enabled={c.status === "connected"} />
              </div>
            )}
            {c.id === "demo" && (
              <div className="mt-3">
                <DemoControls count={demoCount} />
              </div>
            )}
          </section>
        ))}
      </div>

      <section className="card mt-6">
        <h2 className="card-title">העלאת קובץ נתונים</h2>
        <p className="mb-3 text-sm text-slate-600">
          עמודות נתמכות מפורטות בקובץ הדוגמה ובתיעוד (docs/DATA_IMPORT.md). כפילויות מזוהות לפי מזהה הרשומה. שורות לא תקינות נדחות ולא ״מתוקנות״.
        </p>
        <CsvUpload cities={cities} />
      </section>

      <section className="card mt-6">
        <h2 className="card-title">הוספת עסקה או מודעה ידנית</h2>
        <ManualRecordForm />
      </section>

      <section className="card mt-6 overflow-x-auto">
        <h2 className="card-title">יומן שליפות אחרונות</h2>
        <table className="table">
          <thead>
            <tr>
              <th>מועד</th>
              <th>מקור</th>
              <th>סטטוס</th>
              <th>נשלפו</th>
              <th>חדשות</th>
              <th>הודעה</th>
            </tr>
          </thead>
          <tbody>
            {runs.map((r) => (
              <tr key={r.id}>
                <td className="whitespace-nowrap">{formatDateTime(r.startedAt)}</td>
                <td>{SOURCE_LABELS[r.connectorId] ?? r.connectorId}</td>
                <td>
                  <StatusBadge status={r.status} />
                </td>
                <td>{r.recordsFetched}</td>
                <td>{r.recordsNew}</td>
                <td className="text-xs text-slate-600">{r.message}</td>
              </tr>
            ))}
            {runs.length === 0 && (
              <tr>
                <td colSpan={6} className="text-center text-slate-500">
                  אין עדיין שליפות
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </section>
    </>
  );
}
