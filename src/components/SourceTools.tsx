"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function CsvUpload({ cities }: { cities: string[] }) {
  const router = useRouter();
  const [format, setFormat] = useState<"flat" | "govil">("flat");
  const [city, setCity] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  async function upload() {
    if (!file) return;
    setBusy(true);
    setMsg(null);
    const csv = await file.text();
    const res = await fetch("/api/records/import", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ csv, format, city: city || undefined, fileName: file.name }),
    });
    const data = await res.json();
    setBusy(false);
    if (!res.ok) return setMsg({ ok: false, text: data.error ?? "הייבוא נכשל" });
    const rej = data.rejected as { sourceRecordId: string; errors: string[] }[];
    setMsg({
      ok: true,
      text: `נקלטו ${data.total} שורות: ${data.created} חדשות, ${data.updated} עודכנו, ${rej.length} נדחו.${rej.length ? ` לדוגמה: ${rej.slice(0, 3).map((r) => `${r.sourceRecordId} (${r.errors.join(", ")})`).join("; ")}` : ""}`,
    });
    router.refresh();
  }

  return (
    <div className="space-y-3">
      <div className="grid gap-3 md:grid-cols-3">
        <div>
          <label className="label">פורמט</label>
          <select className="input" value={format} onChange={(e) => setFormat(e.target.value as "flat" | "govil")}>
            <option value="flat">מבנה השדות האחיד של המערכת</option>
            <option value="govil">ייצוא מאתר מידע הנדל״ן הממשלתי</option>
          </select>
        </div>
        {format === "govil" && (
          <div>
            <label className="label">עיר</label>
            <input className="input" list="upload-cities" value={city} onChange={(e) => setCity(e.target.value)} />
            <datalist id="upload-cities">
              {cities.map((c) => (
                <option key={c} value={c} />
              ))}
            </datalist>
          </div>
        )}
        <div>
          <label className="label">קובץ CSV</label>
          <input className="input" type="file" accept=".csv,text/csv" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
        </div>
      </div>
      <div className="flex items-center gap-3">
        <button className="btn-primary" disabled={!file || busy} onClick={upload}>
          {busy ? "מייבא…" : "ייבוא"}
        </button>
        <a className="text-sm text-brand-600 underline" href="/sample-import.csv" download>
          קובץ לדוגמה (מבנה אחיד)
        </a>
      </div>
      {msg && <div className={msg.ok ? "text-sm text-emerald-700" : "text-sm text-red-700"}>{msg.text}</div>}
    </div>
  );
}

export function ManualRecordForm() {
  const router = useRouter();
  const [type, setType] = useState<"completed_transaction" | "active_listing">("completed_transaction");
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const body: Record<string, unknown> = { record_type: type };
    for (const [k, v] of fd.entries()) if (v !== "") body[k] = v;
    const res = await fetch("/api/records", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const data = await res.json();
    if (!res.ok) {
      setMsg({ ok: false, text: data.issues ? data.issues.map((i: { path: string; message: string }) => `${i.path}: ${i.message}`).join(", ") : data.error });
      return;
    }
    setMsg({ ok: true, text: data.rejected?.length ? `נדחה: ${data.rejected[0].errors.join(", ")}` : "הרשומה נשמרה" });
    (e.target as HTMLFormElement).reset();
    router.refresh();
  }

  const isTx = type === "completed_transaction";
  return (
    <form className="space-y-3" onSubmit={submit}>
      <div className="flex gap-4 text-sm">
        <label className="flex items-center gap-1">
          <input type="radio" checked={isTx} onChange={() => setType("completed_transaction")} /> עסקה שהושלמה
        </label>
        <label className="flex items-center gap-1">
          <input type="radio" checked={!isTx} onChange={() => setType("active_listing")} /> מודעה פעילה
        </label>
      </div>
      <div className="grid gap-3 md:grid-cols-4">
        <input className="input" name="city" placeholder="עיר *" required />
        <input className="input" name="neighborhood" placeholder="שכונה" />
        <input className="input" name="street" placeholder="רחוב" />
        <input className="input" name="house_number" placeholder="מספר בית" />
        <input className="input" name="rooms" type="number" step="0.5" placeholder="חדרים" />
        <input className="input" name="area_sqm" type="number" placeholder="שטח מ״ר *" required />
        <input className="input" name="floor" type="number" placeholder="קומה" />
        {isTx ? (
          <>
            <input className="input" name="transaction_price_ils" type="number" placeholder="מחיר עסקה ₪ *" required />
            <input className="input" name="transaction_date" type="date" required title="תאריך עסקה" />
          </>
        ) : (
          <>
            <input className="input" name="asking_price_ils" type="number" placeholder="מחיר מבוקש ₪ *" required />
            <input className="input" name="listing_date" type="date" title="תאריך פרסום" />
            <input className="input" name="source_url" type="url" placeholder="קישור למודעה" />
          </>
        )}
      </div>
      <div className="flex items-center gap-3">
        <button className="btn-primary">שמירת רשומה</button>
        {msg && <span className={msg.ok ? "text-sm text-emerald-700" : "text-sm text-red-700"}>{msg.text}</span>}
      </div>
    </form>
  );
}

export function DemoControls({ count }: { count: number }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  async function act(method: "POST" | "DELETE") {
    if (method === "DELETE" && !confirm("למחוק את כל נתוני ההדגמה? נתונים אמיתיים לא יימחקו.")) return;
    setBusy(true);
    await fetch("/api/demo/reseed", { method });
    setBusy(false);
    router.refresh();
  }
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-sm text-slate-600">{count.toLocaleString("he-IL")} רשומות הדגמה במאגר</span>
      <button className="btn-secondary !py-1" disabled={busy} onClick={() => act("POST")}>
        יצירה מחדש
      </button>
      <button className="btn-danger !py-1" disabled={busy || count === 0} onClick={() => act("DELETE")}>
        מחיקת נתוני ההדגמה
      </button>
    </div>
  );
}
