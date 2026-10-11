import { NextResponse } from "next/server";
import { z } from "zod";
import { ApiError, apiHandler } from "@/lib/api";
import { prisma } from "@/lib/db";
import { getCurrentContext } from "@/lib/services/context";

const Body = z.object({ brokerNotes: z.string().max(5000) });

export const PATCH = apiHandler<{ params: Promise<{ id: string }> }>(async (req, { params }) => {
  const { id } = await params;
  const { brokerNotes } = Body.parse(await req.json());
  const { accountId } = await getCurrentContext();
  const res = await prisma.valuation.updateMany({ where: { id, accountId }, data: { brokerNotes } });
  if (res.count === 0) throw new ApiError("ההערכה לא נמצאה", 404);
  return NextResponse.json({ ok: true });
});
