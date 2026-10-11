import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import type { SourceToggles } from "@/lib/connectors/registry";

/** מקורות שהמשתמש הפעיל/כיבה ממסך מקורות המידע, נשמרים בהגדרות החשבון */
export async function getSourceToggles(accountId: string): Promise<SourceToggles> {
  const acc = await prisma.account.findUnique({ where: { id: accountId }, select: { settings: true } });
  const t = (acc?.settings as { sourceToggles?: SourceToggles } | null)?.sourceToggles;
  return { govmap: t?.govmap === true };
}

export async function setSourceToggle(accountId: string, id: keyof SourceToggles, enabled: boolean) {
  const acc = await prisma.account.findUnique({ where: { id: accountId }, select: { settings: true } });
  const settings = (acc?.settings as Record<string, unknown> | null) ?? {};
  const sourceToggles = { ...((settings.sourceToggles as SourceToggles) ?? {}), [id]: enabled };
  await prisma.account.update({
    where: { id: accountId },
    data: { settings: { ...settings, sourceToggles } as unknown as Prisma.InputJsonValue },
  });
  return sourceToggles;
}
