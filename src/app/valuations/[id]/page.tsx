import Link from "next/link";
import { notFound } from "next/navigation";
import { ComparablesTable } from "@/components/ComparablesTable";
import { LazyMap } from "@/components/LazyMap";
import { MapLegend, type MapPoint } from "@/components/MapView";
import { PriceScatter } from "@/components/PriceChart";
import { NotesEditor, ValuationActions } from "@/components/ValuationActions";
import { Alert, ConfidenceBadge, Empty, PageHeader, Stat, StatusBadge } from "@/components/ui";
import { conditionLabels, parkingLabels, propertyTypeLabels, triLabels } from "@/lib/domain/labels";
import { formatDate, formatDateTime, formatIls, formatNum, formatPct } from "@/lib/format";
import { getCurrentContext } from "@/lib/services/context";
import { getValuation } from "@/lib/services/valuations";
import type { ValuationResult } from "@/lib/valuation/types";

export const dynamic = "force-dynamic";

export default async function ValuationPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { accountId } = await getCurrentContext();
  const v = await getValuation(id, accountId);
  if (!v) notFound();
  const r = v.result;
  const p = v.input.property;
  const loc = v.input.location;

  return (
    <>
      <PageHeader
        title={v.title}
        subtitle={
          <span className="flex flex-wrap items-center gap-2">
            <StatusBadge status={v.status} />
            <span>נוצרה {formatDateTime(v.createdAt)}</span>
            {r && <span>· גרסת אלגוריתם {r.algorithmVersion}</span>}
            {v.parent && (
              <span>
                · גרסה של{" "}
                <Link className="text-brand-600 underline" href={`/valuations/${v.parent.id}`}>
                  {v.parent.title}
                </Link>{" "}
                (
                <Link className="text-brand-600 underline" href={`/valuations/compare?a=${v.parent.id}&b=${v.id}`}>
                  השוואה
                </Link>
                )
              </span>
            )}
          </span>
        }
        actions={<ValuationActions id={v.id} status={v.status} />}
      />

      <PropertySummary v={v} />

      {!r ? (
        <div className="mt-6">
          <Empty>זו טיוטה. לחצו ״הרצת הערכה״ כדי לחשב את השווי.</Empty>
        </div>
      ) : (
        <ResultBody r={r} subject={{ lat: loc.latitude, lng: loc.longitude }} aiSummary={v.aiSummary} aiProvider={v.aiProvider} sources={v.sourcesUsed} />
      )}

      {v.versions.length > 0 && (
        <section className="card mt-6">
          <h2 className="card-title">גרסאות מאוחרות של הערכה זו</h2>
          <ul className="space-y-1 text-sm">
            {v.versions.map((x) => (
              <li key={x.id}>
                <Link className="text-brand-600 underline" href={`/valuations/${x.id}`}>
                  {x.title}
                </Link>{" "}
                · {formatDateTime(x.createdAt)} ·{" "}
                <Link className="text-brand-600 underline" href={`/valuations/compare?a=${v.id}&b=${x.id}`}>
                  השוואה
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="card mt-6">
        <h2 className="card-title">הערות המתווך</h2>
        <NotesEditor id={v.id} initial={v.brokerNotes ?? ""} />
      </section>
    </>
  );

  function PropertySummary({ v }: { v: NonNullable<Awaited<ReturnType<typeof getValuation>>> }) {
    const items: [string, string][] = [
      ["מיקום", [loc.street && `${loc.street} ${loc.houseNumber ?? ""}`.trim(), loc.neighborhood, loc.city].filter(Boolean).join(", ")],
      ["סוג", propertyTypeLabels[p.propertyType]],
      ["חדרים", String(p.rooms)],
      ["שטח", `${p.areaSqm} מ״ר`],
      ["קומה", p.floor !== undefined ? `${p.floor}${p.buildingFloors ? ` מתוך ${p.buildingFloors}` : ""}` : "לא ידוע"],
      ["מעלית", triLabels[p.elevator]],
      ["חניה", parkingLabels[p.parking]],
      ["ממ״ד", triLabels[p.mamad]],
      ["מצב", conditionLabels[p.condition]],
    ];
    if (loc.block) items.push(["גוש/חלקה", `${loc.block}/${loc.parcel ?? "?"}`]);
    return (
      <div className="card flex flex-wrap gap-x-6 gap-y-2 text-sm" data-testid="property-summary">
        {items.map(([k, val]) => (
          <div key={k}>
            <span className="text-slate-500">{k}: </span>
            <span className="font-medium">{val}</span>
          </div>
        ))}
        <div className="text-xs text-slate-400">({v.input.settings.dateRangeMonths} חודשים, רדיוס {v.input.settings.radiusM} מ׳)</div>
      </div>
    );
  }
}

function ResultBody({
  r,
  subject,
  aiSummary,
  aiProvider,
  sources,
}: {
  r: ValuationResult;
  subject: { lat?: number; lng?: number };
  aiSummary: string | null;
  aiProvider: string | null;
  sources: { id: string; name: string; status: string; message: string | null; fetched: number }[];
}) {
  const sp = r.subjectLocation;
  const points: MapPoint[] = [
    ...(sp ? [{ id: "subject", lat: sp.latitude, lng: sp.longitude, kind: "subject" as const, label: "הנכס הנבדק" }] : []),
    ...r.comparables
      .filter((c) => c.latitude !== null && c.longitude !== null)
      .map((c) => ({
        id: c.recordId,
        lat: c.latitude!,
        lng: c.longitude!,
        kind: c.included ? ("transaction" as const) : ("excluded" as const),
        label: `${c.address ?? ""} · ${formatIls(c.priceIls)} · ${formatDate(c.date)}`,
      })),
    ...r.listings
      .filter((c) => c.latitude !== null && c.longitude !== null)
      .map((c) => ({ id: c.recordId, lat: c.latitude!, lng: c.longitude!, kind: "listing" as const, label: `מבוקש ${formatIls(c.priceIls)}` })),
  ];
  void subject;

  return (
    <div className="mt-6 space-y-6">
      {r.warnings.length > 0 && (
        <div className="space-y-2">
          {r.warnings.map((w, i) => (
            <Alert key={i} tone={r.status === "insufficient_data" ? "error" : "warn"}>
              {w}
            </Alert>
          ))}
        </div>
      )}

      {r.status === "completed" ? (
        <div className="grid gap-4 md:grid-cols-4" data-testid="estimate-cards">
          <Stat
            tone="brand"
            label="אומדן שווי מרכזי"
            value={<span data-testid="estimate">{formatIls(r.estimateIls)}</span>}
            hint={<ConfidenceBadge level={r.confidence.level} />}
          />
          <Stat label="טווח שווי משוער" value={<span className="text-xl">{`${formatIls(r.rangeLowIls)} – ${formatIls(r.rangeHighIls)}`}</span>} />
          <Stat
            label="מחיר למ״ר"
            value={formatIls(r.pricePerSqm)}
            hint={r.pricePerSqmRange ? `טווח ${formatIls(r.pricePerSqmRange[0])} – ${formatIls(r.pricePerSqmRange[1])}` : undefined}
          />
          <Stat
            label="מחיר מבוקש מומלץ לפרסום"
            value={<span className="text-xl">{r.askingPrice ? `${formatIls(r.askingPrice.lowIls)} – ${formatIls(r.askingPrice.highIls)}` : "—"}</span>}
            hint={r.askingPrice?.basis === "assumption" ? "הנחת עבודה, לא נתון שוק" : "לפי פער מודעות מול עסקאות"}
          />
        </div>
      ) : (
        <div className="card border-red-200">
          <div className="text-lg font-semibold text-red-800">לא הופק אומדן שווי</div>
          <p className="mt-1 text-sm text-slate-600">אין מספיק עסקאות דומות. מטה מוצגות העסקאות שנמצאו ואפשרויות להרחבת החיפוש.</p>
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-4">
        <Stat label="עסקאות בחישוב" value={formatNum(r.counts.transactionsUsed)} hint={`מתוך ${r.counts.passedFilters} שעברו סינון · ${r.counts.transactionsExcluded} הוצאו כחריגות`} />
        <Stat label="מודעות פעילות שנמצאו" value={formatNum(r.counts.activeListingsFound)} hint="לא משתתפות באומדן" />
        <Stat label="עסקה עדכנית ביותר" value={formatDate(r.dataFreshness.latestTransactionDate)} hint={`ישנה ביותר: ${formatDate(r.dataFreshness.oldestTransactionDate)}`} />
        <Stat label="עדכון הנתונים" value={formatDate(r.dataFreshness.latestFetchedAt)} hint={`חושב ${formatDateTime(r.computedAt)}`} />
      </div>

      {aiSummary && (
        <section className="card">
          <h2 className="card-title">
            סיכום הממצאים{" "}
            <span className="text-xs font-normal text-slate-500">
              ({aiProvider === "template" ? "נוצר אוטומטית מהנתונים" : "נכתב ע״י מודל שפה ונבדק מול הנתונים"})
            </span>
          </h2>
          <div className="whitespace-pre-line text-sm leading-7 text-slate-700" data-testid="ai-summary">
            {aiSummary}
          </div>
        </section>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="card">
          <h2 className="card-title">מפה</h2>
          {points.length > 0 ? (
            <>
              <LazyMap points={points} center={sp ? [sp.latitude, sp.longitude] : undefined} zoom={15} />
              <MapLegend />
            </>
          ) : (
            <Empty>אין נתוני מיקום להצגה</Empty>
          )}
        </section>
        <section className="card">
          <h2 className="card-title">מחיר למ״ר לאורך זמן</h2>
          <PriceScatter comps={r.comparables} listings={r.listings} estimatePpsqm={r.pricePerSqm} />
        </section>
      </div>

      <section className="card">
        <h2 className="card-title">עסקאות השוואה (עסקאות שהושלמו בפועל)</h2>
        {r.comparables.length ? <ComparablesTable rows={r.comparables} kind="transaction" /> : <Empty>לא נמצאו עסקאות מתאימות</Empty>}
      </section>

      <section className="card">
        <h2 className="card-title">מודעות פעילות באזור (מחירים מבוקשים – לא מחירי מכירה)</h2>
        {r.listings.length ? (
          <>
            {r.listingsVsTransactions.gapPct !== null && (
              <p className="mb-3 text-sm text-slate-600">
                חציון מבוקש למ״ר {formatIls(r.listingsVsTransactions.listingMedianPpsqm)} מול חציון עסקאות {formatIls(r.listingsVsTransactions.transactionMedianPpsqm)} ({formatPct(r.listingsVsTransactions.gapPct)}).
              </p>
            )}
            <ComparablesTable rows={r.listings} kind="listing" />
          </>
        ) : (
          <Empty>לא נמצאו מודעות פעילות (או שהאפשרות כבויה בהגדרות ההשוואה)</Empty>
        )}
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="card">
          <h2 className="card-title">רמת אמינות והסבר</h2>
          <div className="mb-2 flex items-center gap-2">
            <ConfidenceBadge level={r.confidence.level} />
            <span className="text-sm text-slate-500">
              ציון {r.confidence.score} מתוך {r.confidence.maxScore}
            </span>
          </div>
          <ul className="list-disc space-y-1 pr-5 text-sm">
            {r.confidence.explanations.map((e, i) => (
              <li key={i}>{e}</li>
            ))}
          </ul>
        </section>
        <section className="card">
          <h2 className="card-title">גורמים לעלייה או לירידה באומדן</h2>
          <ul className="space-y-1 text-sm">
            {r.drivers.map((d, i) => (
              <li key={i} className="flex gap-2">
                <span className={d.direction === "up" ? "text-emerald-600" : d.direction === "down" ? "text-red-600" : "text-slate-400"}>
                  {d.direction === "up" ? "▲" : d.direction === "down" ? "▼" : "●"}
                </span>
                <span>
                  {d.text} <span className="text-xs text-slate-400">({d.basis === "data" ? "מבוסס מדגם" : "איכותני"})</span>
                </span>
              </li>
            ))}
            {r.drivers.length === 0 && <li className="text-slate-500">—</li>}
          </ul>
        </section>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="card">
          <h2 className="card-title">ניתוח רגישות</h2>
          {r.sensitivity.length ? (
            <table className="table">
              <thead>
                <tr>
                  <th>תרחיש</th>
                  <th>אומדן</th>
                  <th>שינוי</th>
                </tr>
              </thead>
              <tbody>
                {r.sensitivity.map((s) => (
                  <tr key={s.key}>
                    <td>
                      {s.label}
                      {s.note && <div className="text-xs text-slate-500">{s.note}</div>}
                    </td>
                    <td className="whitespace-nowrap">{formatIls(s.estimateIls)}</td>
                    <td className="ltr whitespace-nowrap">{formatPct(s.deltaPct)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <Empty>אין ניתוח רגישות ללא אומדן</Empty>
          )}
        </section>
        <section className="card">
          <h2 className="card-title">הרחבת החיפוש וסינון</h2>
          <table className="table">
            <thead>
              <tr>
                <th>שלב</th>
                <th>עסקאות זמינות</th>
                <th>מצטבר</th>
                <th>בשימוש</th>
              </tr>
            </thead>
            <tbody>
              {r.searchExpansion.map((s) => (
                <tr key={s.tier}>
                  <td>{s.label}</td>
                  <td>{s.available}</td>
                  <td>{s.cumulative}</td>
                  <td>{s.used ? "✓" : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {r.filterLog.length > 0 && (
            <div className="mt-3 text-xs text-slate-500">
              סוננו: {r.filterLog.map((f) => `${f.reason} (${f.count})`).join(" · ")}
            </div>
          )}
        </section>
      </div>

      {r.anomalies.length > 0 && (
        <section className="card">
          <h2 className="card-title">נתונים חריגים לבדיקה</h2>
          <ul className="space-y-1 text-sm">
            {r.anomalies.map((a) => (
              <li key={a.recordId}>
                <span className="ltr font-mono text-xs">{a.sourceRecordId}</span> – {a.text}
              </li>
            ))}
          </ul>
        </section>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="card">
          <h2 className="card-title">מתודולוגיה</h2>
          <ol className="list-decimal space-y-1 pr-5 text-sm text-slate-700">
            {r.methodology.map((m, i) => (
              <li key={i}>{m}</li>
            ))}
          </ol>
        </section>
        <section className="card">
          <h2 className="card-title">מגבלות ומקורות מידע</h2>
          <ul className="list-disc space-y-1 pr-5 text-sm text-slate-700">
            {r.limitations.map((m, i) => (
              <li key={i}>{m}</li>
            ))}
          </ul>
          <div className="mt-4 text-sm">
            <div className="mb-1 font-medium">מקורות בהרצה זו:</div>
            <ul className="space-y-1" data-testid="sources-used">
              {sources.map((s) => (
                <li key={s.id} className="flex flex-wrap items-center gap-2">
                  <StatusBadge status={s.status} /> {s.name}
                  {s.message && <span className="text-xs text-slate-500">– {s.message}</span>}
                </li>
              ))}
            </ul>
          </div>
        </section>
      </div>
    </div>
  );
}
