"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

export function ValuationActions({ id, status }: { id: string; status: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  async function call(kind: "run" | "delete") {
    if (kind === "delete" && !confirm("למחוק את ההערכה? לא ניתן לשחזר.")) return;
    setBusy(kind);
    setErr(null);
    const res = await fetch(kind === "run" ? `/api/valuations/${id}/run` : `/api/valuations/${id}`, { method: kind === "run" ? "POST" : "DELETE" });
    setBusy(null);
    if (!res.ok) {
      setErr((await res.json().catch(() => ({}))).error ?? "הפעולה נכשלה");
      return;
    }
    if (kind === "delete") router.push("/valuations");
    router.refresh();
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      {status !== "draft" && (
        <Link className="btn-primary" href={`/valuations/${id}/report`}>
          דוח הערכה / PDF
        </Link>
      )}
      <Link className="btn-secondary" href={`/valuations/${id}/edit`}>
        {status === "draft" ? "עריכת טיוטה" : "שינוי נתונים והרצה כגרסה חדשה"}
      </Link>
      <button className="btn-secondary" disabled={busy !== null} onClick={() => call("run")}>
        {busy === "run" ? "מחשב…" : status === "draft" ? "הרצת הערכה" : "הרצה מחדש עם הנתונים העדכניים"}
      </button>
      <Link className="btn-secondary" href={`/competitors?valuationId=${id}`}>
        נכסים מתחרים
      </Link>
      <button className="btn-danger" disabled={busy !== null} onClick={() => call("delete")}>
        מחיקה
      </button>
      {err && <span className="text-sm text-red-700">{err}</span>}
    </div>
  );
}

export function NotesEditor({ id, initial }: { id: string; initial: string }) {
  const [value, setValue] = useState(initial);
  const [state, setState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  return (
    <div>
      <textarea className="input min-h-[90px]" value={value} onChange={(e) => (setValue(e.target.value), setState("idle"))} placeholder="הערות פנימיות של המתווך על הנכס ועל ההערכה" />
      <div className="mt-2 flex items-center gap-3">
        <button
          className="btn-secondary !py-1"
          disabled={state === "saving"}
          onClick={async () => {
            setState("saving");
            const res = await fetch(`/api/valuations/${id}/notes`, {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ brokerNotes: value }),
            });
            setState(res.ok ? "saved" : "error");
          }}
        >
          שמירת הערות
        </button>
        {state === "saved" && <span className="text-sm text-emerald-700">נשמר</span>}
        {state === "error" && <span className="text-sm text-red-700">השמירה נכשלה</span>}
      </div>
    </div>
  );
}
