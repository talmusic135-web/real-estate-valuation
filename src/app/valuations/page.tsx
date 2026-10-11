import Link from "next/link";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { getCurrentContext } from "@/lib/services/context";
import { ConfidenceBadge, Empty, PageHeader, StatusBadge } from "@/components/ui";
import { CompareSelector } from "@/components/CompareSelector";
import { formatDateTime, formatIls } from "@/lib/format";
import type { ValuationResult } from "@/lib/valuation/types";

export const dynamic = "force-dynamic";

export default async function HistoryPage({ searchParams }: { searchParams: Promise<{ q?: string; status?: string }> }) {
  const { q, status } = await searchParams;
  const { accountId } = await getCurrentContext();
  const where: Prisma.ValuationWhereInput = { accountId };
  if (q) where.title = { contains: q, mode: "insensitive" };
  if (status && ["draft", "completed", "insufficient_data"].includes(status)) where.status = status as Prisma.EnumValuationStatusFilter["equals"];
  const rows = await prisma.valuation.findMany({ where, orderBy: { createdAt: "desc" }, take: 200 });

  return (
    <>
      <PageHeader
        title="היסטוריית הערכות"
        subtitle="כל ההערכות נשמרות עם הנתונים שהוזנו, העסקאות שנבחרו וגרסת האלגוריתם"
        actions={
          <Link href="/valuations/new" className="btn-primary">
            + הערכה חדשה
          </Link>
        }
      />
      <form className="card mb-4 flex flex-wrap items-end gap-3">
        <div className="min-w-[220px] flex-1">
          <label className="label">חיפוש לפי שם / כתובת</label>
          <input className="input" name="q" defaultValue={q} />
        </div>
        <div>
          <label className="label">סטטוס</label>
          <select className="input" name="status" defaultValue={status ?? ""}>
            <option value="">הכל</option>
            <option value="completed">הושלמה</option>
            <option value="draft">טיוטה</option>
            <option value="insufficient_data">חסרים נתונים</option>
          </select>
        </div>
        <button className="btn-secondary">סינון</button>
      </form>
      {rows.length === 0 ? (
        <Empty>לא נמצאו הערכות</Empty>
      ) : (
        <CompareSelector>
          <div className="card overflow-x-auto">
            <table className="table" data-testid="history-table">
              <thead>
                <tr>
                  <th>השוואה</th>
                  <th>הערכה</th>
                  <th>אומדן</th>
                  <th>טווח</th>
                  <th>אמינות</th>
                  <th>עסקאות</th>
                  <th>סטטוס</th>
                  <th>נוצרה</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((v) => {
                  const r = v.result as unknown as ValuationResult | null;
                  return (
                    <tr key={v.id}>
                      <td>
                        <input type="checkbox" name="compare" value={v.id} aria-label="בחירה להשוואה" />
                      </td>
                      <td>
                        <Link href={`/valuations/${v.id}`} className="font-medium text-brand-700 hover:underline">
                          {v.title}
                        </Link>
                        {v.parentId && <div className="text-xs text-slate-500">גרסה של הערכה קודמת</div>}
                      </td>
                      <td className="whitespace-nowrap">{formatIls(r?.estimateIls)}</td>
                      <td className="whitespace-nowrap text-xs">{r?.rangeLowIls ? `${formatIls(r.rangeLowIls)} – ${formatIls(r.rangeHighIls)}` : "—"}</td>
                      <td>{r ? <ConfidenceBadge level={r.confidence.level} /> : "—"}</td>
                      <td>{r?.counts.transactionsUsed ?? "—"}</td>
                      <td>
                        <StatusBadge status={v.status} />
                      </td>
                      <td className="whitespace-nowrap text-slate-500">{formatDateTime(v.createdAt)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </CompareSelector>
      )}
    </>
  );
}
