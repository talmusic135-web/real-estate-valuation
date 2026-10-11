import { prisma } from "@/lib/db";
import { DEFAULT_SETTINGS, SettingsSchema } from "@/lib/domain/schema";

export async function getAccountDefaults(accountId: string) {
  const acc = await prisma.account.findUnique({ where: { id: accountId }, select: { settings: true } });
  const parsed = SettingsSchema.safeParse(acc?.settings ?? {});
  return parsed.success ? parsed.data : DEFAULT_SETTINGS;
}
