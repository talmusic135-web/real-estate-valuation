"use client";

import { useState } from "react";

/** ייצוא PDF: קודם בשרת (Chromium), ואם לא זמין – הדפסה לדפדפן ("שמירה כ-PDF") */
export function ReportActions({ id }: { id: string }) {
  const [state, setState] = useState<"idle" | "busy" | "fallback">("idle");
  async function exportPdf() {
    setState("busy");
    try {
      const res = await fetch(`/api/valuations/${id}/pdf`);
      if (!res.ok) throw new Error(String(res.status));
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `valuation-${id}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
      setState("idle");
    } catch {
      setState("fallback");
      window.print();
    }
  }
  return (
    <div className="no-print flex flex-wrap items-center gap-2">
      <button className="btn-primary" onClick={exportPdf} disabled={state === "busy"} data-testid="export-pdf">
        {state === "busy" ? "מפיק PDF…" : "ייצוא ל-PDF"}
      </button>
      <button className="btn-secondary" onClick={() => window.print()}>
        הדפסה
      </button>
      {state === "fallback" && <span className="text-sm text-slate-500">ייצוא בשרת לא זמין – נפתח חלון הדפסה (בחרו ״שמירה כ-PDF״).</span>}
    </div>
  );
}
