import { prisma } from "@/lib/db";
import { TrendChart } from "@/components/PriceChart";
import { Empty, PageHeader } from "@/components/ui";
import { listCities } from "@/lib/services/queries";
import { demoEnabled } from "@/lib/services/records";
import { formatIls, formatNum, formatPct } from "@/lib/format";
import { median } from "@/lib/stats";

export const dynamic = "force-dynamic";

/** מגמה מוצגת רק כשיש לפחות 10 עסקאות בכל תקופה */
const MIN_N = 10;

export default async function MarketPage({ searchParams }: { searchParams: Promise<{ city?: string; neighborhood?: string }> }) {
  const sp = await searchParams;
  const cities = await listCities();
  const city = sp.city ?? cities[0];
  const demo = demoEnabled() ? {} : { isDemo: false };
  const records = city
    ? await prisma.propertyRecord.findMany({
        where: { city, ...demo, OR: [{ recordType: "completed_transaction" }, { recordType: "active_listing" }] },
        select: { neighborhood: true, recordType: true, transactionDate: true, transactionPriceIls: true, askingPriceIls: true, areaSqm: true, isDemo: true },
      })
    : [];
  const now = Date.now();
  const yr = 365.25 * 86400000;
  const groups = new Map<string, typeof records>();
  for (const r of records) {
    const k = r.neighborhood ?? "לא ידוע";
    groups.set(k, [...(groups.get(k) ?? []), r]);
  }
  const stats = [...groups.entries()]
    .map(([name, rs]) => {
      const tx = rs.filter((r) => r.recordType === "completed_transaction" && r.transactionPriceIls && r.areaSqm && r.transactionDate);
      const pp = (r: (typeof rs)[number]) => r.transactionPriceIls! / r.areaSqm!;
      const last = tx.filter((r) => now - r.transactionDate!.getTime() <= yr);
      const prev = tx.filter((r) => now - r.transactionDate!.getTime() > yr && now - r.transactionDate!.getTime() <= 2 * yr);
      const ls = rs.filter((r) => r.recordType === "active_listing" && r.askingPriceIls && r.areaSqm);
      const lastMed = last.length ? median(last.map(pp)) : null;
      const prevMed = prev.length ? median(prev.map(pp)) : null;
      const lsMed = ls.length ? median(ls.map((r) => r.askingPriceIls! / r.areaSqm!)) : null;
      return {
        name,
        last: last.length,
        prev: prev.length,
        lastMed,
        change: lastMed && prevMed && last.length >= MIN_N && prev.length >= MIN_N ? Math.round((lastMed / prevMed - 1) * 1000) / 10 : null,
        listings: ls.length,
        lsMed,
        gap: lsMed && lastMed ? Math.round((lsMed / lastMed - 1) * 1000) / 10 : null,
      };
    })
    .sort((a, b) => (b.lastMed ?? 0) - (a.lastMed ?? 0));

  const selected = sp.neighborhood ?? stats[0]?.name;
  const trendSource = records.filter(
    (r) => r.recordType === "completed_transaction" && r.transactionPriceIls && r.areaSqm && r.transactionDate && (r.neighborhood ?? "לא ידוע") === selected,
  );
  const byQ = new Map<string, number[]>();
  for (const r of trendSource) {
    const d = r.transactionDate!;
    const k = `${d.getUTCFullYear()}-Q${Math.floor(d.getUTCMonth() / 3) + 1}`;
    byQ.set(k, [...(byQ.get(k) ?? []), r.transactionPriceIls! / r.areaSqm!]);
  }
  const trend = [...byQ.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .filter(([, v]) => v.length >= 3)
    .map(([period, v]) => ({ period, medianPricePerSqm: Math.round(median(v)), count: v.length }));
  const usesDemo = records.some((r) => r.isDemo);

  return (
    <>
      <PageHeader title="שכונות וניתוח שוק" subtitle={usesDemo ? "⚠️ מבוסס על נתוני הדגמה סינתטיים" : "על בסיס העסקאות והמודעות במאגר"} />
      <form className="card mb-4 flex flex-wrap items-end gap-3">
        <div>
          <label className="label">עיר</label>
          <select className="input" name="city" defaultValue={city}>
            {cities.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
        </div>
        <button className="btn-secondary">הצגה</button>
      </form>
      {!city || stats.length === 0 ? (
        <Empty>אין נתונים</Empty>
      ) : (
        <div className="space-y-6">
          <section className="card overflow-x-auto">
            <table className="table" data-testid="market-table">
              <thead>
                <tr>
                  <th>שכונה</th>
                  <th>עסקאות (12 ח׳)</th>
                  <th>חציון למ״ר (12 ח׳)</th>
                  <th>שינוי מול שנה קודמת</th>
                  <th>מודעות פעילות</th>
                  <th>חציון מבוקש למ״ר</th>
                  <th>פער מבוקש/עסקאות</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {stats.map((s) => (
                  <tr key={s.name} className={s.name === selected ? "bg-brand-50" : ""}>
                    <td className="font-medium">{s.name}</td>
                    <td>{formatNum(s.last)}</td>
                    <td className="whitespace-nowrap">{formatIls(s.lastMed)}</td>
                    <td className="ltr" title={s.change === null ? `נדרשות לפחות ${MIN_N} עסקאות בכל תקופה` : undefined}>
                      {s.change === null ? "אין מספיק נתונים" : formatPct(s.change)}
                    </td>
                    <td>{formatNum(s.listings)}</td>
                    <td className="whitespace-nowrap">{formatIls(s.lsMed)}</td>
                    <td className="ltr">{formatPct(s.gap)}</td>
                    <td>
                      <a className="text-brand-600 underline" href={`/market?city=${encodeURIComponent(city)}&neighborhood=${encodeURIComponent(s.name)}`}>
                        מגמה
                      </a>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="mt-2 text-xs text-slate-500">חציון ולא ממוצע. שינוי שנתי מוצג רק כשיש לפחות {MIN_N} עסקאות בכל אחת מהתקופות.</p>
          </section>
          <section className="card">
            <h2 className="card-title">חציון מחיר למ״ר לפי רבעון – {selected}</h2>
            {trend.length >= 3 ? <TrendChart data={trend} /> : <Empty>אין מספיק עסקאות להצגת מגמה</Empty>}
          </section>
        </div>
      )}
    </>
  );
}
