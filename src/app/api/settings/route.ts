import { NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import { apiHandler } from "@/lib/api";
import { prisma } from "@/lib/db";
import { SettingsSchema } from "@/lib/domain/schema";
import { getCurrentContext } from "@/lib/services/context";

export const PUT = apiHandler(async (req) => {
  const settings = SettingsSchema.parse(await req.json());
  const { accountId } = await getCurrentContext();
  await prisma.account.update({ where: { id: accountId }, data: { settings: settings as unknown as Prisma.InputJsonValue } });
  return NextResponse.json({ ok: true, settings });
});
