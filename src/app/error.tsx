"use client";

export default function Error({ reset }: { error: Error; reset: () => void }) {
  return (
    <div className="py-20 text-center">
      <h1 className="text-xl font-bold">משהו השתבש</h1>
      <p className="mt-2 text-sm text-slate-600">השגיאה נרשמה. אפשר לנסות שוב.</p>
      <p className="mt-1 text-xs text-slate-500">אם זו הפעלה ראשונה של האתר, ודאו שמסד הנתונים מחובר (ראו מדריך ההפעלה).</p>
      <button className="btn-primary mt-4" onClick={reset}>
        ניסיון נוסף
      </button>
    </div>
  );
}
