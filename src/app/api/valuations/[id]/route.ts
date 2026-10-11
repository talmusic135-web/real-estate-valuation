import { NextResponse } from "next/server";
import { ApiError, apiHandler } from "@/lib/api";
import { prisma } from "@/lib/db";
import { SaveValuationSchema } from "@/lib/domain/schema";
import { getCurrentContext } from "@/lib/services/context";
import { getValuation, runAndSave, updateDraft } from "@/lib/services/valuations";

type Ctx = { params: Promise<{ id: string }> };

export const GET = apiHandler<Ctx>(async (_req, { params }) => {
  const { id } = await params;
  const { accountId } = await getCurrentContext();
  const v = await getValuation(id, accountId);
  if (!v) throw new ApiError("ההערכה לא נמצאה", 404);
  return NextResponse.json(v);
});

/** עדכון טיוטה במקום (הערכה שכבר חושבה נשמרת כגרסה חדשה דרך POST עם parentId) */
export const PUT = apiHandler<Ctx>(async (req, { params }) => {
  const { id } = await params;
  const body = SaveValuationSchema.parse(await req.json());
  const { accountId } = await getCurrentContext();
  const v = await updateDraft({ accountId, id, input: body.input, title: body.title, brokerNotes: body.brokerNotes });
  if (body.action === "run") await runAndSave(v.id, accountId);
  return NextResponse.json({ id: v.id });
});

export const DELETE = apiHandler<Ctx>(async (_req, { params }) => {
  const { id } = await params;
  const { accountId } = await getCurrentContext();
  const v = await prisma.valuation.findFirst({ where: { id, accountId }, select: { id: true } });
  if (!v) throw new ApiError("ההערכה לא נמצאה", 404);
  await prisma.valuation.updateMany({ where: { parentId: id }, data: { parentId: null } });
  await prisma.valuation.delete({ where: { id } });
  return NextResponse.json({ ok: true });
});
