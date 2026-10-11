import Link from "next/link";
import { prisma } from "@/lib/db";
import { getConnectors } from "@/lib/connectors/registry";
import { getCurrentContext } from "@/lib/services/context";
import { demoEnabled } from "@/lib/services/records";
import { Empty, PageHeader, Stat, StatusBadge, ConfidenceBadge } from "@/components/ui";
import { formatDateTime, formatIls, formatNum } from "@/lib/format";
import type { ValuationResult } from "@/lib/valuation/types";

export const dynamic = "force-dynamic";

export default async function Dashboard() {
  const { accountId } = await getCurrentContext();
  const demo = demoEnabled() ? {} : { isDemo: false };
  const [valCount, recent, txCount, lsCount, realCount, lastRun] = await Promise.all([
    prisma.valuation.count({ where: { accountId } }),
    prisma.valuation.findMany({ where: { accountId }, orderBy: { updatedAt: "desc" }, take: 6 }),
    prisma.propertyRecord.count({ where: { recordType: "completed_transaction", ...demo } }),
    prisma.propertyRecord.count({ where: { recordType: "active_listing", ...demo } }),
    prisma.propertyRecord.count({ where: { isDemo: false } }),
    prisma.connectorRun.findFirst({ orderBy: { startedAt: "desc" } }),
  ]);
  const connectors = getConnectors().map((c) => c.info());

  return (
    <>
      <PageHeader
        title="לוח בקרה"
        subtitle="סקירה של ההערכות, הנתונים ומקורות המידע"
        actions={
          <Link href="/valuations/new" className="btn-primary">
            + הערכת שווי חדשה
          </Link>
        }
      />
      <div className="grid gap-4 md:grid-cols-4">
        <Stat label="הערכות שמורות" value={formatNum(valCount)} />
        <Stat label="עסקאות במאגר" value={formatNum(txCount)} hint={realCount === 0 ? "כולן נתוני הדגמה" : `${formatNum(realCount)} ממקורות אמיתיים`} />
        <Stat label="מודעות פעילות במאגר" value={formatNum(lsCount)} />
        <Stat label="עדכון נתונים אחרון" value={<span className="text-lg">{formatDateTime(lastRun?.startedAt)}</span>} />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <section className="card lg:col-span-2">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="card-title !mb-0">הערכות אחרונות</h2>
            <Link href="/valuations" className="text-sm text-brand-600 underline">
              לכל ההערכות
            </Link>
          </div>
          {recent.length === 0 ? (
            <Empty>
              עדיין אין הערכות.{" "}
              <Link href="/valuations/new" className="text-brand-600 underline">
                צרו את הראשונה
              </Link>
            </Empty>
          ) : (
            <table className="table">
              <thead>
                <tr>
                  <th>הערכה</th>
                  <th>אומדן</th>
                  <th>אמינות</th>
                  <th>סטטוס</th>
                  <th>עודכן</th>
                </tr>
              </thead>
              <tbody>
                {recent.map((v) => {
                  const r = v.result as unknown as ValuationResult | null;
                  return (
                    <tr key={v.id}>
                      <td>
                        <Link href={`/valuations/${v.id}`} className="font-medium text-brand-700 hover:underline">
                          {v.title}
                        </Link>
                      </td>
                      <td className="whitespace-nowrap">{formatIls(r?.estimateIls)}</td>
                      <td>{r ? <ConfidenceBadge level={r.confidence.level} /> : "—"}</td>
                      <td>
                        <StatusBadge status={v.status} />
                      </td>
                      <td className="whitespace-nowrap text-slate-500">{formatDateTime(v.updatedAt)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </section>
        <section className="card">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="card-title !mb-0">מקורות מידע</h2>
            <Link href="/sources" className="text-sm text-brand-600 underline">
              ניהול
            </Link>
          </div>
          <ul className="space-y-3 text-sm">
            {connectors.map((c) => (
              <li key={c.id} className="flex items-start justify-between gap-2">
                <span>{c.name}</span>
                <StatusBadge status={c.status} />
              </li>
            ))}
          </ul>
        </section>
      </div>
    </>
  );
}
