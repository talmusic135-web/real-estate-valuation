import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { FilterBar } from "@/components/FilterBar";
import { LazyMap } from "@/components/LazyMap";
import { MapLegend } from "@/components/MapView";
import { Empty, PageHeader, SourceBadge, Stat } from "@/components/ui";
import { buildWhere, listCities, listNeighborhoods, parseFilters } from "@/lib/services/queries";
import { formatDate, formatIls, formatNum } from "@/lib/format";
import { median } from "@/lib/stats";

export const dynamic = "force-dynamic";

const SORTS: Record<string, Prisma.PropertyRecordOrderByWithRelationInput> = {
  recent: { transactionDate: "desc" },
  price_desc: { transactionPriceIls: "desc" },
  price_asc: { transactionPriceIls: "asc" },
  area: { areaSqm: "desc" },
};

export default async function TransactionsPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  const f = parseFilters(sp);
  if (f.months === undefined) f.months = 24;
  const sort = sp.sort && sp.sort in SORTS ? sp.sort : sp.sort === "ppsqm" ? "ppsqm" : "recent";
  const cities = await listCities();
  const neighborhoods = f.city ? await listNeighborhoods(f.city) : [];
  let rows = f.city
    ? await prisma.propertyRecord.findMany({ where: buildWhere(f, "completed_transaction"), orderBy: SORTS[sort] ?? SORTS.recent, take: 500 })
    : [];
  const ppsqm = (r: (typeof rows)[number]) => (r.transactionPriceIls && r.areaSqm ? r.transactionPriceIls / r.areaSqm : 0);
  if (sort === "ppsqm") rows = rows.sort((a, b) => ppsqm(b) - ppsqm(a));
  const values = rows.map(ppsqm).filter(Boolean);

  return (
    <>
      <PageHeader title="עסקאות באזור" subtitle="עסקאות מכירה שהושלמו בפועל בלבד. מודעות מוצגות במסך ״נכסים מתחרים״." />
      <FilterBar
        cities={cities}
        neighborhoods={neighborhoods}
        f={f}
        priceLabel="מחיר עסקה"
        showMonths
        sort={sort}
        sortOptions={[
          ["recent", "העסקאות האחרונות"],
          ["ppsqm", "מחיר למ״ר"],
          ["price_desc", "מחיר (מהגבוה)"],
          ["price_asc", "מחיר (מהנמוך)"],
          ["area", "שטח"],
        ]}
      />
      {!f.city ? (
        <Empty>בחרו עיר כדי להציג עסקאות</Empty>
      ) : rows.length === 0 ? (
        <Empty>לא נמצאו עסקאות בסינון הזה</Empty>
      ) : (
        <div className="space-y-6">
          <div className="grid gap-4 md:grid-cols-4">
            <Stat label="עסקאות" value={formatNum(rows.length)} hint={rows.length === 500 ? "מוצגות 500 הראשונות" : undefined} />
            <Stat label="חציון מחיר למ״ר" value={formatIls(median(values))} />
            <Stat label="חציון מחיר עסקה" value={formatIls(median(rows.map((r) => r.transactionPriceIls ?? 0)))} />
            <Stat label="עסקה אחרונה" value={formatDate(rows.map((r) => r.transactionDate).sort((a, b) => (b?.getTime() ?? 0) - (a?.getTime() ?? 0))[0])} />
          </div>
          <section className="card">
            <LazyMap
              zoom={14}
              points={rows
                .filter((r) => r.latitude && r.longitude)
                .slice(0, 300)
                .map((r) => ({
                  id: r.id,
                  lat: r.latitude!,
                  lng: r.longitude!,
                  kind: "transaction" as const,
                  label: `${r.address ?? r.street ?? ""} · ${formatIls(r.transactionPriceIls)} · ${formatDate(r.transactionDate)}`,
                }))}
            />
            <MapLegend />
          </section>
          <section className="card overflow-x-auto">
            <table className="table" data-testid="transactions-table">
              <thead>
                <tr>
                  <th>תאריך</th>
                  <th>כתובת</th>
                  <th>שכונה</th>
                  <th>חדרים</th>
                  <th>שטח</th>
                  <th>קומה</th>
                  <th>מחיר עסקה</th>
                  <th>למ״ר</th>
                  <th>גוש/חלקה</th>
                  <th>מקור</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id}>
                    <td className="whitespace-nowrap">{formatDate(r.transactionDate)}</td>
                    <td>{r.address ?? r.street ?? "—"}</td>
                    <td>{r.neighborhood ?? "—"}</td>
                    <td>{formatNum(r.rooms, 1)}</td>
                    <td>{formatNum(r.areaSqm)}</td>
                    <td>{formatNum(r.floor)}</td>
                    <td className="whitespace-nowrap font-medium">{formatIls(r.transactionPriceIls)}</td>
                    <td className="whitespace-nowrap">{formatIls(ppsqm(r))}</td>
                    <td className="ltr text-xs">{r.block ? `${r.block}/${r.parcel ?? ""}` : "—"}</td>
                    <td>
                      <SourceBadge source={r.sourceName} isDemo={r.isDemo} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        </div>
      )}
    </>
  );
}
