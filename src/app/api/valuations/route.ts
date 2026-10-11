import { NextResponse } from "next/server";
import { apiHandler } from "@/lib/api";
import { SaveValuationSchema } from "@/lib/domain/schema";
import { getCurrentContext } from "@/lib/services/context";
import { createValuation, runAndSave } from "@/lib/services/valuations";

/** יצירת הערכה: שמירת טיוטה, או שמירה והרצה */
export const POST = apiHandler(async (req) => {
  const body = SaveValuationSchema.parse(await req.json());
  const { accountId } = await getCurrentContext();
  const v = await createValuation({ accountId, input: body.input, title: body.title, brokerNotes: body.brokerNotes, parentId: body.parentId });
  if (body.action === "run") await runAndSave(v.id, accountId);
  return NextResponse.json({ id: v.id });
});
