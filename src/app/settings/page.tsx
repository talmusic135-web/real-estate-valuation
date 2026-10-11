import { SettingsForm } from "@/components/SettingsForm";
import { PageHeader } from "@/components/ui";
import { getCurrentContext } from "@/lib/services/context";
import { getAccountDefaults } from "@/lib/services/defaults";
import { ALGORITHM_VERSION, MIN_COMPARABLES_FOR_ESTIMATE, MIN_HALF_SPREAD, OUTLIER_Z } from "@/lib/valuation/engine";
import { SIMILARITY_WEIGHTS } from "@/lib/valuation/similarity";

export const dynamic = "force-dynamic";

const WEIGHT_LABELS: Record<string, string> = {
  distance: "מרחק",
  area: "שטח",
  rooms: "חדרים",
  recency: "עדכניות העסקה",
  propertyType: "סוג נכס",
  floor: "קומה",
  elevator: "מעלית",
  balcony: "מרפסת",
  parking: "חניה",
  storage: "מחסן",
  mamad: "ממ״ד",
  condition: "מצב",
};

export default async function SettingsPage() {
  const { accountId, accountName } = await getCurrentContext();
  const defaults = await getAccountDefaults(accountId);
  const aiConfigured = Boolean(process.env.ANTHROPIC_API_KEY?.trim()) && process.env.AI_PROVIDER !== "template";
  const total = Object.values(SIMILARITY_WEIGHTS).reduce((a, b) => a + b, 0);
  return (
    <>
      <PageHeader title="הגדרות" subtitle={`חשבון: ${accountName}`} />
      <section className="card">
        <h2 className="card-title">ברירות מחדל להשוואה</h2>
        <SettingsForm initial={defaults} />
      </section>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <section className="card">
          <h2 className="card-title">מנוע ההערכה</h2>
          <ul className="space-y-1 text-sm">
            <li>גרסת אלגוריתם: {ALGORITHM_VERSION}</li>
            <li>מינימום עסקאות להצגת אומדן: {MIN_COMPARABLES_FOR_ESTIMATE}</li>
            <li>סף חריגים (ציון Z חסין): {OUTLIER_Z}</li>
            <li>
              רוחב טווח מינימלי: גבוהה ±{Math.round(MIN_HALF_SPREAD.high * 100)}%, בינונית ±{Math.round(MIN_HALF_SPREAD.medium * 100)}%, נמוכה ±{Math.round(MIN_HALF_SPREAD.low * 100)}%
            </li>
          </ul>
          <h3 className="mb-1 mt-4 text-sm font-medium">משקלות ציון הדמיון (הנחות עבודה, לכיול בשלב 3)</h3>
          <table className="table">
            <tbody>
              {Object.entries(SIMILARITY_WEIGHTS).map(([k, w]) => (
                <tr key={k}>
                  <td>{WEIGHT_LABELS[k] ?? k}</td>
                  <td>{Math.round((w / total) * 100)}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
        <section className="card">
          <h2 className="card-title">בינה מלאכותית</h2>
          <p className="text-sm">
            ספק: {aiConfigured ? `Anthropic (${process.env.ANTHROPIC_MODEL || "claude-opus-5-5"})` : "סיכום מבוסס תבנית (ללא מודל שפה)"}
          </p>
          <p className="mt-2 text-sm text-slate-600">
            מודל השפה מקבל רק את גיליון העובדות של ההערכה, ותפקידו לנסח. כל מספר בטקסט שלו נבדק מול הנתונים; אם מופיע מספר שלא קיים בהם, הסיכום נדחה ומוצג סיכום תבניתי.
          </p>
          {!aiConfigured && <p className="mt-2 text-sm text-slate-600">להפעלה: הגדירו ANTHROPIC_API_KEY בשרת (לא בקוד הלקוח).</p>}
          <h2 className="card-title mt-6">משתמשים והרשאות</h2>
          <p className="text-sm text-slate-600">
            בגרסה זו יש חשבון אחד. מבנה הנתונים כבר מפריד הערכות לפי חשבון ותומך בתפקידים (מנהל, מתווך, צפייה). התחברות משתמשים תתווסף לפני עלייה לייצור.
          </p>
        </section>
      </div>
    </>
  );
}
