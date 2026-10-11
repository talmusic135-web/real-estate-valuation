import Link from "next/link";
import { notFound } from "next/navigation";
import { ReportActions } from "@/components/ReportActions";
import { TrendChart } from "@/components/PriceChart";
import { confidenceLabels, conditionLabels, parkingLabels, propertyTypeLabels, tierLabels, triLabels } from "@/lib/domain/labels";
import { SOURCE_LABELS } from "@/lib/connectors/connectors";
import { formatDate, formatDistance, formatIls, formatNum, formatPct } from "@/lib/format";
import { getCurrentContext } from "@/lib/services/context";
import { getValuation } from "@/lib/services/valuations";

export const dynamic = "force-dynamic";

function H2({ children }: { children: React.ReactNode }) {
  return <h2 className="mb-2 mt-6 border-b border-slate-200 pb-1 text-lg font-bold text-brand-900">{children}</h2>;
}

export default async function ReportPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { accountId, accountName } = await getCurrentContext();
  const v = await getValuation(id, accountId);
  if (!v) notFound();
  const r = v.result;
  const p = v.input.property;
  const loc = v.input.location;
  const address = [loc.street && `${loc.street} ${loc.houseNumber ?? ""}`.trim(), loc.neighborhood, loc.city].filter(Boolean).join(", ");

  return (
    <div className="mx-auto max-w-4xl">
      <div className="no-print mb-4 flex flex-wrap items-center justify-between gap-2">
        <Link href={`/valuations/${id}`} className="text-sm text-brand-600 underline">
          ← חזרה להערכה
        </Link>
        <ReportActions id={id} />
      </div>

      <article className="rounded-xl bg-white p-8 shadow-sm print:p-0 print:shadow-none" data-testid="report">
        <header className="flex items-start justify-between border-b-2 border-brand-700 pb-4">
          <div>
            <div className="text-sm text-slate-500">{accountName}</div>
            <h1 className="text-2xl font-bold text-brand-900">דוח הערכת שווי דירה</h1>
            <div className="mt-1 text-slate-700">{address}</div>
          </div>
          <div className="text-left text-sm text-slate-500">
            <div>תאריך: {formatDate(r?.computedAt ?? v.updatedAt)}</div>
            <div className="ltr font-mono text-xs">#{v.id.slice(-8)}</div>
            {r && <div>אלגוריתם {r.algorithmVersion}</div>}
          </div>
        </header>

        {r?.usesDemoData && (
          <div className="mt-4 rounded border-2 border-amber-400 bg-amber-50 p-3 text-sm font-medium text-amber-900">
            ⚠️ דוח זה מבוסס על נתוני הדגמה סינתטיים בלבד. אין להציגו ללקוח או להסתמך עליו לתמחור.
          </div>
        )}

        <H2>תקציר מנהלים</H2>
        <p className="text-sm leading-7">
          {propertyTypeLabels[p.propertyType]} בת {p.rooms} חדרים, {p.areaSqm} מ״ר
          {p.floor !== undefined ? `, קומה ${p.floor}${p.buildingFloors ? ` מתוך ${p.buildingFloors}` : ""}` : ""}, ב{address}.
        </p>
        {r?.status === "completed" ? (
          <div className="mt-3 grid grid-cols-3 gap-3 text-center">
            <div className="rounded-lg bg-brand-50 p-3">
              <div className="text-xs text-slate-500">אומדן שווי</div>
              <div className="text-xl font-bold text-brand-700">{formatIls(r.estimateIls)}</div>
            </div>
            <div className="rounded-lg bg-slate-50 p-3">
              <div className="text-xs text-slate-500">טווח משוער</div>
              <div className="font-semibold">
                {formatIls(r.rangeLowIls)} – {formatIls(r.rangeHighIls)}
              </div>
            </div>
            <div className="rounded-lg bg-slate-50 p-3">
              <div className="text-xs text-slate-500">מחיר למ״ר · אמינות</div>
              <div className="font-semibold">
                {formatIls(r.pricePerSqm)} · {confidenceLabels[r.confidence.level]}
              </div>
            </div>
          </div>
        ) : (
          <p className="mt-2 rounded bg-red-50 p-3 text-sm text-red-800">לא הופק אומדן: אין מספיק עסקאות דומות. {r?.warnings.at(-1)}</p>
        )}

        {v.aiSummary && <p className="mt-4 whitespace-pre-line text-sm leading-7 text-slate-700">{v.aiSummary}</p>}

        <H2>תיאור הנכס</H2>
        <table className="table">
          <tbody>
            {(
              [
                ["סוג נכס", propertyTypeLabels[p.propertyType]],
                ["חדרים / שטח", `${p.rooms} חדרים, ${p.areaSqm} מ״ר`],
                ["קומה", p.floor !== undefined ? `${p.floor}${p.buildingFloors ? ` מתוך ${p.buildingFloors}` : ""}` : "לא ידוע"],
                ["מעלית / ממ״ד / מחסן", `${triLabels[p.elevator]} / ${triLabels[p.mamad]} / ${triLabels[p.storage]}`],
                ["מרפסת", `${triLabels[p.balcony]}${p.balconyAreaSqm ? ` (${p.balconyAreaSqm} מ״ר)` : ""}`],
                ["חניה", parkingLabels[p.parking]],
                ["מצב", conditionLabels[p.condition]],
                ["גיל בניין", p.buildingAge !== undefined ? `${p.buildingAge} שנים` : "לא ידוע"],
                ["גוש / חלקה", loc.block ? `${loc.block} / ${loc.parcel ?? "?"}` : "לא הוזן"],
                ["יתרונות", p.viewAndAdvantages ?? "—"],
                ["התחדשות עירונית", p.urbanRenewal ?? "לא הוזן מידע"],
              ] as [string, string][]
            ).map(([k, val]) => (
              <tr key={k}>
                <td className="w-48 text-slate-500">{k}</td>
                <td>{val}</td>
              </tr>
            ))}
          </tbody>
        </table>

        {r && (
          <>
            <H2>עסקאות השוואה ({r.counts.transactionsUsed})</H2>
            <table className="table text-xs">
              <thead>
                <tr>
                  <th>מזהה</th>
                  <th>תאריך</th>
                  <th>מיקום</th>
                  <th>חד׳</th>
                  <th>מ״ר</th>
                  <th>מחיר עסקה</th>
                  <th>למ״ר</th>
                  <th>מרחק</th>
                  <th>דמיון</th>
                  <th>מקור</th>
                </tr>
              </thead>
              <tbody>
                {r.comparables.map((c) => (
                  <tr key={c.recordId} className={c.included ? "" : "text-slate-400 line-through"}>
                    <td className="ltr font-mono">{c.sourceRecordId}</td>
                    <td>{formatDate(c.date)}</td>
                    <td>{c.address ?? c.street ?? "—"}</td>
                    <td>{formatNum(c.rooms, 1)}</td>
                    <td>{formatNum(c.areaSqm)}</td>
                    <td>{formatIls(c.priceIls)}</td>
                    <td>{formatIls(c.pricePerSqm)}</td>
                    <td>{formatDistance(c.distanceM)}</td>
                    <td>{Math.round(c.similarity)}</td>
                    <td>{c.isDemo ? "הדגמה" : (SOURCE_LABELS[c.sourceName] ?? c.sourceName)}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            <H2>מתחרים פעילים – מחירים מבוקשים ({r.listings.length})</H2>
            {r.listings.length ? (
              <table className="table text-xs">
                <thead>
                  <tr>
                    <th>מיקום</th>
                    <th>חד׳</th>
                    <th>מ״ר</th>
                    <th>קומה</th>
                    <th>מחיר מבוקש</th>
                    <th>למ״ר</th>
                    <th>פורסם</th>
                    <th>דמיון</th>
                  </tr>
                </thead>
                <tbody>
                  {r.listings.slice(0, 15).map((c) => (
                    <tr key={c.recordId}>
                      <td>{c.street ?? "—"}</td>
                      <td>{formatNum(c.rooms, 1)}</td>
                      <td>{formatNum(c.areaSqm)}</td>
                      <td>{formatNum(c.floor)}</td>
                      <td>{formatIls(c.priceIls)}</td>
                      <td>{formatIls(c.pricePerSqm)}</td>
                      <td>{formatDate(c.date)}</td>
                      <td>{Math.round(c.similarity)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <p className="text-sm text-slate-500">לא נמצאו מודעות פעילות במקורות המחוברים.</p>
            )}
            <p className="mt-1 text-xs text-slate-500">מחיר מבוקש אינו מחיר מכירה. המודעות לא שימשו לחישוב השווי.</p>

            <H2>ניתוח האזור</H2>
            <p className="text-sm">
              {r.timeAdjustment.explanation} היקף נתונים: {r.counts.candidatesInCity} רשומות בעיר, {r.counts.passedFilters} עסקאות רלוונטיות.
              {r.listingsVsTransactions.gapPct !== null &&
                ` המחיר המבוקש החציוני למ״ר במודעות (${formatIls(r.listingsVsTransactions.listingMedianPpsqm)}) שונה ב-${formatPct(r.listingsVsTransactions.gapPct)} מהחציון בעסקאות (${formatIls(r.listingsVsTransactions.transactionMedianPpsqm)}).`}
            </p>
            {r.marketTrend.length >= 4 && (
              <div className="mt-2">
                <TrendChart data={r.marketTrend} />
              </div>
            )}

            <H2>מתודולוגיה</H2>
            <ol className="list-decimal space-y-1 pr-5 text-sm">
              {r.methodology.map((m, i) => (
                <li key={i}>{m}</li>
              ))}
            </ol>
            <p className="mt-2 text-sm">
              שלבי החיפוש שהופעלו: {r.searchExpansion.filter((s) => s.used).map((s) => tierLabels[s.tier]).join(", ") || "—"}.
            </p>

            <H2>אמינות ומגבלות</H2>
            <p className="text-sm font-medium">
              רמת אמינות: {confidenceLabels[r.confidence.level]} ({r.confidence.score}/{r.confidence.maxScore})
            </p>
            <ul className="mt-1 list-disc space-y-1 pr-5 text-sm">
              {r.confidence.explanations.map((e, i) => (
                <li key={`c${i}`}>{e}</li>
              ))}
              {r.limitations.map((e, i) => (
                <li key={`l${i}`}>{e}</li>
              ))}
              {r.anomalies.map((a) => (
                <li key={a.recordId}>
                  לבדיקה: <span className="ltr font-mono">{a.sourceRecordId}</span> – {a.text}
                </li>
              ))}
            </ul>
            {r.sensitivity.length > 0 && (
              <p className="mt-2 text-sm">
                רגישות: {r.sensitivity.map((s) => `${s.label} ${formatPct(s.deltaPct)}`).join(" · ")}.
              </p>
            )}

            <H2>המלצה למתווך</H2>
            {r.askingPrice ? (
              <>
                <p className="text-sm">
                  טווח מחיר אפשרי לשיווק: <strong>{formatIls(r.askingPrice.lowIls)} – {formatIls(r.askingPrice.highIls)}</strong>.
                </p>
                <p className="mt-1 text-sm text-slate-600">{r.askingPrice.explanation}</p>
              </>
            ) : (
              <p className="text-sm">אין המלצת מחיר ללא אומדן שווי מבוסס.</p>
            )}
            <p className="mt-2 text-sm text-slate-600">
              ההמלצה מבוססת על הנתונים וההנחות המפורטות בדוח ואינה התחייבות למחיר שבו הנכס יימכר.
            </p>
          </>
        )}

        {v.brokerNotes && (
          <>
            <H2>הערות המתווך</H2>
            <p className="whitespace-pre-line text-sm">{v.brokerNotes}</p>
          </>
        )}

        <footer className="mt-8 border-t border-slate-200 pt-3 text-xs leading-5 text-slate-500">
          דוח זה הופק באופן ממוחשב לצורכי עבודת תיווך, על בסיס הנתונים שהיו זמינים במערכת במועד ההפקה. הוא אינו שומת מקרקעין
          ואינו מחליף חוות דעת של שמאי מקרקעין מוסמך. מחירים מבוקשים במודעות אינם מחירי מכירה.
        </footer>
      </article>
    </div>
  );
}
