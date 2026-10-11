import { z } from "zod";

/** ערך תלת-מצבי: כן / לא / לא ידוע. "לא ידוע" נשמר כ-null ולא מנוחש. */
export const TriState = z.enum(["yes", "no", "unknown"]);
export type TriState = z.infer<typeof TriState>;

export const PropertyType = z.enum(["apartment", "garden", "penthouse", "duplex", "roof", "other"]);
export type PropertyType = z.infer<typeof PropertyType>;

export const Condition = z.enum(["new", "renovated", "maintained", "needs_renovation", "unknown"]);
export type Condition = z.infer<typeof Condition>;

export const Parking = z.enum(["none", "one", "two_plus", "unknown"]);
export type Parking = z.infer<typeof Parking>;

export const AirDirection = z.enum(["north", "south", "east", "west"]);

const optionalNumber = (min: number, max: number) =>
  z.preprocess(
    (v) => (v === "" || v === null || v === undefined || Number.isNaN(v) ? undefined : Number(v)),
    z.number().min(min).max(max).optional(),
  );

const optionalString = z.preprocess(
  (v) => (typeof v === "string" && v.trim() === "" ? undefined : typeof v === "string" ? v.trim() : v),
  z.string().max(200).optional(),
);

export const LocationSchema = z.object({
  city: z.string().trim().min(2, "יש לבחור עיר").max(80),
  neighborhood: optionalString,
  street: optionalString,
  houseNumber: optionalString,
  address: optionalString,
  latitude: optionalNumber(29, 34),
  longitude: optionalNumber(34, 36),
  block: optionalString,
  parcel: optionalString,
});

export const PropertySchema = z.object({
  propertyType: PropertyType,
  rooms: z.coerce
    .number({ invalid_type_error: "יש להזין מספר חדרים" })
    .min(1, "מינימום חדר אחד")
    .max(12)
    .refine((n) => Number.isInteger(n * 2), "מספר חדרים בקפיצות של חצי חדר"),
  areaSqm: z.coerce.number({ invalid_type_error: "יש להזין שטח" }).min(15, "שטח קטן מדי").max(1000),
  floor: optionalNumber(-2, 80),
  buildingFloors: optionalNumber(1, 80),
  elevator: TriState.default("unknown"),
  balcony: TriState.default("unknown"),
  balconyAreaSqm: optionalNumber(0, 300),
  parking: Parking.default("unknown"),
  storage: TriState.default("unknown"),
  mamad: TriState.default("unknown"),
  condition: Condition.default("unknown"),
  buildingAge: optionalNumber(0, 150),
  accessibility: TriState.default("unknown"),
  airDirections: z.array(AirDirection).default([]),
  viewAndAdvantages: optionalString,
  urbanRenewal: optionalString,
});

export const SettingsSchema = z.object({
  dateRangeMonths: z.coerce.number().int().min(3).max(120).default(36),
  maxComparables: z.coerce.number().int().min(3).max(40).default(12),
  radiusM: z.coerce.number().int().min(100).max(10000).default(500),
  roomsTolerance: z.coerce.number().min(0).max(3).default(1),
  areaTolerancePct: z.coerce.number().min(5).max(60).default(25),
  includeAdjacentNeighborhoods: z.boolean().default(true),
  includeActiveListings: z.boolean().default(true),
  includeOlderIfInsufficient: z.boolean().default(true),
});

export const ValuationInputSchema = z.object({
  location: LocationSchema,
  property: PropertySchema,
  settings: SettingsSchema,
});

export type LocationInput = z.infer<typeof LocationSchema>;
export type PropertyInput = z.infer<typeof PropertySchema>;
export type SettingsInput = z.infer<typeof SettingsSchema>;
export type ValuationInput = z.infer<typeof ValuationInputSchema>;

export const SaveValuationSchema = z.object({
  title: z.string().trim().max(120).optional(),
  input: ValuationInputSchema,
  brokerNotes: z.string().max(5000).optional(),
  /** draft = שמירת טיוטה בלבד, run = שמירה והרצת הערכה */
  action: z.enum(["draft", "run"]),
  parentId: z.string().optional(),
});

export const DEFAULT_SETTINGS: SettingsInput = SettingsSchema.parse({});
