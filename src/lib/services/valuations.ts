import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { ValuationInputSchema, type ValuationInput } from "@/lib/domain/schema";
import { runConnectors } from "@/lib/connectors/registry";
import { runValuation } from "@/lib/valuation/engine";
import type { ValuationResult } from "@/lib/valuation/types";
import { buildFacts } from "@/lib/ai/facts";
import { generateSummary } from "@/lib/ai/provider";
import { findAdjacentNeighborhoods, loadCityRecords, resolveSubjectPoint, upsertRecords } from "./records";

export function defaultTitle(input: ValuationInput) {
  const where = [input.location.street, input.location.neighborhood, input.location.city].filter(Boolean).join(", ");
  return `${input.property.rooms} חד׳, ${input.property.areaSqm} מ״ר – ${where}`;
}

export async function createValuation(args: {
  accountId: string;
  input: ValuationInput;
  title?: string;
  brokerNotes?: string;
  parentId?: string;
}) {
  if (args.parentId) {
    const parent = await prisma.valuation.findFirst({ where: { id: args.parentId, accountId: args.accountId } });
    if (!parent) throw new Error("ההערכה המקורית לא נמצאה");
  }
  return prisma.valuation.create({
    data: {
      accountId: args.accountId,
      title: args.title || defaultTitle(args.input),
      input: args.input as unknown as Prisma.InputJsonValue,
      brokerNotes: args.brokerNotes,
      parentId: args.parentId,
      status: "draft",
    },
  });
}

export async function updateDraft(args: {
  accountId: string;
  id: string;
  input: ValuationInput;
  title?: string;
  brokerNotes?: string;
}) {
  const v = await prisma.valuation.findFirst({ where: { id: args.id, accountId: args.accountId } });
  if (!v) throw new Error("ההערכה לא נמצאה");
  return prisma.valuation.update({
    where: { id: v.id },
    data: {
      title: args.title || defaultTitle(args.input),
      input: args.input as unknown as Prisma.InputJsonValue,
      brokerNotes: args.brokerNotes,
    },
  });
}

/**
 * הרצת הערכה: שליפה מכל המקורות (כשל של מקור לא עוצר), שמירה עם מניעת
 * כפילויות, חישוב, סיכום AI מבוקר ושמירת התוצאה + עסקאות ההשוואה.
 */
export async function runAndSave(id: string, accountId: string) {
  const v = await prisma.valuation.findFirst({ where: { id, accountId } });
  if (!v) throw new Error("ההערכה לא נמצאה");
  const input = ValuationInputSchema.parse(v.input);
  const now = new Date();

  const since = new Date(now.getTime() - input.settings.dateRangeMonths * 2 * 30.4375 * 86400000);
  const runs = await runConnectors({
    city: input.location.city,
    neighborhood: input.location.neighborhood,
    street: input.location.street,
    recordTypes: ["completed_transaction", "active_listing"],
    since,
  });

  const sourcesUsed: { id: string; name: string; status: string; message: string | null; fetched: number; created: number }[] = [];
  for (const r of runs) {
    let created = 0;
    if (r.records.length) {
      const res = await upsertRecords(r.records);
      created = res.created;
    }
    if (r.status !== "skipped" || r.records.length) {
      await prisma.connectorRun.create({
        data: {
          connectorId: r.connectorId,
          status: r.status,
          finishedAt: new Date(),
          recordsFetched: r.records.length,
          recordsNew: created,
          message: r.message,
        },
      });
    }
    sourcesUsed.push({ id: r.connectorId, name: r.name, status: r.status, message: r.message, fetched: r.records.length, created });
  }

  const records = await loadCityRecords(input.location.city);
  const listingIds = records.filter((r) => r.recordType === "active_listing").map((r) => r.id);
  const histories = await prisma.priceHistory.findMany({
    where: { recordId: { in: listingIds } },
    orderBy: { observedAt: "asc" },
  });
  const priceHistory: Record<string, { priceIls: number; observedAt: Date }[]> = {};
  for (const h of histories) (priceHistory[h.recordId] ??= []).push({ priceIls: h.priceIls, observedAt: h.observedAt });

  const result = runValuation({
    input,
    subjectPoint: resolveSubjectPoint(input.location, records),
    adjacentNeighborhoods: findAdjacentNeighborhoods(input.location.neighborhood, records),
    records,
    priceHistory,
    unavailableSources: runs.filter((r) => r.status === "error").map((r) => r.name),
    now,
  });

  const summary = await generateSummary(buildFacts(input, result));
  if (summary.note) result.limitations.push(summary.note);

  await prisma.$transaction([
    prisma.valuationComparable.deleteMany({ where: { valuationId: v.id } }),
    prisma.valuationComparable.createMany({
      data: [...result.comparables, ...result.listings].map((c) => ({
        valuationId: v.id,
        recordId: c.recordId,
        kind: c.kind,
        similarity: c.similarity,
        weight: c.weight,
        distanceM: c.distanceM,
        included: c.included,
        reasons: c.reasons as unknown as Prisma.InputJsonValue,
        snapshot: c as unknown as Prisma.InputJsonValue,
      })),
    }),
    prisma.valuation.update({
      where: { id: v.id },
      data: {
        status: result.status,
        result: result as unknown as Prisma.InputJsonValue,
        algorithmVersion: result.algorithmVersion,
        aiSummary: summary.text,
        aiProvider: summary.provider,
        sourcesUsed: sourcesUsed as unknown as Prisma.InputJsonValue,
      },
    }),
  ]);
  return result;
}

export async function getValuation(id: string, accountId: string) {
  const v = await prisma.valuation.findFirst({
    where: { id, accountId },
    include: {
      parent: { select: { id: true, title: true, result: true, createdAt: true } },
      versions: { select: { id: true, title: true, createdAt: true, status: true }, orderBy: { createdAt: "asc" } },
    },
  });
  if (!v) return null;
  return {
    ...v,
    input: ValuationInputSchema.parse(v.input),
    result: (v.result as unknown as ValuationResult | null) ?? null,
    sourcesUsed: (v.sourcesUsed as unknown as { id: string; name: string; status: string; message: string | null; fetched: number }[] | null) ?? [],
  };
}

export type FullValuation = NonNullable<Awaited<ReturnType<typeof getValuation>>>;
