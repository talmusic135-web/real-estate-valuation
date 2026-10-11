/**
 * יצירת נתוני הדגמה סינתטיים, דטרמיניסטיים (seed קבוע).
 * כל רשומה מסומנת isDemo=true ו-sourceName="demo". לעולם לא מוצגות כעסקאות אמיתיות.
 * "האמת" הסינתטית כאן (השפעת מעלית, מצב וכו') קיימת רק כדי שיהיה עולם נתונים
 * סביר לבדיקת המערכת – המנוע עצמו אינו משתמש בפרמטרים האלה.
 */
import { DEMO_CITIES, type DemoNeighborhood, type DemoStreet } from "./gazetteer";
import { EMPTY_RECORD_FIELDS, type NormalizedRecord } from "@/lib/domain/record";

export const DEMO_SOURCE = "demo";

function mulberry32(seed: number) {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export interface DemoPriceHistory {
  sourceRecordId: string;
  points: { priceIls: number; observedAt: Date }[];
}

export function generateDemoData(now = new Date(), seed = 20261011) {
  const rnd = mulberry32(seed);
  const pick = <T,>(arr: T[]) => arr[Math.floor(rnd() * arr.length)];
  const normal = () => {
    const u = 1 - rnd();
    const v = rnd();
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
  };
  const chance = (p: number) => rnd() < p;

  const records: NormalizedRecord[] = [];
  const histories: DemoPriceHistory[] = [];
  let txId = 0;
  let lsId = 0;

  const roomsDist = [2, 2.5, 3, 3, 3.5, 3.5, 4, 4, 4, 4.5, 4.5, 5, 5, 5.5, 6];

  function makeUnit(nb: DemoNeighborhood, street: DemoStreet) {
    const rooms = pick(roomsDist);
    const areaSqm = Math.round(22 + rooms * 21 + normal() * 7);
    const buildingYear = Math.round(1955 + rnd() * 69);
    const buildingFloors = buildingYear > 1995 ? 6 + Math.floor(rnd() * 10) : 3 + Math.floor(rnd() * 5);
    const floor = Math.floor(rnd() * (buildingFloors + 1));
    let propertyType = "apartment";
    if (floor === 0 && chance(0.3)) propertyType = "garden";
    else if (floor === buildingFloors && chance(0.35)) propertyType = chance(0.6) ? "penthouse" : "roof";
    else if (chance(0.04)) propertyType = "duplex";
    const elevator = buildingFloors >= 5 ? chance(0.92) : chance(0.2);
    const age = now.getFullYear() - buildingYear;
    const condition =
      age < 4 ? "new" : chance(0.3) ? "renovated" : chance(0.6) ? "maintained" : "needs_renovation";
    const mamad = buildingYear >= 1993 ? chance(0.9) : chance(0.12);
    const parkingSpaces = buildingYear >= 1990 ? (chance(0.25) ? 2 : chance(0.85) ? 1 : 0) : chance(0.35) ? 1 : 0;
    const balcony = chance(0.75);
    const balconyAreaSqm = balcony ? Math.round(6 + rnd() * 12) : null;
    const storage = chance(0.35);

    // מיקום לאורך הרחוב
    const t = (rnd() - 0.5) * 0.006;
    const rad = (street.angle * Math.PI) / 180;
    const latitude = nb.lat + street.dLat + Math.sin(rad) * t + normal() * 0.0002;
    const longitude = nb.lng + street.dLng + Math.cos(rad) * t + normal() * 0.0002;
    const houseNumber = String(1 + Math.floor(rnd() * 120));

    // מחיר למ״ר סינתטי היום
    let mult = 1;
    if (elevator) mult *= 1.03;
    if (parkingSpaces > 0) mult *= 1.04;
    if (mamad) mult *= 1.03;
    if (condition === "new") mult *= 1.12;
    if (condition === "renovated") mult *= 1.06;
    if (condition === "needs_renovation") mult *= 0.9;
    if (propertyType === "penthouse") mult *= 1.12;
    if (propertyType === "garden") mult *= 1.05;
    mult *= 1 - Math.max(0, areaSqm - 90) * 0.0012;
    mult *= 1 + Math.min(floor, 10) * 0.006;
    const todayPpsqm = nb.basePpsqm * mult;

    return {
      rooms,
      areaSqm,
      buildingYear,
      buildingFloors,
      floor,
      propertyType,
      elevator,
      condition,
      mamad,
      parkingSpaces,
      balcony,
      balconyAreaSqm,
      storage,
      latitude: Math.round(latitude * 1e6) / 1e6,
      longitude: Math.round(longitude * 1e6) / 1e6,
      houseNumber,
      todayPpsqm,
    };
  }

  for (const city of DEMO_CITIES) {
    for (const nb of city.neighborhoods) {
      // עסקאות שהושלמו – 6 שנים אחורה
      const nTx = 110 + Math.floor(rnd() * 80);
      for (let i = 0; i < nTx; i++) {
        const street = pick(nb.streets);
        const u = makeUnit(nb, street);
        const monthsAgo = rnd() * 72;
        const date = new Date(now.getTime() - monthsAgo * 30.4375 * 86400000);
        const ppsqm = u.todayPpsqm * Math.pow(1 + city.annualTrend, -monthsAgo / 12) * Math.exp(normal() * 0.08);
        const price = Math.round((ppsqm * u.areaSqm) / 1000) * 1000;
        txId++;
        // כמו במאגר הממשלתי: חלק מהמאפיינים לא ידועים בעסקה
        const knownExtras = chance(0.55);
        records.push({
          ...EMPTY_RECORD_FIELDS,
          sourceName: DEMO_SOURCE,
          sourceRecordId: `DEMO-TX-${String(txId).padStart(5, "0")}`,
          recordType: "completed_transaction",
          isDemo: true,
          transactionDate: date,
          city: city.name,
          neighborhood: nb.name,
          street: street.name,
          houseNumber: u.houseNumber,
          address: `${street.name} ${u.houseNumber}`,
          block: String(6000 + Math.floor(rnd() * 900)),
          parcel: String(1 + Math.floor(rnd() * 300)),
          latitude: u.latitude,
          longitude: u.longitude,
          propertyType: u.propertyType,
          rooms: u.rooms,
          areaSqm: u.areaSqm,
          floor: u.floor,
          buildingFloors: u.buildingFloors,
          elevator: knownExtras ? u.elevator : null,
          balcony: knownExtras ? u.balcony : null,
          balconyAreaSqm: knownExtras ? u.balconyAreaSqm : null,
          parkingSpaces: knownExtras ? u.parkingSpaces : null,
          storage: knownExtras ? u.storage : null,
          mamad: knownExtras ? u.mamad : null,
          condition: chance(0.4) ? u.condition : null,
          buildingYear: u.buildingYear,
          transactionPriceIls: price,
          dataConfidence: 0.5,
          lastVerifiedAt: now,
          rawData: { generator: "demo-v1", note: "נתון סינתטי להדגמה בלבד" },
        });
      }

      // מודעות פעילות
      const nLs = 14 + Math.floor(rnd() * 12);
      for (let i = 0; i < nLs; i++) {
        const street = pick(nb.streets);
        const u = makeUnit(nb, street);
        const daysListed = Math.floor(rnd() * 160);
        const listingDate = new Date(now.getTime() - daysListed * 86400000);
        // מחיר מבוקש: בדרך כלל מעל מחיר העסקה
        const premium = 1.03 + rnd() * 0.09;
        const asking = Math.round((u.todayPpsqm * premium * Math.exp(normal() * 0.06) * u.areaSqm) / 10000) * 10000;
        lsId++;
        const id = `DEMO-LS-${String(lsId).padStart(5, "0")}`;
        let current = asking;
        if (daysListed > 45 && chance(0.35)) {
          const reduced = Math.round((asking * (0.95 + rnd() * 0.03)) / 10000) * 10000;
          histories.push({
            sourceRecordId: id,
            points: [
              { priceIls: asking, observedAt: listingDate },
              { priceIls: reduced, observedAt: new Date(listingDate.getTime() + Math.floor(daysListed * 0.6) * 86400000) },
            ],
          });
          current = reduced;
        }
        records.push({
          ...EMPTY_RECORD_FIELDS,
          sourceName: DEMO_SOURCE,
          sourceRecordId: id,
          recordType: "active_listing",
          isDemo: true,
          listingDate,
          lastSeenAt: now,
          city: city.name,
          neighborhood: nb.name,
          street: street.name,
          houseNumber: chance(0.5) ? u.houseNumber : null,
          address: null,
          latitude: u.latitude,
          longitude: u.longitude,
          propertyType: u.propertyType,
          rooms: u.rooms,
          areaSqm: u.areaSqm,
          floor: u.floor,
          buildingFloors: u.buildingFloors,
          elevator: u.elevator,
          balcony: u.balcony,
          balconyAreaSqm: u.balconyAreaSqm,
          parkingSpaces: u.parkingSpaces,
          storage: u.storage,
          mamad: u.mamad,
          condition: u.condition,
          buildingYear: chance(0.5) ? u.buildingYear : null,
          askingPriceIls: current,
          dataConfidence: 0.4,
          lastVerifiedAt: now,
          rawData: { generator: "demo-v1", note: "מודעה סינתטית להדגמה בלבד" },
        });
      }
    }
  }
  return { records, histories };
}
