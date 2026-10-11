export const formatIls = (n: number | null | undefined) =>
  n === null || n === undefined ? "—" : `${Math.round(n).toLocaleString("he-IL")} ₪`;

export const formatNum = (n: number | null | undefined, digits = 0) =>
  n === null || n === undefined ? "—" : n.toLocaleString("he-IL", { maximumFractionDigits: digits });

export const formatDate = (d: string | Date | null | undefined) =>
  d ? new Date(d).toLocaleDateString("he-IL", { year: "numeric", month: "2-digit", day: "2-digit" }) : "—";

export const formatDateTime = (d: string | Date | null | undefined) =>
  d ? new Date(d).toLocaleString("he-IL", { dateStyle: "short", timeStyle: "short" }) : "—";

export const formatPct = (n: number | null | undefined) =>
  n === null || n === undefined ? "—" : `${n > 0 ? "+" : ""}${n.toLocaleString("he-IL", { maximumFractionDigits: 1 })}%`;

export const formatBool = (b: boolean | null | undefined) => (b === null || b === undefined ? "לא ידוע" : b ? "כן" : "לא");

export const formatDistance = (m: number | null | undefined) =>
  m === null || m === undefined ? "—" : m < 1000 ? `${Math.round(m)} מ׳` : `${(m / 1000).toFixed(1)} ק״מ`;
