"use client";

import { Fragment, useMemo, useState } from "react";
import clsx from "clsx";
import type { ComparableResult } from "@/lib/valuation/types";
import { formatBool, formatDate, formatDistance, formatIls, formatNum } from "@/lib/format";
import { tierLabels, propertyTypeLabels } from "@/lib/domain/labels";
import { SourceBadge } from "./ui";

const SORTS = {
  similar: { label: "הדומים ביותר", fn: (a: ComparableResult, b: ComparableResult) => b.similarity - a.similarity },
  recent: { label: "האחרונים", fn: (a: ComparableResult, b: ComparableResult) => (b.date ?? "").localeCompare(a.date ?? "") },
  closest: {
    label: "הקרובים ביותר",
    fn: (a: ComparableResult, b: ComparableResult) => (a.distanceM ?? Infinity) - (b.distanceM ?? Infinity),
  },
  ppsqm: { label: "מחיר למ״ר", fn: (a: ComparableResult, b: ComparableResult) => b.pricePerSqm - a.pricePerSqm },
  price: { label: "מחיר", fn: (a: ComparableResult, b: ComparableResult) => b.priceIls - a.priceIls },
} as const;

export function ComparablesTable({ rows, kind, compact = false }: { rows: ComparableResult[]; kind: "transaction" | "listing"; compact?: boolean }) {
  const [sort, setSort] = useState<keyof typeof SORTS>("similar");
  const [open, setOpen] = useState<string | null>(null);
  const sorted = useMemo(() => [...rows].sort(SORTS[sort].fn), [rows, sort]);
  const isTx = kind === "transaction";

  return (
    <div>
      {!compact && (
        <div className="no-print mb-3 flex flex-wrap items-center gap-2 text-sm">
          <span className="text-slate-500">מיון:</span>
          {(Object.keys(SORTS) as (keyof typeof SORTS)[]).map((k) => (
            <button
              key={k}
              type="button"
              onClick={() => setSort(k)}
              className={clsx("rounded-full px-3 py-1", sort === k ? "bg-brand-600 text-white" : "bg-slate-100 text-slate-700 hover:bg-slate-200")}
            >
              {SORTS[k].label}
            </button>
          ))}
        </div>
      )}
      <div className="overflow-x-auto">
        <table className="table" data-testid={isTx ? "comparables-table" : "listings-table"}>
          <thead>
            <tr>
              <th>{isTx ? "תאריך עסקה" : "תאריך פרסום"}</th>
              <th>מיקום</th>
              <th>חדרים</th>
              <th>שטח</th>
              <th>קומה</th>
              <th>{isTx ? "מחיר עסקה" : "מחיר מבוקש"}</th>
              <th>מחיר למ״ר</th>
              {isTx && <th>למ״ר מותאם</th>}
              <th>מרחק</th>
              <th>דמיון</th>
              {isTx && <th>משקל</th>}
              {!isTx && <th>ימים בשוק</th>}
              <th>מקור</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((c) => (
              <Fragment key={c.recordId}>
                <tr
                  className={clsx("cursor-pointer hover:bg-slate-50", !c.included && "bg-slate-50 text-slate-400 line-through decoration-slate-300")}
                  onClick={() => setOpen(open === c.recordId ? null : c.recordId)}
                >
                  <td className="whitespace-nowrap">{formatDate(c.date)}</td>
                  <td>
                    <div className="font-medium">{c.address ?? c.street ?? "—"}</div>
                    <div className="text-xs text-slate-500">
                      {[c.neighborhood, c.city].filter(Boolean).join(", ")} · {tierLabels[c.tier]}
                    </div>
                  </td>
                  <td>{formatNum(c.rooms, 1)}</td>
                  <td>{formatNum(c.areaSqm)}</td>
                  <td>{formatNum(c.floor)}</td>
                  <td className="whitespace-nowrap font-medium">{formatIls(c.priceIls)}</td>
                  <td className="whitespace-nowrap">{formatIls(c.pricePerSqm)}</td>
                  {isTx && (
                    <td className="whitespace-nowrap" title={`מקדם זמן ${c.timeAdjustmentFactor}`}>
                      {formatIls(c.adjustedPricePerSqm)}
                    </td>
                  )}
                  <td className="whitespace-nowrap">{formatDistance(c.distanceM)}</td>
                  <td>
                    <div className="flex items-center gap-2">
                      <div className="h-1.5 w-12 overflow-hidden rounded bg-slate-200">
                        <div className="h-full bg-brand-500" style={{ width: `${c.similarity}%` }} />
                      </div>
                      <span>{Math.round(c.similarity)}</span>
                    </div>
                  </td>
                  {isTx && <td>{c.included ? `${(c.weight * 100).toFixed(1)}%` : "הוצא"}</td>}
                  {!isTx && <td>{c.daysOnMarket ?? "—"}</td>}
                  <td>
                    <SourceBadge source={c.sourceName} isDemo={c.isDemo} />
                  </td>
                </tr>
                {open === c.recordId && (
                  <tr className="bg-slate-50">
                    <td colSpan={13} className="text-sm">
                      <div className="grid gap-4 py-2 md:grid-cols-3">
                        <div>
                          <div className="mb-1 font-medium">למה נבחר / מה שונה</div>
                          <ul className="space-y-0.5">
                            {c.reasons.map((r, i) => (
                              <li key={i} className={r.kind === "match" ? "text-emerald-700" : r.kind === "diff" ? "text-orange-700" : "text-slate-500"}>
                                {r.kind === "match" ? "✓" : r.kind === "diff" ? "≠" : "?"} {r.text}
                              </li>
                            ))}
                          </ul>
                          {c.excludedReason && <div className="mt-2 text-red-700">{c.excludedReason}</div>}
                        </div>
                        <div className="space-y-0.5">
                          <div className="mb-1 font-medium">פרטים</div>
                          <div>סוג: {c.propertyType ? propertyTypeLabels[c.propertyType] : "לא ידוע"}</div>
                          <div>מעלית: {formatBool(c.elevator)} · מרפסת: {formatBool(c.balcony)}</div>
                          <div>חניות: {c.parkingSpaces ?? "לא ידוע"} · ממ״ד: {formatBool(c.mamad)} · מחסן: {formatBool(c.storage)}</div>
                          {c.priceChanges && (
                            <div>
                              שינויי מחיר מתועדים:{" "}
                              {c.priceChanges.map((p) => `${formatIls(p.priceIls)} (${formatDate(p.observedAt)})`).join(" ← ")}
                            </div>
                          )}
                        </div>
                        <div className="space-y-0.5">
                          <div className="mb-1 font-medium">מקור</div>
                          <div>
                            מזהה: <span className="ltr font-mono text-xs">{c.sourceRecordId}</span>
                          </div>
                          {c.sourceUrl ? (
                            <a className="text-brand-600 underline" href={c.sourceUrl} target="_blank" rel="noreferrer">
                              {isTx ? "פתיחה במקור" : "למודעה המקורית"}
                            </a>
                          ) : (
                            <div className="text-slate-500">{c.isDemo ? "נתון סינתטי – אין קישור" : "אין קישור במקור"}</div>
                          )}
                        </div>
                      </div>
                    </td>
                  </tr>
                )}
              </Fragment>
            ))}
          </tbody>
        </table>
      </div>
      {!compact && <p className="mt-2 text-xs text-slate-500">לחיצה על שורה מציגה את סיבות הבחירה, ההבדלים ומקור הנתון.</p>}
    </div>
  );
}
