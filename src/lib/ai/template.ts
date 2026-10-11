import type { ValuationFacts } from "./facts";

const ils = (n: number) => `${n.toLocaleString("he-IL")} ₪`;

/**
 * סיכום דטרמיניסטי בעברית – נבנה ישירות מהנתונים, ללא מודל שפה.
 * משמש כברירת מחדל כשאין מפתח API, וכגיבוי כשהבקרה דוחה טקסט של מודל.
 */
export function templateSummary(f: ValuationFacts): string {
  const p = f.property;
  const loc = [p.street, p.neighborhood, p.city].filter(Boolean).join(", ");
  const lines: string[] = [];
  if (f.usesDemoData) lines.push("⚠️ הסיכום מבוסס על נתוני הדגמה סינתטיים ואינו משקף את השוק בפועל.");

  if (f.status === "insufficient_data" || !f.estimateIls || !f.rangeIls) {
    lines.push(
      `לא נמצאו מספיק עסקאות דומות ל${p.type} של ${p.rooms} חדרים ו-${p.areaSqm} מ״ר ב${loc} (נמצאו ${f.counts.transactionsUsed}). לכן לא מוצג אומדן שווי.`,
    );
    lines.push("מומלץ להרחיב את רדיוס החיפוש, את טווח התאריכים או את טווח הסטייה בשטח ובחדרים, או להוסיף עסקאות ממקור נוסף.");
    return lines.join("\n\n");
  }

  lines.push(
    `האומדן לשווי ${p.type} של ${p.rooms} חדרים ו-${p.areaSqm} מ״ר ב${loc} הוא ${ils(f.estimateIls)}, בטווח של ${ils(f.rangeIls[0])} עד ${ils(f.rangeIls[1])} (${ils(f.pricePerSqm!)} למ״ר). רמת האמינות: ${f.confidence.level}.`,
  );
  lines.push(
    `החישוב מבוסס על ${f.counts.transactionsUsed} עסקאות שהושלמו בפועל, שנבחרו מתוך ${f.counts.passedFilters} עסקאות שעברו את הסינון. ${f.timeAdjustment.explanation}`,
  );
  if (f.comparables.length) {
    const c = f.comparables[0];
    lines.push(
      `העסקה הדומה ביותר (${c.id}): ${c.address ?? "כתובת לא ידועה"}, ${c.rooms ?? "?"} חדרים, ${c.areaSqm} מ״ר, נמכרה ב-${ils(c.priceIls)} (${ils(c.pricePerSqm)} למ״ר), ציון דמיון ${c.similarity}.`,
    );
  }
  if (f.listingsVsTransactions.gapPct !== null) {
    lines.push(
      `במודעות הפעילות הדומות (${f.counts.activeListingsFound}) המחיר המבוקש החציוני הוא ${ils(f.listingsVsTransactions.listingMedianPpsqm!)} למ״ר, ${f.listingsVsTransactions.gapPct >= 0 ? "גבוה" : "נמוך"} ב-${Math.abs(f.listingsVsTransactions.gapPct)}% מהחציון בעסקאות. מחיר מבוקש אינו מחיר מכירה.`,
    );
  }
  if (f.askingPrice) {
    lines.push(`טווח מחיר מבוקש אפשרי לפרסום: ${ils(f.askingPrice.low)} עד ${ils(f.askingPrice.high)}. זו המלצה לשיווק ואינה התחייבות למחיר המכירה.`);
  }
  if (f.drivers.length) lines.push(`גורמים שכדאי לשקול: ${f.drivers.join(" ")}`);
  if (f.anomalies.length) lines.push(`נתונים לבדיקה: ${f.anomalies.join("; ")}.`);
  return lines.join("\n\n");
}
