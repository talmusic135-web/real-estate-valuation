"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";

/** בחירת שתי הערכות מהטבלה והשוואה ביניהן */
export function CompareSelector({ children }: { children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const router = useRouter();
  const [count, setCount] = useState(0);
  const selected = () => [...(ref.current?.querySelectorAll<HTMLInputElement>("input[name=compare]:checked") ?? [])].map((i) => i.value);
  return (
    <div ref={ref} onChange={() => setCount(selected().length)}>
      <div className="no-print mb-3 flex items-center gap-3 text-sm">
        <button
          className="btn-secondary"
          disabled={count !== 2}
          onClick={() => {
            const [a, b] = selected();
            router.push(`/valuations/compare?a=${a}&b=${b}`);
          }}
        >
          השוואת שתי הערכות
        </button>
        <span className="text-slate-500">{count === 2 ? "מוכן להשוואה" : `בחרו 2 הערכות (נבחרו ${count})`}</span>
      </div>
      {children}
    </div>
  );
}
