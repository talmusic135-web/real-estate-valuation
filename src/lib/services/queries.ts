import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { demoEnabled } from "./records";

export async function listCities() {
  const rows = await prisma.propertyRecord.groupBy({ by: ["city"], where: demoEnabled() ? {} : { isDemo: false }, orderBy: { city: "asc" } });
  return rows.map((r) => r.city);
}

export async function listNeighborhoods(city: string) {
  const rows = await prisma.propertyRecord.groupBy({
    by: ["neighborhood"],
    where: { city, ...(demoEnabled() ? {} : { isDemo: false }) },
    orderBy: { neighborhood: "asc" },
  });
  return rows.map((r) => r.neighborhood).filter((n): n is string => Boolean(n));
}

export interface RecordFilters {
  city?: string;
  neighborhood?: string;
  street?: string;
  roomsMin?: number;
  roomsMax?: number;
  areaMin?: number;
  areaMax?: number;
  priceMin?: number;
  priceMax?: number;
  floorMin?: number;
  floorMax?: number;
  elevator?: boolean;
  parking?: boolean;
  months?: number;
}

const n = (v: string | undefined) => (v === undefined || v === "" || Number.isNaN(Number(v)) ? undefined : Number(v));

export function parseFilters(sp: Record<string, string | undefined>): RecordFilters {
  return {
    city: sp.city || undefined,
    neighborhood: sp.neighborhood || undefined,
    street: sp.street || undefined,
    roomsMin: n(sp.roomsMin),
    roomsMax: n(sp.roomsMax),
    areaMin: n(sp.areaMin),
    areaMax: n(sp.areaMax),
    priceMin: n(sp.priceMin),
    priceMax: n(sp.priceMax),
    floorMin: n(sp.floorMin),
    floorMax: n(sp.floorMax),
    elevator: sp.elevator === "1" ? true : undefined,
    parking: sp.parking === "1" ? true : undefined,
    months: n(sp.months),
  };
}

export function buildWhere(f: RecordFilters, recordType: "completed_transaction" | "active_listing"): Prisma.PropertyRecordWhereInput {
  const priceField = recordType === "completed_transaction" ? "transactionPriceIls" : "askingPriceIls";
  const where: Prisma.PropertyRecordWhereInput = { recordType, ...(demoEnabled() ? {} : { isDemo: false }) };
  if (f.city) where.city = f.city;
  if (f.neighborhood) where.neighborhood = f.neighborhood;
  if (f.street) where.street = { contains: f.street, mode: "insensitive" };
  if (f.roomsMin !== undefined || f.roomsMax !== undefined) where.rooms = { gte: f.roomsMin, lte: f.roomsMax };
  if (f.areaMin !== undefined || f.areaMax !== undefined) where.areaSqm = { gte: f.areaMin, lte: f.areaMax };
  if (f.priceMin !== undefined || f.priceMax !== undefined) where[priceField] = { gte: f.priceMin, lte: f.priceMax };
  if (f.floorMin !== undefined || f.floorMax !== undefined) where.floor = { gte: f.floorMin, lte: f.floorMax };
  if (f.elevator) where.elevator = true;
  if (f.parking) where.parkingSpaces = { gte: 1 };
  if (f.months && recordType === "completed_transaction") {
    where.transactionDate = { gte: new Date(Date.now() - f.months * 30.4375 * 86400000) };
  }
  return where;
}
