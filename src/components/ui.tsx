import clsx from "clsx";
import { SOURCE_LABELS } from "@/lib/connectors/connectors";
import { confidenceLabels } from "@/lib/domain/labels";

export function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: React.ReactNode; actions?: React.ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">{title}</h1>
        {subtitle && <div className="mt-1 text-sm text-slate-500">{subtitle}</div>}
      </div>
      {actions && <div className="no-print flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

export function Stat({ label, value, hint, tone }: { label: string; value: React.ReactNode; hint?: React.ReactNode; tone?: "brand" | "default" }) {
  return (
    <div className={clsx("card", tone === "brand" && "border-brand-200 bg-brand-50")}>
      <div className="text-sm text-slate-500">{label}</div>
      <div className={clsx("mt-1 text-2xl font-bold", tone === "brand" ? "text-brand-700" : "text-slate-900")}>{value}</div>
      {hint && <div className="mt-1 text-xs text-slate-500">{hint}</div>}
    </div>
  );
}

export function SourceBadge({ source, isDemo }: { source: string; isDemo?: boolean }) {
  return (
    <span
      className={clsx(
        "badge",
        isDemo ? "bg-amber-100 text-amber-800" : source === "govil_nadlan" ? "bg-emerald-100 text-emerald-800" : "bg-slate-100 text-slate-700",
      )}
      title={isDemo ? "נתון סינתטי להדגמה בלבד" : undefined}
    >
      {isDemo ? "הדגמה" : (SOURCE_LABELS[source] ?? source)}
    </span>
  );
}

export function ConfidenceBadge({ level }: { level: string }) {
  const tone =
    level === "high"
      ? "bg-emerald-100 text-emerald-800"
      : level === "medium"
        ? "bg-sky-100 text-sky-800"
        : level === "low"
          ? "bg-orange-100 text-orange-800"
          : "bg-red-100 text-red-800";
  return <span className={clsx("badge", tone)}>אמינות {confidenceLabels[level] ?? level}</span>;
}

export function StatusBadge({ status }: { status: string }) {
  const map: Record<string, [string, string]> = {
    draft: ["טיוטה", "bg-slate-100 text-slate-700"],
    completed: ["הושלמה", "bg-emerald-100 text-emerald-800"],
    insufficient_data: ["חסרים נתונים", "bg-red-100 text-red-800"],
    connected: ["מחובר", "bg-emerald-100 text-emerald-800"],
    not_configured: ["לא מחובר", "bg-slate-200 text-slate-700"],
    disabled: ["כבוי", "bg-slate-100 text-slate-500"],
    error: ["שגיאה", "bg-red-100 text-red-800"],
    success: ["הצליח", "bg-emerald-100 text-emerald-800"],
    skipped: ["דולג", "bg-slate-100 text-slate-600"],
  };
  const [label, cls] = map[status] ?? [status, "bg-slate-100 text-slate-700"];
  return <span className={clsx("badge", cls)}>{label}</span>;
}

export function Alert({ tone = "info", children }: { tone?: "info" | "warn" | "error"; children: React.ReactNode }) {
  return (
    <div
      className={clsx(
        "rounded-lg border px-4 py-3 text-sm",
        tone === "warn" && "border-amber-200 bg-amber-50 text-amber-900",
        tone === "error" && "border-red-200 bg-red-50 text-red-900",
        tone === "info" && "border-sky-200 bg-sky-50 text-sky-900",
      )}
    >
      {children}
    </div>
  );
}

export function Empty({ children }: { children: React.ReactNode }) {
  return <div className="rounded-lg border border-dashed border-slate-300 p-8 text-center text-sm text-slate-500">{children}</div>;
}
