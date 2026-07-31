import { createHash } from "node:crypto";
import { z } from "zod";

export const jobPayloadSchemas = {
  OFFICIAL_IMPORT_DISCOVER: z.object({ version: z.literal(1), importJobId: z.string().cuid(), documentRevision: z.number().int().nonnegative().default(0) }).strict(),
  OFFICIAL_IMPORT_DOWNLOAD: z.object({ version: z.literal(1), importJobId: z.string().cuid(), documentRevision: z.number().int().nonnegative().default(0) }).strict(),
  OFFICIAL_IMPORT_EXTRACT: z.object({ version: z.literal(1), importJobId: z.string().cuid(), documentRevision: z.number().int().nonnegative().default(0) }).strict(),
  OFFICIAL_IMPORT_GENERATE: z.object({ version: z.literal(1), importJobId: z.string().cuid(), documentRevision: z.number().int().nonnegative().default(0) }).strict(),
  OFFICIAL_IMPORT_DRY_RUN: z.object({ version: z.literal(1), importJobId: z.string().cuid(), documentRevision: z.number().int().nonnegative().default(0) }).strict(),
  OFFICIAL_IMPORT_PERSIST: z.object({ version: z.literal(1), importJobId: z.string().cuid(), documentRevision: z.number().int().nonnegative().default(0) }).strict(),
  MONITOR_DUE_SOURCES: z.object({ version: z.literal(1), scheduledAt: z.string().datetime() }).strict(),
  MONITOR_SINGLE_SOURCE: z.object({ version: z.literal(1), sourceMonitorId: z.string().cuid(), scheduledAt: z.string().datetime() }).strict(),
  CATALOG_SYNC_DUE: z.object({ version: z.literal(1), scheduledAt: z.string().datetime() }).strict(),
  CATALOG_SYNC_SOURCE: z.object({ version: z.literal(1), catalogSourceId: z.string().cuid(), scheduledAt: z.string().datetime(), dryRun: z.boolean().optional() }).strict(),
  STORAGE_MIGRATION: z.object({ version: z.literal(1), artifactId: z.string().cuid(), sha256: z.string().regex(/^[a-f0-9]{64}$/), explicitlyAuthorized: z.literal(true) }).strict(),
} as const;

export type JobType = keyof typeof jobPayloadSchemas;
export type JobPayload<T extends JobType = JobType> = z.infer<(typeof jobPayloadSchemas)[T]>;
export type JobEnvelope<T extends JobType = JobType> = T extends JobType ? { type: T; payload: JobPayload<T> } : never;

export function parseJobEnvelope(type: string, payload: unknown): JobEnvelope {
  if (!(type in jobPayloadSchemas)) throw new Error("Tipo de job inválido.");
  const typed = type as JobType;
  return { type: typed, payload: jobPayloadSchemas[typed].parse(payload) } as JobEnvelope;
}

export function deterministicJobId<T extends JobType>(type: T, payload: JobPayload<T>) {
  const p = payload as Record<string, unknown>;
  const identity = p.importJobId ?? p.sourceMonitorId ?? p.catalogSourceId ?? p.artifactId ?? p.scheduledAt;
  const revision = p.sha256 ?? p.scheduledAt ?? p.documentRevision ?? p.version;
  const digest = createHash("sha256").update(`${identity}:${revision}`).digest("hex").slice(0, 32);
  return `${type.toLowerCase().replaceAll("_", "-")}-${digest}`;
}

export function assertSafeQueuePayload(payload: unknown) {
  const serialized = JSON.stringify(payload);
  if (serialized.length > 4096) throw new Error("Payload da fila excede o limite.");
  if (/password|secret|token|authorization|cookie|localPath|exam\.json|%PDF/i.test(serialized)) throw new Error("Payload sensível proibido.");
  return createHash("sha256").update(serialized).digest("hex");
}
