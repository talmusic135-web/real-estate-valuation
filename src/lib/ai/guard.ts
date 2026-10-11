/**
 * בקרת "אין המצאות": כל מספר משמעותי שמופיע בטקסט של מודל השפה חייב
 * להתאים למספר שקיים בגיליון העובדות (כולל ייצוגים מקובלים: אלפים, מיליונים, אחוזים).
 */
export function collectNumbers(value: unknown, out: number[] = []): number[] {
  if (typeof value === "number" && Number.isFinite(value)) out.push(value);
  else if (typeof value === "string") {
    for (const m of value.matchAll(/-?\d[\d,]*(?:\.\d+)?/g)) {
      const n = Number(m[0].replace(/,/g, ""));
      if (Number.isFinite(n)) out.push(n);
    }
  } else if (Array.isArray(value)) value.forEach((v) => collectNumbers(v, out));
  else if (value && typeof value === "object") Object.values(value).forEach((v) => collectNumbers(v, out));
  return out;
}

export interface GuardResult {
  ok: boolean;
  unsupported: number[];
}

export function verifyNumbers(text: string, facts: unknown, extraAllowed: number[] = []): GuardResult {
  const base = [...collectNumbers(facts), ...extraAllowed, new Date().getFullYear(), new Date().getFullYear() - 1];
  const allowed = new Set<number>();
  for (const n of base) {
    const a = Math.abs(n);
    allowed.add(a);
    allowed.add(Math.round(a));
    allowed.add(Math.round(a / 1000)); // אלפי ש"ח
    allowed.add(Math.round((a / 1_000_000) * 100) / 100); // מיליוני ש"ח, 2 ספרות
    allowed.add(Math.round((a / 1_000_000) * 10) / 10);
    allowed.add(Math.round(a * 100) / 100);
    allowed.add(Math.round(a * 10) / 10);
    allowed.add(Math.round(a * 100)); // שבר → אחוז
  }
  const unsupported: number[] = [];
  for (const m of text.matchAll(/\d[\d,]*(?:\.\d+)?/g)) {
    const n = Number(m[0].replace(/,/g, ""));
    if (!Number.isFinite(n) || n < 10) continue; // מספרים קטנים (חדרים, קומה) – לא נבדקים
    const ok = [...allowed].some((x) => Math.abs(x - n) <= Math.max(0.005 * Math.abs(x), 0.05));
    if (!ok) unsupported.push(n);
  }
  return { ok: unsupported.length === 0, unsupported };
}
