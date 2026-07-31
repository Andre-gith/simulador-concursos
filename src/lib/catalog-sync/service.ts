import { createHash, randomUUID } from "node:crypto";
import { Prisma, type CatalogTrustLevel, type PrismaClient } from "@prisma/client";
import { catalogKey, classifyMatch, normalizedIdentity } from "./normalize";
import { providerFor } from "./providers";
import { AUTO_EDITABLE_FIELDS, type CatalogProvider, type CatalogRecord } from "./types";

const MAX_RECORDS = 500;
const LOCK_MS = 10 * 60_000;
const RETRIES = 2;
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
const json = (value: unknown) => value as Prisma.InputJsonValue;

function hash(value: unknown) {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

function nextDate(frequency: "DAILY" | "WEEKLY" | "MANUAL", from = new Date()) {
  if (frequency === "MANUAL") return null;
  return new Date(from.getTime() + (frequency === "DAILY" ? 86_400_000 : 604_800_000));
}

async function acquireLock(prisma: PrismaClient, sourceId: string, token: string) {
  const now = new Date();
  const result = await prisma.catalogSource.updateMany({
    where: { id: sourceId, OR: [{ lockExpiresAt: null }, { lockExpiresAt: { lt: now } }] },
    data: { lockedAt: now, lockedBy: token, lockExpiresAt: new Date(now.getTime() + LOCK_MS) },
  });
  return result.count === 1;
}

async function releaseLock(prisma: PrismaClient, sourceId: string, token: string) {
  await prisma.catalogSource.updateMany({
    where: { id: sourceId, lockedBy: token },
    data: { lockedAt: null, lockedBy: null, lockExpiresAt: null },
  });
}

function entryCreate(record: CatalogRecord, trustLevel: CatalogTrustLevel) {
  return {
    catalogKey: catalogKey(record),
    orgao: record.institution,
    title: [record.institution, record.position, record.specialty].filter(Boolean).join(" — "),
    cargo: record.position,
    especialidade: record.specialty,
    ano: record.year,
    edicao: record.edition,
    nivel: record.level,
    status: "IN_REVIEW" as const,
    trustLevel,
    possibleOfficialUrl: record.possibleOfficialUrl,
    informativeUrl: record.informativeUrl,
    estimatedDate: record.estimatedDate ? new Date(record.estimatedDate) : null,
    forecastStatus: record.forecastStatus,
    manuallyConfirmedFields: [],
  };
}

export async function syncCatalogSource(
  prisma: PrismaClient,
  sourceId: string,
  options: { dryRun?: boolean; provider?: CatalogProvider; fixturePath?: string; records?: CatalogRecord[] } = {},
) {
  const source = await prisma.catalogSource.findUnique({ where: { id: sourceId } });
  if (!source || !source.enabled) return { status: "SKIPPED" as const, reason: "Fonte ausente ou desativada." };
  const token = randomUUID();
  if (!options.dryRun && !(await acquireLock(prisma, sourceId, token))) return { status: "LOCKED" as const };

  let runId: string | undefined;
  try {
    if (!options.dryRun) {
      runId = (await prisma.catalogSyncRun.create({
        data: { catalogSourceId: sourceId, status: "RUNNING", lockToken: token, dryRun: false },
      })).id;
    }
    const provider = options.provider ?? providerFor(source.providerType);
    let result: Awaited<ReturnType<CatalogProvider["fetch"]>> | undefined;
    let lastError: unknown;
    for (let attempt = 1; attempt <= RETRIES + 1; attempt += 1) {
      try {
        result = await provider.fetch({
          baseUrl: source.baseUrl, config: source.config, apiKey: process.env.CATALOG_PROVIDER_API_KEY,
          fixturePath: options.fixturePath ?? ((source.config as { fixturePath?: string } | null)?.fixturePath),
          records: options.records, limit: MAX_RECORDS,
        });
        break;
      } catch (error) {
        lastError = error;
        if (attempt <= RETRIES) await sleep(attempt * 100);
      }
    }
    if (!result) throw lastError;

    const preview = { received: result.records.length, created: 0, updated: 0, unchanged: 0, conflicts: 0, rejected: 0 };
    if (options.dryRun) {
      for (const record of result.records) {
        const candidates = await prisma.editorialCatalogEntry.findMany({
          where: { orgao: { contains: record.institution, mode: "insensitive" } }, include: { banca: true }, take: 20,
        });
        const matches = candidates.map((entry) => classifyMatch(record, entry));
        if (matches.includes("EXACT")) preview.unchanged += 1;
        else if (matches.some((match) => match === "PROBABLE" || match === "CONFLICT")) preview.conflicts += 1;
        else preview.created += 1;
      }
      return { status: "COMPLETED" as const, dryRun: true, ...preview, warnings: result.warnings ?? [] };
    }

    for (const record of result.records) {
      await prisma.$transaction(async (tx) => {
        const payloadHash = hash(record.raw);
        const previous = await tx.catalogExternalRecord.findFirst({
          where: { catalogSourceId: sourceId, externalId: record.externalId },
          orderBy: { version: "desc" },
        });
        if (previous?.payloadHash === payloadHash) {
          await tx.catalogExternalRecord.update({ where: { id: previous.id }, data: { lastSeenAt: new Date(), consecutiveMissing: 0 } });
          preview.unchanged += 1;
          return;
        }
        const external = await tx.catalogExternalRecord.create({
          data: {
            catalogSourceId: sourceId, catalogSyncRunId: runId!, externalId: record.externalId,
            version: (previous?.version ?? 0) + 1, payloadHash, rawPayload: json(record.raw),
            normalizedPayload: json({ ...record, raw: undefined }), normalizedIdentity: normalizedIdentity(record),
            supersedesId: previous?.id,
          },
        });
        if (previous) await tx.catalogExternalRecord.update({ where: { id: previous.id }, data: { status: "SUPERSEDED" } });

        const entries = await tx.editorialCatalogEntry.findMany({ include: { banca: true } });
        const ranked = entries.map((entry) => ({ entry, match: classifyMatch(record, entry) }));
        const exact = ranked.find(({ match }) => match === "EXACT");
        const uncertain = ranked.find(({ match }) => match === "PROBABLE" || match === "CONFLICT");
        if (exact) {
          await tx.catalogExternalRecord.update({ where: { id: external.id }, data: { editorialCatalogEntryId: exact.entry.id } });
          const protectedFields = new Set(Array.isArray(exact.entry.manuallyConfirmedFields) ? exact.entry.manuallyConfirmedFields.map(String) : []);
          const highTrust = ["OFFICIAL_CONFIRMED", "ADMIN_CONFIRMED"].includes(exact.entry.trustLevel);
          for (const field of AUTO_EDITABLE_FIELDS) {
            const proposed = record[field];
            const current = exact.entry[field];
            if (proposed == null || String(proposed) === String(current ?? "")) continue;
            if (highTrust || protectedFields.has(field)) {
              await tx.catalogConflict.create({ data: {
                catalogSourceId: sourceId, catalogExternalRecordId: external.id, editorialCatalogEntryId: exact.entry.id,
                type: "PROTECTED_FIELD", field, currentValue: json(current == null ? null : String(current)), proposedValue: json(proposed),
              } });
              preview.conflicts += 1;
            } else {
              await tx.editorialCatalogEntry.update({ where: { id: exact.entry.id }, data: {
                [field]: field === "estimatedDate" && proposed ? new Date(String(proposed)) : proposed,
              } });
              preview.updated += 1;
            }
          }
          if (!previous) preview.unchanged += 1;
        } else if (uncertain) {
          await tx.catalogConflict.create({ data: {
            catalogSourceId: sourceId, catalogExternalRecordId: external.id, editorialCatalogEntryId: uncertain.entry.id,
            type: uncertain.match === "CONFLICT" ? "INCOMPATIBLE_IDENTITY" : "PROBABLE_DUPLICATE",
            details: json({ normalizedIdentity: normalizedIdentity(record) }),
          } });
          preview.conflicts += 1;
        } else {
          const entry = await tx.editorialCatalogEntry.create({ data: entryCreate(record, source.trustLevel) });
          await tx.catalogExternalRecord.update({ where: { id: external.id }, data: { editorialCatalogEntryId: entry.id } });
          preview.created += 1;
        }
      });
    }
    await prisma.catalogSyncRun.update({ where: { id: runId! }, data: {
      status: result.warnings?.length ? "COMPLETED_WITH_WARNINGS" : "COMPLETED", finishedAt: new Date(),
      receivedCount: preview.received, createdCount: preview.created, updatedCount: preview.updated,
      unchangedCount: preview.unchanged, conflictCount: preview.conflicts, rejectedCount: preview.rejected,
      warnings: result.warnings ? json(result.warnings) : undefined, cursor: result.cursor ? json(result.cursor) : undefined,
    } });
    await prisma.catalogSource.update({ where: { id: sourceId }, data: {
      lastSyncedAt: new Date(), lastSuccessfulAt: new Date(), nextSyncAt: nextDate(source.frequency),
      consecutiveFailures: 0, lastError: null,
    } });
    return { status: "COMPLETED" as const, runId, ...preview };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (runId) await prisma.catalogSyncRun.update({ where: { id: runId }, data: { status: "FAILED", finishedAt: new Date(), error: message } });
    await prisma.catalogSource.update({ where: { id: sourceId }, data: {
      lastSyncedAt: new Date(), lastErrorAt: new Date(), lastError: message, consecutiveFailures: { increment: 1 },
      nextSyncAt: nextDate(source.frequency),
    } });
    throw error;
  } finally {
    if (!options.dryRun) await releaseLock(prisma, sourceId, token);
  }
}

export async function syncDueCatalogSources(prisma: PrismaClient) {
  const sources = await prisma.catalogSource.findMany({
    where: { enabled: true, frequency: { not: "MANUAL" }, OR: [{ nextSyncAt: null }, { nextSyncAt: { lte: new Date() } }] },
    select: { id: true }, take: 25,
  });
  const results = [];
  for (const source of sources) {
    try { results.push(await syncCatalogSource(prisma, source.id)); }
    catch (error) { results.push({ status: "FAILED", sourceId: source.id, error: error instanceof Error ? error.message : String(error) }); }
  }
  return results;
}
