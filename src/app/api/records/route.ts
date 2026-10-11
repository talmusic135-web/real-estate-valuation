import { NextResponse } from "next/server";
import { z } from "zod";
import { ApiError, apiHandler } from "@/lib/api";
import { normalizeFlat, validateRecord } from "@/lib/connectors/normalize";
import { upsertRecords } from "@/lib/services/records";

const ManualRecord = z.object({
  record_type: z.enum(["completed_transaction", "active_listing"]),
  city: z.string().min(2),
  neighborhood: z.string().optional(),
  street: z.string().optional(),
  house_number: z.string().optional(),
  rooms: z.coerce.number().min(1).max(15).optional(),
  area_sqm: z.coerce.number().min(10).max(2000),
  floor: z.coerce.number().int().optional(),
  transaction_date: z.string().optional(),
  listing_date: z.string().optional(),
  transaction_price_ils: z.coerce.number().optional(),
  asking_price_ils: z.coerce.number().optional(),
  property_type: z.string().optional(),
  elevator: z.string().optional(),
  parking_spaces: z.coerce.number().int().optional(),
  source_url: z.string().url().optional().or(z.literal("")),
  note: z.string().max(500).optional(),
});

/** הוספה ידנית של עסקה/מודעה על ידי המתווך */
export const POST = apiHandler(async (req) => {
  const body = ManualRecord.parse(await req.json());
  const rec = normalizeFlat(
    { ...body, source_record_id: `MANUAL-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, data_confidence: 0.7 },
    "manual",
  );
  rec.lastVerifiedAt = new Date();
  const errors = validateRecord(rec);
  if (errors.length) throw new ApiError(errors.join(", "));
  const res = await upsertRecords([rec]);
  return NextResponse.json(res);
});
