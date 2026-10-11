// פונקציות סטטיסטיות שקופות. אין כאן "קסם": הכל ניתן לבדיקה ידנית.

export function median(values: number[]): number {
  if (values.length === 0) return NaN;
  const s = [...values].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

/**
 * קוונטיל משוקלל (אינטרפולציה על פני משקל מצטבר בנקודות האמצע).
 * q=0.5 נותן חציון משוקלל.
 */
export function weightedQuantile(values: number[], weights: number[], q: number): number {
  if (values.length === 0) return NaN;
  if (values.length !== weights.length) throw new Error("values/weights length mismatch");
  const pairs = values.map((v, i) => ({ v, w: Math.max(0, weights[i]) })).sort((a, b) => a.v - b.v);
  const total = pairs.reduce((s, p) => s + p.w, 0);
  if (total === 0) return median(values);
  let cum = 0;
  const points = pairs.map((p) => {
    const center = (cum + p.w / 2) / total;
    cum += p.w;
    return { v: p.v, c: center };
  });
  if (q <= points[0].c) return points[0].v;
  if (q >= points[points.length - 1].c) return points[points.length - 1].v;
  for (let i = 1; i < points.length; i++) {
    if (q <= points[i].c) {
      const a = points[i - 1];
      const b = points[i];
      const t = (q - a.c) / (b.c - a.c || 1);
      return a.v + t * (b.v - a.v);
    }
  }
  return points[points.length - 1].v;
}

export function weightedMean(values: number[], weights: number[]): number {
  const tw = weights.reduce((s, w) => s + w, 0);
  if (tw === 0) return NaN;
  return values.reduce((s, v, i) => s + v * weights[i], 0) / tw;
}

/** גודל מדגם אפקטיבי (Kish): כמה תצפיות "שוות ערך" יש בפועל אחרי שקלול */
export function effectiveSampleSize(weights: number[]): number {
  const s = weights.reduce((a, b) => a + b, 0);
  const s2 = weights.reduce((a, b) => a + b * b, 0);
  return s2 === 0 ? 0 : (s * s) / s2;
}

/** סטיית חציון מוחלטת (MAD), מנורמלת לסטיית תקן בהתפלגות נורמלית */
export function mad(values: number[]): number {
  const m = median(values);
  return 1.4826 * median(values.map((v) => Math.abs(v - m)));
}

/** ציון Z חסין לחריגים. |z|>3.5 נחשב חריג (Iglewicz & Hoaglin) */
export function robustZScores(values: number[]): number[] {
  const m = median(values);
  const d = mad(values);
  if (!d) return values.map(() => 0);
  return values.map((v) => (v - m) / d);
}

/** רגרסיה ליניארית פשוטה y = a + b·x, כולל שגיאת תקן של השיפוע */
export function linearRegression(xs: number[], ys: number[]) {
  const n = xs.length;
  if (n < 3) return null;
  const mx = xs.reduce((a, b) => a + b, 0) / n;
  const my = ys.reduce((a, b) => a + b, 0) / n;
  let sxx = 0;
  let sxy = 0;
  for (let i = 0; i < n; i++) {
    sxx += (xs[i] - mx) ** 2;
    sxy += (xs[i] - mx) * (ys[i] - my);
  }
  if (sxx === 0) return null;
  const slope = sxy / sxx;
  const intercept = my - slope * mx;
  let sse = 0;
  for (let i = 0; i < n; i++) sse += (ys[i] - (intercept + slope * xs[i])) ** 2;
  const slopeSe = Math.sqrt(sse / (n - 2) / sxx);
  return { slope, intercept, slopeSe, n };
}

export function roundTo(value: number, step: number): number {
  return Math.round(value / step) * step;
}

export function clamp(v: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, v));
}
