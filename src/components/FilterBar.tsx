import type { RecordFilters } from "@/lib/services/queries";

/** טופס סינון (GET) משותף למסכי העסקאות והמתחרים */
export function FilterBar({
  cities,
  neighborhoods,
  f,
  priceLabel,
  extra,
  showMonths,
  sort,
  sortOptions,
}: {
  cities: string[];
  neighborhoods: string[];
  f: RecordFilters;
  priceLabel: string;
  extra?: React.ReactNode;
  showMonths?: boolean;
  sort?: string;
  sortOptions: [string, string][];
}) {
  const num = (name: keyof RecordFilters, placeholder: string) => (
    <input className="input" name={name} type="number" placeholder={placeholder} defaultValue={(f[name] as number | undefined) ?? ""} />
  );
  return (
    <form className="card mb-4 grid gap-3 md:grid-cols-6" data-testid="filters">
      {extra}
      <div>
        <label className="label">עיר</label>
        <select className="input" name="city" defaultValue={f.city ?? ""}>
          <option value="">בחרו עיר</option>
          {cities.map((c) => (
            <option key={c}>{c}</option>
          ))}
        </select>
      </div>
      <div>
        <label className="label">שכונה</label>
        <select className="input" name="neighborhood" defaultValue={f.neighborhood ?? ""}>
          <option value="">כל השכונות</option>
          {neighborhoods.map((c) => (
            <option key={c}>{c}</option>
          ))}
        </select>
      </div>
      <div>
        <label className="label">רחוב</label>
        <input className="input" name="street" defaultValue={f.street ?? ""} />
      </div>
      <div>
        <label className="label">חדרים</label>
        <div className="flex gap-1">
          {num("roomsMin", "מ-")}
          {num("roomsMax", "עד")}
        </div>
      </div>
      <div>
        <label className="label">שטח (מ״ר)</label>
        <div className="flex gap-1">
          {num("areaMin", "מ-")}
          {num("areaMax", "עד")}
        </div>
      </div>
      <div>
        <label className="label">{priceLabel} (₪)</label>
        <div className="flex gap-1">
          {num("priceMin", "מ-")}
          {num("priceMax", "עד")}
        </div>
      </div>
      <div>
        <label className="label">קומה</label>
        <div className="flex gap-1">
          {num("floorMin", "מ-")}
          {num("floorMax", "עד")}
        </div>
      </div>
      {showMonths && (
        <div>
          <label className="label">תקופה</label>
          <select className="input" name="months" defaultValue={String(f.months ?? 24)}>
            {[6, 12, 24, 36, 60].map((m) => (
              <option key={m} value={m}>
                {m} חודשים אחרונים
              </option>
            ))}
          </select>
        </div>
      )}
      <div>
        <label className="label">מיון</label>
        <select className="input" name="sort" defaultValue={sort}>
          {sortOptions.map(([v, l]) => (
            <option key={v} value={v}>
              {l}
            </option>
          ))}
        </select>
      </div>
      <div className="flex items-end gap-3 text-sm">
        <label className="flex items-center gap-1">
          <input type="checkbox" name="elevator" value="1" defaultChecked={f.elevator} /> מעלית
        </label>
        <label className="flex items-center gap-1">
          <input type="checkbox" name="parking" value="1" defaultChecked={f.parking} /> חניה
        </label>
      </div>
      <div className="flex items-end">
        <button className="btn-primary w-full">הצגה</button>
      </div>
    </form>
  );
}
