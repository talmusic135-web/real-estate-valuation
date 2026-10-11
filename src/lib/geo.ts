/** מרחק במטרים בין שתי נקודות (נוסחת Haversine) */
export function distanceMeters(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

/** השוואת שמות רחוב/שכונה חסינה לרווחים, גרשיים ומקפים */
export function normalizeName(s: string | null | undefined): string {
  return (s ?? "")
    .replace(/["'״׳`]/g, "")
    .replace(/[-–—]/g, " ")
    .replace(/^(רחוב|רח|שדרות|שד)\s+/, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

export function sameName(a: string | null | undefined, b: string | null | undefined): boolean {
  const na = normalizeName(a);
  return na !== "" && na === normalizeName(b);
}
