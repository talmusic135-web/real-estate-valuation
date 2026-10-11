"use client";

import { CartesianGrid, Legend, ReferenceLine, ResponsiveContainer, Scatter, ScatterChart, Tooltip, XAxis, YAxis, LineChart, Line } from "recharts";
import type { ComparableResult } from "@/lib/valuation/types";

const fmt = (n: number) => `${Math.round(n / 1000)}K`;

/** פיזור מחיר למ״ר לאורך זמן: עסקאות מול מודעות, עם קו האומדן */
export function PriceScatter({ comps, listings, estimatePpsqm }: { comps: ComparableResult[]; listings: ComparableResult[]; estimatePpsqm: number | null }) {
  const toPt = (c: ComparableResult) => ({ x: c.date ? new Date(c.date).getTime() : 0, y: c.kind === "transaction" ? c.adjustedPricePerSqm : c.pricePerSqm, name: c.address ?? "" });
  const tx = comps.filter((c) => c.included && c.date).map(toPt);
  const ex = comps.filter((c) => !c.included && c.date).map(toPt);
  const ls = listings.filter((c) => c.date).map(toPt);
  return (
    <div dir="ltr" className="h-72 w-full">
      <ResponsiveContainer>
        <ScatterChart margin={{ top: 10, right: 20, bottom: 10, left: 10 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
          <XAxis
            dataKey="x"
            type="number"
            domain={["auto", "auto"]}
            tickFormatter={(t) => new Date(t).toLocaleDateString("he-IL", { month: "2-digit", year: "2-digit" })}
            fontSize={12}
          />
          <YAxis dataKey="y" type="number" tickFormatter={fmt} fontSize={12} domain={["auto", "auto"]} />
          <Tooltip
            formatter={(v: number, n: string) => (n === "y" ? [`${Math.round(v).toLocaleString("he-IL")} ₪`, "למ״ר"] : [new Date(v).toLocaleDateString("he-IL"), "תאריך"])}
          />
          <Legend />
          <Scatter name="עסקאות (מותאם לזמן)" data={tx} fill="#1d4ed8" />
          {ex.length > 0 && <Scatter name="עסקאות שהוצאו" data={ex} fill="#94a3b8" />}
          {ls.length > 0 && <Scatter name="מודעות (מחיר מבוקש)" data={ls} fill="#059669" shape="triangle" />}
          {estimatePpsqm && <ReferenceLine y={estimatePpsqm} stroke="#dc2626" strokeDasharray="4 4" label={{ value: "אומדן", fill: "#dc2626", fontSize: 12 }} />}
        </ScatterChart>
      </ResponsiveContainer>
    </div>
  );
}

export function TrendChart({ data }: { data: { period: string; medianPricePerSqm: number; count: number }[] }) {
  return (
    <div dir="ltr" className="h-64 w-full">
      <ResponsiveContainer>
        <LineChart data={data} margin={{ top: 10, right: 20, bottom: 10, left: 10 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
          <XAxis dataKey="period" fontSize={11} />
          <YAxis tickFormatter={fmt} fontSize={12} domain={["auto", "auto"]} />
          <Tooltip formatter={(v: number, n: string) => (n === "medianPricePerSqm" ? [`${v.toLocaleString("he-IL")} ₪`, "חציון למ״ר"] : [v, "עסקאות"])} />
          <Line type="monotone" dataKey="medianPricePerSqm" stroke="#1d4ed8" strokeWidth={2} dot={{ r: 3 }} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
