import { NextResponse } from "next/server";
import { apiHandler } from "@/lib/api";
import { getCurrentContext } from "@/lib/services/context";
import { runAndSave } from "@/lib/services/valuations";

/** הרצה מחדש של הערכה קיימת (למשל אחרי שנוספו נתונים) */
export const maxDuration = 60;

export const POST = apiHandler<{ params: Promise<{ id: string }> }>(async (_req, { params }) => {
  const { id } = await params;
  const { accountId } = await getCurrentContext();
  const result = await runAndSave(id, accountId);
  return NextResponse.json({ id, status: result.status });
});
