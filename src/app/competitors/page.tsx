import Link from "next/link";
import { prisma } from "@/lib/db";
import { FilterBar } from "@/components/FilterBar";
import { LazyMap } from "@/components/LazyMap";
import { MapLegend } from "@/components/MapView";
import { Alert, Empty, PageHeader, SourceBadge, Stat } from "@/components/ui";
import { buildWhere, listCities, listNeighborhoods, parseFilters } from "@/lib/services/queries";
import { getCurrentContext } from "@/lib/services/context";
import { getValuation } from "@/lib/services/valuations";
import { toStored } from "@/lib/services/records";
import { computeSimilarity } from "@/lib/valuation/similarity";
import { distanceMeters } from "@/lib/geo";
import { formatBool, formatDate, formatDistance, formatIls, formatNum, formatPct } from "@/lib/format";
import { median } from "@/lib/stats";

export const dynamic = "force-dynamic";

export default async function CompetitorsPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  const { accountId } = await getCurrentContext();
  const valuation = sp.valuationId ? await getValuation(sp.valuationId, accountId) : null;
  const f = parseFilters(sp);
  if (valuation && !sp.city) {
    f.city = valuation.input.location.city;
    f.neighborhood = valuation.input.location.neighborhood;
  }
  const sort = sp.sort ?? (valuation ? "similar" : "recent");
  const cities = await listCities();
  const neighborhoods = f.city ? await listNeighborhoods(f.city) : [];

  const rows = f.city
    ? await prisma.propertyRecord.findMany({
        where: buildWhere(f, "active_listing"),
        include: { priceHistory: { orderBy: { observedAt: "asc" } } },
        take: 400,
      })
    : [];
  const txForCompare = f.city
    ? await prisma.propertyRecord.findMany({
        where: buildWhere({ ...f, months: 12, priceMin: undefined, priceMax: undefined }, "completed_transaction"),
        select: { transactionPriceIls: true, areaSqm: true },
      })
    : [];

  const subject = valuation?.input;
  const sPoint = valuation?.result?.subjectLocation ?? null;
  const items = rows.map((r) => {
    const distanceM = sPoint && r.latitude && r.longitude ? distanceMeters(sPoint.latitude, sPoint.longitude, r.latitude, r.longitude) : null;
    const sim = subject
      ? computeSimilarity(
          { property: subject.property, settings: subject.settings, street: subject.location.street, neighborhood: subject.location.neighborhood, adjacentNeighborhoods: [], now: new Date() },
          toStored(r),
          distanceM,
        )
      : null;
    const ppsqm = r.askingPriceIls && r.areaSqm ? r.askingPriceIls / r.areaSqm : 0;
    // ימים בשוק: רק כשיש תאריך פרסום מתועד
    const dom = r.listingDate ? Math.round(((r.lastSeenAt ?? new Date()).getTime() - r.listingDate.getTime()) / 86400000) : null;
    return { r, distanceM, sim, ppsqm, dom };
  });
  const sorters: Record<string, (a: (typeof items)[number], b: (typeof items)[number]) => number> = {
    similar: (a, b) => (b.sim?.score ?? 0) - (a.sim?.score ?? 0),
    recent: (a, b) => (b.r.listingDate?.getTime() ?? 0) - (a.r.listingDate?.getTime() ?? 0),
    price_asc: (a, b) => (a.r.askingPriceIls ?? 0) - (b.r.askingPriceIls ?? 0),
    price_desc: (a, b) => (b.r.askingPriceIls ?? 0) - (a.r.askingPriceIls ?? 0),
    ppsqm: (a, b) => b.ppsqm - a.ppsqm,
  };
  items.sort(sorters[sort] ?? sorters.recent);

  const listMed = median(items.map((i) => i.ppsqm).filter(Boolean));
  const txMed = median(txForCompare.filter((t) => t.transactionPriceIls && t.areaSqm).map((t) => t.transactionPriceIls! / t.areaSqm!));

  return (
    <>
      <PageHeader
        title="נכסים מתחרים"
        subtitle="נכסים המוצעים כעת למכירה. המחירים הם מחירים מבוקשים ואינם מחירי מכירה."
      />
      {valuation && (
        <div className="mb-4">
          <Alert>
            מידת הדמיון מחושבת מול{" "}
            <Link className="underline" href={`/valuations/${valuation.id}`}>
              {valuation.title}
            </Link>
            .
          </Alert>
        </div>
      )}
      <FilterBar
        cities={cities}
        neighborhoods={neighborhoods}
        f={f}
        priceLabel="מחיר מבוקש"
        sort={sort}
        extra={valuation ? <input type="hidden" name="valuationId" value={valuation.id} /> : undefined}
        sortOptions={[
          ...(valuation ? ([["similar", "הדומים ביותר"]] as [string, string][]) : []),
          ["recent", "פורסמו לאחרונה"],
          ["ppsqm", "מחיר למ״ר"],
          ["price_asc", "מחיר (מהנמוך)"],
          ["price_desc", "מחיר (מהגבוה)"],
        ]}
      />
      {!f.city ? (
        <Empty>בחרו עיר, או פתחו את המסך מתוך הערכה קיימת</Empty>
      ) : items.length === 0 ? (
        <Empty>לא נמצאו מודעות פעילות במקורות המחוברים</Empty>
      ) : (
        <div className="space-y-6">
          <div className="grid gap-4 md:grid-cols-3">
            <Stat label="מודעות פעילות" value={formatNum(items.length)} />
            <Stat label="חציון מבוקש למ״ר" value={formatIls(listMed)} hint="מחיר שוק מבוקש" />
            <Stat
              label="חציון עסקאות למ״ר (12 חודשים)"
              value={formatIls(txMed)}
              hint={txMed ? `פער מבוקש מול עסקאות: ${formatPct(Math.round((listMed / txMed - 1) * 1000) / 10)}` : "אין עסקאות להשוואה"}
            />
          </div>
          <section className="card">
            <LazyMap
              zoom={14}
              center={sPoint ? [sPoint.latitude, sPoint.longitude] : undefined}
              points={[
                ...(sPoint ? [{ id: "s", lat: sPoint.latitude, lng: sPoint.longitude, kind: "subject" as const, label: "הנכס הנבדק" }] : []),
                ...items
                  .filter((i) => i.r.latitude && i.r.longitude)
                  .map((i) => ({ id: i.r.id, lat: i.r.latitude!, lng: i.r.longitude!, kind: "listing" as const, label: `${i.r.street ?? ""} · מבוקש ${formatIls(i.r.askingPriceIls)}` })),
              ]}
            />
            <MapLegend />
          </section>
          <section className="card overflow-x-auto">
            <table className="table" data-testid="competitors-table">
              <thead>
                <tr>
                  <th>אזור / כתובת</th>
                  <th>מחיר מבוקש</th>
                  <th>למ״ר</th>
                  <th>חדרים</th>
                  <th>שטח</th>
                  <th>קומה</th>
                  <th>מעלית</th>
                  <th>מרפסת</th>
                  <th>חניה</th>
                  <th>פורסם</th>
                  <th>ימים בשוק</th>
                  <th>שינויי מחיר</th>
                  {valuation && <th>דמיון</th>}
                  {valuation && <th>מרחק</th>}
                  <th>מקור</th>
                </tr>
              </thead>
              <tbody>
                {items.map(({ r, sim, ppsqm, dom, distanceM }) => (
                  <tr key={r.id}>
                    <td>
                      <div>{[r.street, r.houseNumber].filter(Boolean).join(" ") || "—"}</div>
                      <div className="text-xs text-slate-500">{r.neighborhood}</div>
                    </td>
                    <td className="whitespace-nowrap font-medium">{formatIls(r.askingPriceIls)}</td>
                    <td className="whitespace-nowrap">{formatIls(ppsqm)}</td>
                    <td>{formatNum(r.rooms, 1)}</td>
                    <td>{formatNum(r.areaSqm)}</td>
                    <td>{formatNum(r.floor)}</td>
                    <td>{formatBool(r.elevator)}</td>
                    <td>{formatBool(r.balcony)}</td>
                    <td>{r.parkingSpaces ?? "לא ידוע"}</td>
                    <td className="whitespace-nowrap">{formatDate(r.listingDate)}</td>
                    <td>{dom ?? "—"}</td>
                    <td className="whitespace-nowrap text-xs">
                      {r.priceHistory.length > 1
                        ? `${formatIls(r.priceHistory[0].priceIls)} ← ${formatIls(r.priceHistory.at(-1)!.priceIls)}`
                        : "אין שינוי מתועד"}
                    </td>
                    {valuation && <td title={sim?.reasons.map((x) => x.text).join(" · ")}>{sim ? Math.round(sim.score) : "—"}</td>}
                    {valuation && <td className="whitespace-nowrap">{formatDistance(distanceM)}</td>}
                    <td>
                      {r.sourceUrl ? (
                        <a href={r.sourceUrl} target="_blank" rel="noreferrer" className="text-brand-600 underline">
                          למודעה
                        </a>
                      ) : (
                        <SourceBadge source={r.sourceName} isDemo={r.isDemo} />
                      )}
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
