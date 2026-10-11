import { NextResponse } from "next/server";
import { z } from "zod";
import { ApiError, apiHandler } from "@/lib/api";
import { normalizeFlat, normalizeGovIl } from "@/lib/connectors/normalize";
import { parseCsv } from "@/lib/csv";
import { prisma } from "@/lib/db";
import { upsertRecords } from "@/lib/services/records";

const Body = z.object({
  csv: z.string().min(10).max(10_000_000),
  format: z.enum(["flat", "govil"]),
  city: z.string().optional(),
  fileName: z.string().max(200).optional(),
});

/** ייבוא קובץ CSV: במבנה האחיד או בפורמט המאגר הממשלתי */
export const POST = apiHandler(async (req) => {
  const body = Body.parse(await req.json());
  const rows = parseCsv(body.csv);
  if (rows.length === 0) throw new ApiError("הקובץ ריק או לא בפורמט CSV");
  if (rows.length > 50_000) throw new ApiError("עד 50,000 שורות בקובץ אחד");
  let records;
  if (body.format === "govil") {
    if (!body.city) throw new ApiError("בפורמט המאגר הממשלתי יש לבחור עיר");
    records = rows.map((r) => ({ ...normalizeGovIl(r, body.city!), sourceName: "csv_upload" }));
  } else {
    records = rows.map((r) => normalizeFlat(r, "csv_upload"));
  }
  const start = new Date();
  const res = await upsertRecords(records);
  await prisma.connectorRun.create({
    data: {
      connectorId: "csv_upload",
      startedAt: start,
      finishedAt: new Date(),
      status: res.rejected.length === records.length ? "error" : "success",
      recordsFetched: records.length,
      recordsNew: res.created,
      message: `${body.fileName ?? "קובץ"}: ${res.created} חדשות, ${res.updated} עודכנו, ${res.rejected.length} נדחו`,
    },
  });
  return NextResponse.json({ total: records.length, ...res, rejected: res.rejected.slice(0, 50) });
});
