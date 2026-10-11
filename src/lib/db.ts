import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

// DATABASE_URL, או המשתנים שאינטגרציות האירוח (Neon / Supabase / Vercel Postgres) יוצרות
const datasourceUrl = process.env.DATABASE_URL || process.env.POSTGRES_PRISMA_URL || process.env.POSTGRES_URL || undefined;

export const prisma =
  globalForPrisma.prisma ?? new PrismaClient({ log: ["error", "warn"], ...(datasourceUrl ? { datasourceUrl } : {}) });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
