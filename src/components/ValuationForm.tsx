"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { ValuationInput } from "@/lib/domain/schema";
import {
  airDirectionLabels,
  conditionLabels,
  parkingLabels,
  propertyTypeLabels,
  radiusOptions,
  triLabels,
} from "@/lib/domain/labels";
import { LazyMap } from "./LazyMap";
import { MapLegend } from "./MapView";
import { DEMO_CITIES } from "@/lib/demo/gazetteer";

type Mode = { kind: "new" } | { kind: "edit-draft"; id: string } | { kind: "new-version"; parentId: string };

interface FormState {
  title: string;
  brokerNotes: string;
  location: Record<string, string>;
  property: Record<string, string | string[]>;
  settings: Record<string, string | boolean>;
}

function toState(input: ValuationInput | null, defaults: ValuationInput["settings"], title = "", notes = ""): FormState {
  const str = (v: unknown) => (v === undefined || v === null ? "" : String(v));
  const loc = input?.location;
  const p = input?.property;
  const s = input?.settings ?? defaults;
  return {
    title,
    brokerNotes: notes,
    location: {
      city: str(loc?.city),
      neighborhood: str(loc?.neighborhood),
      street: str(loc?.street),
      houseNumber: str(loc?.houseNumber),
      address: str(loc?.address),
      latitude: str(loc?.latitude),
      longitude: str(loc?.longitude),
      block: str(loc?.block),
      parcel: str(loc?.parcel),
    },
    property: {
      propertyType: p?.propertyType ?? "apartment",
      rooms: str(p?.rooms ?? ""),
      areaSqm: str(p?.areaSqm ?? ""),
      floor: str(p?.floor),
      buildingFloors: str(p?.buildingFloors),
      elevator: p?.elevator ?? "unknown",
      balcony: p?.balcony ?? "unknown",
      balconyAreaSqm: str(p?.balconyAreaSqm),
      parking: p?.parking ?? "unknown",
      storage: p?.storage ?? "unknown",
      mamad: p?.mamad ?? "unknown",
      condition: p?.condition ?? "unknown",
      buildingAge: str(p?.buildingAge),
      accessibility: p?.accessibility ?? "unknown",
      airDirections: p?.airDirections ?? [],
      viewAndAdvantages: str(p?.viewAndAdvantages),
      urbanRenewal: str(p?.urbanRenewal),
    },
    settings: {
      dateRangeMonths: str(s.dateRangeMonths),
      maxComparables: str(s.maxComparables),
      radiusM: str(s.radiusM),
      roomsTolerance: str(s.roomsTolerance),
      areaTolerancePct: str(s.areaTolerancePct),
      includeAdjacentNeighborhoods: s.includeAdjacentNeighborhoods,
      includeActiveListings: s.includeActiveListings,
      includeOlderIfInsufficient: s.includeOlderIfInsufficient,
    },
  };
}

function toPayload(f: FormState) {
  const num = (v: unknown) => (v === "" || v === undefined ? undefined : Number(v));
  return {
    location: {
      ...f.location,
      latitude: num(f.location.latitude),
      longitude: num(f.location.longitude),
    },
    property: {
      ...f.property,
      rooms: num(f.property.rooms),
      areaSqm: num(f.property.areaSqm),
      floor: num(f.property.floor),
      buildingFloors: num(f.property.buildingFloors),
      balconyAreaSqm: num(f.property.balconyAreaSqm),
      buildingAge: num(f.property.buildingAge),
    },
    settings: {
      ...f.settings,
      dateRangeMonths: num(f.settings.dateRangeMonths),
      maxComparables: num(f.settings.maxComparables),
      radiusM: num(f.settings.radiusM),
      roomsTolerance: num(f.settings.roomsTolerance),
      areaTolerancePct: num(f.settings.areaTolerancePct),
    },
  };
}

function Field({ label, hint, children, error }: { label: string; hint?: string; children: React.ReactNode; error?: string }) {
  return (
    <div>
      <label className="label">{label}</label>
      {children}
      {hint && !error && <p className="mt-1 text-xs text-slate-500">{hint}</p>}
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
    </div>
  );
}

