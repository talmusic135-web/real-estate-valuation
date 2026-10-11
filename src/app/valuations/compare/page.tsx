import Link from "next/link";
import { Empty, PageHeader } from "@/components/ui";
import { conditionLabels, parkingLabels, propertyTypeLabels, triLabels, confidenceLabels } from "@/lib/domain/labels";
import { formatDateTime, formatIls, formatPct } from "@/lib/format";
import { getCurrentContext } from "@/lib/services/context";
import { getValuation, type FullValuation } from "@/lib/services/valuations";

export const dynamic = "force-dynamic";

function rows(v: FullValuation): [string, string][] {
  const p = v.input.property;
  const l = v.input.location;
  const s = v.input.settings;
  const r = v.result;
  return [
    ["תאריך", formatDateTime(v.createdAt)],
    ["מיקום", [l.street, l.neighborhood, l.city].filter(Boolean).join(", ")],
    ["סוג", propertyTypeLabels[p.propertyType]],
    ["חדרים", String(p.rooms)],
    ["שטח", `${p.areaSqm} מ״ר`],
    ["קומה", p.floor !== undefined ? String(p.floor) : "לא ידוע"],
    ["מעלית", triLabels[p.elevator]],
    ["חניה", parkingLabels[p.parking]],
    ["מצב", conditionLabels[p.condition]],
    ["רדיוס / טווח תאריכים", `${s.radiusM} מ׳ / ${s.dateRangeMonths} חודשים`],
    ["אומדן", formatIls(r?.estimateIls)],
    ["טווח", r?.rangeLowIls ? `${formatIls(r.rangeLowIls)} – ${formatIls(r.rangeHighIls)}` : "—"],
    ["מחיר למ״ר", formatIls(r?.pricePerSqm)],
    ["אמינות", r ? confidenceLabels[r.confidence.level] : "—"],
    ["עסקאות בחישוב", String(r?.counts.transactionsUsed ?? "—")],
    ["גרסת אלגוריתם", r?.algorithmVersion ?? "—"],
  ];
}

export default async function ComparePage({ searchParams }: { searchParams: Promise<{ a?: string; b?: string }> }) {
  const { a, b } = await searchParams;
  const { accountId } = await getCurrentContext();
  const [va, vb] = await Promise.all([a ? getValuation(a, accountId) : null, b ? getValuation(b, accountId) : null]);
  if (!va || !vb) return <Empty>יש לבחור שתי הערכות קיימות להשוואה</Empty>;
  const ra = rows(va);
  const rb = rows(vb);
  const delta =
    va.result?.estimateIls && vb.result?.estimateIls ? Math.round((vb.result.estimateIls / va.result.estimateIls - 1) * 1000) / 10 : null;
  const idsA = new Set(va.result?.comparables.map((c) => c.recordId) ?? []);
  const shared = vb.result?.comparables.filter((c) => idsA.has(c.recordId)).length ?? 0;
  return (
    <>
      <PageHeader title="השוואת הערכות" subtitle={delta !== null ? `הפרש באומדן: ${formatPct(delta)} · ${shared} עסקאות השוואה משותפות` : undefined} />
      <div className="card overflow-x-auto">
        <table className="table" data-testid="compare-table">
          <thead>
            <tr>
              <th>שדה</th>
              <th>
                <Link className="text-brand-700 underline" href={`/valuations/${va.id}`}>
                  {va.title}
                </Link>
              </th>
              <th>
                <Link className="text-brand-700 underline" href={`/valuations/${vb.id}`}>
                  {vb.title}
                </Link>
              </th>
            </tr>
          </thead>
          <tbody>
            {ra.map(([k, val], i) => (
              <tr key={k} className={val !== rb[i][1] ? "bg-amber-50" : ""}>
                <td className="text-slate-500">{k}</td>
                <td>{val}</td>
                <td>{rb[i][1]}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="mt-2 text-xs text-slate-500">שורות מודגשות = ערכים שונים בין ההערכות.</p>
      </div>
    </>
  );
}
