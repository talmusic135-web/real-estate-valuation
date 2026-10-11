"use client";

import { useState } from "react";
import type { SettingsInput } from "@/lib/domain/schema";

export function SettingsForm({ initial }: { initial: SettingsInput }) {
  const [s, setS] = useState<Record<string, string | boolean>>(
    Object.fromEntries(Object.entries(initial).map(([k, v]) => [k, typeof v === "boolean" ? v : String(v)])),
  );
  const [msg, setMsg] = useState<string | null>(null);
  const numFields: [keyof SettingsInput, string][] = [
    ["dateRangeMonths", "טווח תאריכים (חודשים)"],
    ["radiusM", "רדיוס חיפוש (מטרים)"],
    ["maxComparables", "מספר נכסים להשוואה"],
    ["roomsTolerance", "סטייה בחדרים (±)"],
    ["areaTolerancePct", "סטייה בשטח (±%)"],
  ];
  const boolFields: [keyof SettingsInput, string][] = [
    ["includeAdjacentNeighborhoods", "לכלול שכונות סמוכות"],
    ["includeActiveListings", "לכלול מודעות פעילות"],
    ["includeOlderIfInsufficient", "לכלול עסקאות ישנות כשחסרות חדשות"],
  ];
  return (
    <form
      className="space-y-4"
      onSubmit={async (e) => {
        e.preventDefault();
        const body = Object.fromEntries(Object.entries(s).map(([k, v]) => [k, typeof v === "boolean" ? v : Number(v)]));
        const res = await fetch("/api/settings", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
        setMsg(res.ok ? "נשמר. ההגדרות ישמשו כברירת מחדל בהערכות חדשות." : "השמירה נכשלה – בדקו את הערכים");
      }}
    >
      <div className="grid gap-3 md:grid-cols-5">
        {numFields.map(([k, l]) => (
          <div key={k}>
            <label className="label">{l}</label>
            <input className="input" type="number" step="any" value={s[k] as string} onChange={(e) => setS({ ...s, [k]: e.target.value })} />
          </div>
        ))}
      </div>
      <div className="space-y-1">
        {boolFields.map(([k, l]) => (
          <label key={k} className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={s[k] as boolean} onChange={(e) => setS({ ...s, [k]: e.target.checked })} /> {l}
          </label>
        ))}
      </div>
      <div className="flex items-center gap-3">
        <button className="btn-primary">שמירה</button>
        {msg && <span className="text-sm text-slate-600">{msg}</span>}
      </div>
    </form>
  );
}
