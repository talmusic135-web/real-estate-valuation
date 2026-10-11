export function DemoBanner() {
  if (process.env.DEMO_DATA_ENABLED === "false") return null;
  return (
    <div className="no-print border-b border-amber-200 bg-amber-50 px-4 py-2 text-center text-sm text-amber-900">
      <strong>סביבת הדגמה:</strong> חלק מהנתונים במערכת סינתטיים ומסומנים ״הדגמה״. הם אינם עסקאות אמיתיות ואין להציגם ללקוח.
    </div>
  );
}