export function ValuationForm({
  initial,
  defaults,
  mode,
  initialTitle,
  initialNotes,
}: {
  initial: ValuationInput | null;
  defaults: ValuationInput["settings"];
  mode: Mode;
  initialTitle?: string;
  initialNotes?: string;
}) {
  const router = useRouter();
  const [f, setF] = useState<FormState>(() => toState(initial, defaults, initialTitle, initialNotes));
  const [busy, setBusy] = useState<"draft" | "run" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [lookup, setLookup] = useState<{ cities: string[]; neighborhoods: string[]; streets: string[]; streetsByNeighborhood?: Record<string, string[]> }>({
    cities: [],
    neighborhoods: [],
    streets: [],
  });
  const [customRadius, setCustomRadius] = useState(
    () => !radiusOptions.some((o) => String(o.value) === String(initial?.settings.radiusM ?? defaults.radiusM)),
  );

  const city = f.location.city;
  useEffect(() => {
    const ctrl = new AbortController();
    fetch(`/api/lookup${city ? `?city=${encodeURIComponent(city)}` : ""}`, { signal: ctrl.signal })
      .then((r) => r.json())
      .then(setLookup)
      .catch(() => {});
    return () => ctrl.abort();
  }, [city]);

  const streetOptions = useMemo(() => {
    const nb = f.location.neighborhood;
    return (nb && lookup.streetsByNeighborhood?.[nb]) || lookup.streets;
  }, [lookup, f.location.neighborhood]);

  const setLoc = (k: string, v: string) => setF((s) => ({ ...s, location: { ...s.location, [k]: v } }));
  const setProp = (k: string, v: string | string[]) => setF((s) => ({ ...s, property: { ...s.property, [k]: v } }));
  const setSet = (k: string, v: string | boolean) => setF((s) => ({ ...s, settings: { ...s.settings, [k]: v } }));

  const lat = Number(f.location.latitude);
  const lng = Number(f.location.longitude);
  const cityMatch = DEMO_CITIES.find((c) => c.name === f.location.city.trim());
  const cityCenter: [number, number] | undefined = cityMatch ? [cityMatch.lat, cityMatch.lng] : undefined;
  const hasPoint = f.location.latitude !== "" && f.location.longitude !== "" && !Number.isNaN(lat) && !Number.isNaN(lng);

  async function submit(action: "draft" | "run") {
    setBusy(action);
    setError(null);
    setFieldErrors({});
    const body = {
      action,
      title: f.title || undefined,
      brokerNotes: f.brokerNotes || undefined,
      input: toPayload(f),
      parentId: mode.kind === "new-version" ? mode.parentId : undefined,
    };
    try {
      const res = await fetch(mode.kind === "edit-draft" ? `/api/valuations/${mode.id}` : "/api/valuations", {
        method: mode.kind === "edit-draft" ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) {
        if (data.issues) {
          const fe: Record<string, string> = {};
          for (const i of data.issues as { path: string; message: string }[]) fe[i.path.replace(/^input\./, "")] = i.message;
          setFieldErrors(fe);
        }
        setError(data.error ?? "שמירה נכשלה");
        return;
      }
      router.push(`/valuations/${data.id}`);
      router.refresh();
    } catch {
      setError("אין חיבור לשרת. נסו שוב.");
    } finally {
      setBusy(null);
    }
  }

  const tri = (key: string, label: string) => (
    <Field label={label}>
      <select className="input" value={f.property[key] as string} onChange={(e) => setProp(key, e.target.value)} name={key}>
        {Object.entries(triLabels).map(([v, l]) => (
          <option key={v} value={v}>
            {l}
          </option>
        ))}
      </select>
    </Field>
  );

  return (
    <form
      className="space-y-6"
      onSubmit={(e) => {
        e.preventDefault();
        submit("run");
      }}
    >
      {error && (
        <div role="alert" className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {error}
          {Object.keys(fieldErrors).length > 0 && (
            <ul className="mt-1 list-disc pr-5">
              {Object.entries(fieldErrors).map(([k, v]) => (
                <li key={k}>{v}</li>
              ))}
            </ul>
          )}
        </div>
      )}

      <section className="card">
        <h2 className="card-title">מיקום</h2>
        <div className="grid gap-4 md:grid-cols-3">
          <Field label="עיר *" error={fieldErrors["location.city"]}>
            <input className="input" list="cities" name="city" value={f.location.city} onChange={(e) => setLoc("city", e.target.value)} required />
            <datalist id="cities">
              {lookup.cities.map((c) => (
                <option key={c} value={c} />
              ))}
            </datalist>
          </Field>
          <Field label="שכונה">
            <input className="input" list="neighborhoods" name="neighborhood" value={f.location.neighborhood} onChange={(e) => setLoc("neighborhood", e.target.value)} />
            <datalist id="neighborhoods">
              {lookup.neighborhoods.map((c) => (
                <option key={c} value={c} />
              ))}
            </datalist>
          </Field>
          <Field label="רחוב">
            <input className="input" list="streets" name="street" value={f.location.street} onChange={(e) => setLoc("street", e.target.value)} />
            <datalist id="streets">
              {streetOptions.map((c) => (
                <option key={c} value={c} />
              ))}
            </datalist>
          </Field>
          <Field label="מספר בית">
            <input className="input" name="houseNumber" value={f.location.houseNumber} onChange={(e) => setLoc("houseNumber", e.target.value)} />
          </Field>
          <Field label="גוש">
            <input className="input" name="block" inputMode="numeric" value={f.location.block} onChange={(e) => setLoc("block", e.target.value)} />
          </Field>
          <Field label="חלקה">
            <input className="input" name="parcel" inputMode="numeric" value={f.location.parcel} onChange={(e) => setLoc("parcel", e.target.value)} />
          </Field>
          <div className="md:col-span-3">
            <Field label="כתובת חופשית / הערת מיקום">
              <input className="input" name="address" value={f.location.address} onChange={(e) => setLoc("address", e.target.value)} />
            </Field>
          </div>
        </div>
        <div className="mt-4">
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2 text-sm">
            <span className="text-slate-600">
              {hasPoint ? (
                <>
                  מיקום שנבחר: <span className="ltr">{lat.toFixed(5)}, {lng.toFixed(5)}</span>
                </>
              ) : (
                "לחצו על המפה כדי לסמן את מיקום הנכס (לא חובה – אחרת המיקום ישוער לפי הרחוב/השכונה)"
              )}
            </span>
            {hasPoint && (
              <button
                type="button"
                className="btn-secondary !py-1"
                onClick={() => setF((s) => ({ ...s, location: { ...s.location, latitude: "", longitude: "" } }))}
              >
                ניקוי מיקום
              </button>
            )}
          </div>
          <LazyMap
            height={280}
            zoom={hasPoint ? 16 : 13}
            center={hasPoint ? [lat, lng] : cityCenter}
            points={hasPoint ? [{ id: "s", lat, lng, kind: "subject", label: "הנכס הנבדק" }] : []}
            onPick={(la, ln) =>
              setF((s) => ({ ...s, location: { ...s.location, latitude: la.toFixed(6), longitude: ln.toFixed(6) } }))
            }
          />
          <MapLegend />
        </div>
      </section>

      <section className="card">
        <h2 className="card-title">מאפייני הדירה</h2>
        <div className="grid gap-4 md:grid-cols-4">
          <Field label="סוג נכס *">
            <select className="input" name="propertyType" value={f.property.propertyType as string} onChange={(e) => setProp("propertyType", e.target.value)}>
              {Object.entries(propertyTypeLabels).map(([v, l]) => (
                <option key={v} value={v}>
                  {l}
                </option>
              ))}
            </select>
          </Field>
          <Field label="מספר חדרים *" error={fieldErrors["property.rooms"]}>
            <input className="input" name="rooms" type="number" step="0.5" min="1" max="12" value={f.property.rooms as string} onChange={(e) => setProp("rooms", e.target.value)} required />
          </Field>
          <Field label="שטח במ״ר *" error={fieldErrors["property.areaSqm"]}>
            <input className="input" name="areaSqm" type="number" min="15" max="1000" value={f.property.areaSqm as string} onChange={(e) => setProp("areaSqm", e.target.value)} required />
          </Field>
          <Field label="מצב הנכס">
            <select className="input" name="condition" value={f.property.condition as string} onChange={(e) => setProp("condition", e.target.value)}>
              {Object.entries(conditionLabels).map(([v, l]) => (
                <option key={v} value={v}>
                  {l}
                </option>
              ))}
            </select>
          </Field>
          <Field label="קומה">
            <input className="input" name="floor" type="number" min="-2" max="80" value={f.property.floor as string} onChange={(e) => setProp("floor", e.target.value)} />
          </Field>
          <Field label="מספר קומות בבניין">
            <input className="input" name="buildingFloors" type="number" min="1" max="80" value={f.property.buildingFloors as string} onChange={(e) => setProp("buildingFloors", e.target.value)} />
          </Field>
          <Field label="גיל הבניין (שנים)">
            <input className="input" name="buildingAge" type="number" min="0" max="150" value={f.property.buildingAge as string} onChange={(e) => setProp("buildingAge", e.target.value)} />
          </Field>
          <Field label="חניה">
            <select className="input" name="parking" value={f.property.parking as string} onChange={(e) => setProp("parking", e.target.value)}>
              {Object.entries(parkingLabels).map(([v, l]) => (
                <option key={v} value={v}>
                  {l}
                </option>
              ))}
            </select>
          </Field>
          {tri("elevator", "מעלית")}
          {tri("balcony", "מרפסת")}
          <Field label="שטח מרפסת במ״ר">
            <input
              className="input"
              name="balconyAreaSqm"
              type="number"
              min="0"
              disabled={f.property.balcony === "no"}
              value={f.property.balconyAreaSqm as string}
              onChange={(e) => setProp("balconyAreaSqm", e.target.value)}
            />
          </Field>
          {tri("storage", "מחסן")}
          {tri("mamad", "ממ״ד")}
          {tri("accessibility", "נגישות")}
          <div className="md:col-span-2">
            <label className="label">כיווני אוויר</label>
            <div className="flex flex-wrap gap-3 pt-1">
              {Object.entries(airDirectionLabels).map(([v, l]) => {
                const arr = f.property.airDirections as string[];
                return (
                  <label key={v} className="inline-flex items-center gap-1 text-sm">
                    <input
                      type="checkbox"
                      checked={arr.includes(v)}
                      onChange={(e) => setProp("airDirections", e.target.checked ? [...arr, v] : arr.filter((x) => x !== v))}
                    />
                    {l}
                  </label>
                );
              })}
            </div>
          </div>
          <div className="md:col-span-2">
            <Field label="נוף ויתרונות מיוחדים">
              <input className="input" name="viewAndAdvantages" value={f.property.viewAndAdvantages as string} onChange={(e) => setProp("viewAndAdvantages", e.target.value)} />
            </Field>
          </div>
          <div className="md:col-span-2">
            <Field label="התחדשות עירונית (רק מידע ציבורי אמין)" hint="למשל: תמ״א 38 מאושרת, פינוי-בינוי בתכנון, עם מקור">
              <input className="input" name="urbanRenewal" value={f.property.urbanRenewal as string} onChange={(e) => setProp("urbanRenewal", e.target.value)} />
            </Field>
          </div>
        </div>
      </section>

      <section className="card">
        <h2 className="card-title">הגדרות השוואה</h2>
        <div className="grid gap-4 md:grid-cols-4">
          <Field label="טווח תאריכים לעסקאות">
            <select className="input" name="dateRangeMonths" value={f.settings.dateRangeMonths as string} onChange={(e) => setSet("dateRangeMonths", e.target.value)}>
              {[6, 12, 24, 36, 48, 60].map((m) => (
                <option key={m} value={m}>
                  {m >= 12 ? `${m / 12} ${m === 12 ? "שנה" : "שנים"} אחרונות` : `${m} חודשים אחרונים`}
                </option>
              ))}
            </select>
          </Field>
          <Field label="רדיוס חיפוש">
            <select
              className="input"
              name="radiusSelect"
              value={customRadius ? "custom" : (f.settings.radiusM as string)}
              onChange={(e) => {
                if (e.target.value === "custom") setCustomRadius(true);
                else {
                  setCustomRadius(false);
                  setSet("radiusM", e.target.value);
                }
              }}
            >
              {radiusOptions.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
              <option value="custom">מותאם אישית</option>
            </select>
            {customRadius && (
              <input
                className="input mt-2"
                name="radiusM"
                type="number"
                min="100"
                max="10000"
                placeholder="מטרים"
                value={f.settings.radiusM as string}
                onChange={(e) => setSet("radiusM", e.target.value)}
              />
            )}
          </Field>
          <Field label="מספר נכסים להשוואה">
            <input className="input" name="maxComparables" type="number" min="3" max="40" value={f.settings.maxComparables as string} onChange={(e) => setSet("maxComparables", e.target.value)} />
          </Field>
          <Field label="סטייה מותרת בחדרים (±)">
            <select className="input" name="roomsTolerance" value={f.settings.roomsTolerance as string} onChange={(e) => setSet("roomsTolerance", e.target.value)}>
              {["0", "0.5", "1", "1.5", "2"].map((v) => (
                <option key={v} value={v}>
                  {v}
                </option>
              ))}
            </select>
          </Field>
          <Field label="סטייה מותרת בשטח (±%)">
            <input className="input" name="areaTolerancePct" type="number" min="5" max="60" value={f.settings.areaTolerancePct as string} onChange={(e) => setSet("areaTolerancePct", e.target.value)} />
          </Field>
          <div className="space-y-2 md:col-span-3">
            {(
              [
                ["includeAdjacentNeighborhoods", "לכלול נכסים בשכונות סמוכות"],
                ["includeActiveListings", "לכלול מודעות פעילות (לניתוח מתחרים בלבד)"],
                ["includeOlderIfInsufficient", "לכלול עסקאות ישנות יותר כשחסרות עסקאות חדשות"],
              ] as const
            ).map(([k, l]) => (
              <label key={k} className="flex items-center gap-2 text-sm">
                <input type="checkbox" name={k} checked={Boolean(f.settings[k])} onChange={(e) => setSet(k, e.target.checked)} />
                {l}
              </label>
            ))}
          </div>
        </div>
      </section>

      <section className="card">
        <h2 className="card-title">פרטים לשמירה</h2>
        <div className="grid gap-4 md:grid-cols-2">
          <Field label="שם ההערכה" hint="ריק = ייווצר אוטומטית מהכתובת">
            <input className="input" name="title" value={f.title} onChange={(e) => setF((s) => ({ ...s, title: e.target.value }))} />
          </Field>
          <Field label="הערות המתווך">
            <textarea className="input min-h-[42px]" name="brokerNotes" value={f.brokerNotes} onChange={(e) => setF((s) => ({ ...s, brokerNotes: e.target.value }))} />
          </Field>
        </div>
      </section>

      <div className="sticky bottom-0 z-10 -mx-4 flex flex-wrap gap-3 border-t border-slate-200 bg-white/95 px-4 py-3 backdrop-blur md:mx-0 md:rounded-xl md:border">
        <button type="submit" className="btn-primary" disabled={busy !== null}>
          {busy === "run" ? "מחשב הערכה…" : mode.kind === "new-version" ? "הרצת הערכה כגרסה חדשה" : "הרצת הערכת שווי"}
        </button>
        <button type="button" className="btn-secondary" disabled={busy !== null} onClick={() => submit("draft")}>
          {busy === "draft" ? "שומר…" : "שמירת טיוטה"}
        </button>
      </div>
    </form>
  );
}
