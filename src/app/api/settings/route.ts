import { NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import { apiHandler } from "@/lib/api";
import { prisma } from "@/lib/db";
import { SettingsSchema } from "@/lib/domain/schema";
import { getCurrentContext } from "@/lib/services/context";

export const PUT = apiHandler(async (req) => {
  const settings = SettingsSchema.parse(await req.json());
  const { accountId } = await getCurrentContext();
  const prev = await prisma.account.findUnique({ where: { id: accountId }, select: { settings: true } });
  const sourceToggles = (prev?.settings as { sourceToggles?: unknown } | null)?.sourceToggles;
  const merged = sourceToggles ? { ...settings, sourceToggles } : settings;
  await prisma.account.update({ where: { id: accountId }, data: { settings: merged as unknown as Prisma.InputJsonValue } });
  return NextResponse.json({ ok: true, settings });
});
