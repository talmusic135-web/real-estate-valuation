"use client";

export default function Error({ reset }: { error: Error; reset: () => void }) {
  return (
    <div className="py-20 text-center">
      <h1 className="text-xl font-bold">משהו השתבש</h1>
      <p className="mt-2 text-sm text-slate-600">השגיאה נרשמה. אפשר לנסות שוב.</p>
      <button className="btn-primary mt-4" onClick={reset}>
        ניסיון נוסף
      </button>
    </div>
  );
}
