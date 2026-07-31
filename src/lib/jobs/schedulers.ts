import type { PrismaClient } from "@prisma/client";
import type { JobExecutor } from "../job-executor";

const scheduledAt = (date = new Date()) => new Date(Math.floor(date.getTime() / 60_000) * 60_000).toISOString();

export async function enqueueDueMonitors(prisma: PrismaClient, executor: JobExecutor, now = new Date()) {
  const sources = await prisma.sourceMonitor.findMany({ where: { enabled: true, frequency: { not: "MANUAL" }, OR: [{ nextCheckAt: null }, { nextCheckAt: { lte: now } }] }, select: { id: true }, take: 25 });
  return Promise.all(sources.map((source) => executor.enqueue({ type: "MONITOR_SINGLE_SOURCE", payload: { version: 1, sourceMonitorId: source.id, scheduledAt: scheduledAt(now) } })));
}
export async function enqueueDueCatalogSources(prisma: PrismaClient, executor: JobExecutor, now = new Date()) {
  const sources = await prisma.catalogSource.findMany({ where: { enabled: true, frequency: { not: "MANUAL" }, OR: [{ nextSyncAt: null }, { nextSyncAt: { lte: now } }] }, select: { id: true }, take: 25 });
  return Promise.all(sources.map((source) => executor.enqueue({ type: "CATALOG_SYNC_SOURCE", payload: { version: 1, catalogSourceId: source.id, scheduledAt: scheduledAt(now) } })));
}
