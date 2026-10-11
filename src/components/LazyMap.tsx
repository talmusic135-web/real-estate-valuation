"use client";

import dynamic from "next/dynamic";

/** טעינת המפה בצד הלקוח בלבד (Leaflet דורש window) */
export const LazyMap = dynamic(() => import("./MapView"), {
  ssr: false,
  loading: () => <div className="h-[360px] w-full animate-pulse rounded-lg bg-slate-100" />,
});
