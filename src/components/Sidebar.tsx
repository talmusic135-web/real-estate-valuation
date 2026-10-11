"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import clsx from "clsx";

const NAV = [
  { href: "/", label: "לוח בקרה", icon: "▦" },
  { href: "/valuations/new", label: "הערכת שווי חדשה", icon: "＋" },
  { href: "/valuations", label: "היסטוריית הערכות", icon: "☰" },
  { href: "/transactions", label: "עסקאות באזור", icon: "⇄" },
  { href: "/competitors", label: "נכסים מתחרים", icon: "⌂" },
  { href: "/market", label: "שכונות וניתוח שוק", icon: "↗" },
  { href: "/sources", label: "מקורות מידע", icon: "⛁" },
  { href: "/settings", label: "הגדרות", icon: "⚙" },
];

export function Sidebar({ showLogout = false }: { showLogout?: boolean }) {
  const path = usePathname();
  const [open, setOpen] = useState(false);
  if (path === "/login") return null;
  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    window.location.href = "/login";
  }
  const isActive = (href: string) =>
    href === "/" ? path === "/" : href === "/valuations" ? path === "/valuations" || /^\/valuations\/(?!new)[^/]+/.test(path) : path.startsWith(href);
  return (
    <>
      <button
        className="no-print fixed left-3 top-3 z-50 rounded-lg bg-brand-900 px-3 py-2 text-white md:hidden"
        onClick={() => setOpen(!open)}
        aria-label="תפריט"
      >
        ☰
      </button>
      <aside
        className={clsx(
          "no-print fixed inset-y-0 right-0 z-40 w-64 shrink-0 bg-brand-900 text-slate-100 transition-transform md:static md:translate-x-0",
          open ? "translate-x-0" : "translate-x-full",
        )}
      >
        <div className="border-b border-white/10 px-6 py-5">
          <div className="text-xl font-bold">ערך+</div>
          <div className="text-xs text-slate-300">הערכת שווי דירות למתווכים</div>
        </div>
        <nav className="space-y-1 p-3">
          {NAV.map((n) => (
            <Link
              key={n.href}
              href={n.href}
              onClick={() => setOpen(false)}
              className={clsx(
                "flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition",
                isActive(n.href) ? "bg-white/15 font-semibold text-white" : "text-slate-300 hover:bg-white/10 hover:text-white",
              )}
            >
              <span className="w-5 text-center" aria-hidden>
                {n.icon}
              </span>
              {n.label}
            </Link>
          ))}
        </nav>
        {showLogout && (
          <div className="p-3">
            <button onClick={logout} className="w-full rounded-lg px-3 py-2 text-right text-sm text-slate-300 hover:bg-white/10 hover:text-white">
              יציאה
            </button>
          </div>
        )}
      </aside>
    </>
  );
}
