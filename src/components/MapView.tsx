"use client";

import { useEffect, useRef } from "react";
import type { Map as LeafletMap, LayerGroup } from "leaflet";

export interface MapPoint {
  id: string;
  lat: number;
  lng: number;
  kind: "subject" | "transaction" | "listing" | "excluded";
  label: string;
}

const COLORS: Record<MapPoint["kind"], string> = {
  subject: "#dc2626",
  transaction: "#1d4ed8",
  listing: "#059669",
  excluded: "#94a3b8",
};

/**
 * מפה אינטראקטיבית (Leaflet + OpenStreetMap). כשמועבר onPick – לחיצה על
 * המפה בוחרת את מיקום הנכס.
 */
export default function MapView({
  points,
  center,
  zoom = 15,
  height = 360,
  onPick,
}: {
  points: MapPoint[];
  center?: [number, number];
  zoom?: number;
  height?: number;
  onPick?: (lat: number, lng: number) => void;
}) {
  const el = useRef<HTMLDivElement>(null);
  const map = useRef<LeafletMap | null>(null);
  const layer = useRef<LayerGroup | null>(null);
  const pickRef = useRef(onPick);
  pickRef.current = onPick;

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const L = await import("leaflet");
      if (cancelled || !el.current || map.current) return;
      const c = center ?? (points[0] ? [points[0].lat, points[0].lng] : [32.08, 34.78]);
      map.current = L.map(el.current, { scrollWheelZoom: false }).setView(c as [number, number], zoom);
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: "&copy; OpenStreetMap",
        maxZoom: 19,
      }).addTo(map.current);
      layer.current = L.layerGroup().addTo(map.current);
      map.current.on("click", (e) => pickRef.current?.(e.latlng.lat, e.latlng.lng));
      draw(L);
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    (async () => {
      const L = await import("leaflet");
      draw(L);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [points, center?.[0], center?.[1]]);

  useEffect(() => () => {
    map.current?.remove();
    map.current = null;
  }, []);

  function draw(L: typeof import("leaflet")) {
    if (!map.current || !layer.current) return;
    layer.current.clearLayers();
    for (const p of points) {
      L.circleMarker([p.lat, p.lng], {
        radius: p.kind === "subject" ? 10 : 6,
        color: "#fff",
        weight: 2,
        fillColor: COLORS[p.kind],
        fillOpacity: 0.9,
      })
        .bindTooltip(p.label, { direction: "top" })
        .addTo(layer.current);
    }
    if (center) map.current.setView(center, map.current.getZoom());
  }

  return <div ref={el} style={{ height }} className="z-0 w-full overflow-hidden rounded-lg border border-slate-200" />;
}

export function MapLegend() {
  return (
    <div className="mt-2 flex flex-wrap gap-4 text-xs text-slate-600">
      {(
        [
          ["subject", "הנכס הנבדק"],
          ["transaction", "עסקה שהושלמה"],
          ["listing", "מודעה פעילה"],
          ["excluded", "עסקה שהוצאה"],
        ] as const
      ).map(([k, l]) => (
        <span key={k} className="inline-flex items-center gap-1">
          <span className="inline-block h-3 w-3 rounded-full" style={{ background: COLORS[k] }} />
          {l}
        </span>
      ))}
    </div>
  );
}
