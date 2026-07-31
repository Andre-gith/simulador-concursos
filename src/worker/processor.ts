import { UnrecoverableError, type Job } from "bullmq";
import { Prisma, type PrismaClient } from "@prisma/client";
import { syncCatalogSource } from "../lib/catalog-sync/service";
import { QueueJobExecutor } from "../lib/job-executor";
import { parseJobEnvelope } from "../lib/jobs/contracts";
import { executeMonitor } from "../lib/monitoring/service";
import { discoverOfficialImport, dryRunJob, downloadSelectedDocuments, extractDocuments, validateExamArtifact } from "../lib/official-import/workflow";
import { importJobForReview } from "../lib/official-import/review-import";
import { isPermanentJobError } from "../lib/jobs/errors";

async function adminForImport(prisma: PrismaClient, importJobId: string) {
  const item = await prisma.importJob.findUnique({ where: { id: importJobId }, select: { adminUserId: true } });
  if (!item?.adminUserId) throw new UnrecoverableError("ImportJob sem administrador responsável.");
  return item.adminUserId;
}

export class WorkerJobProcessor {
  constructor(private prisma: PrismaClient, private executor: QueueJobExecutor) {}
  private async progress(importJobId: string, data: Record<string, unknown>) {
    const current = await this.prisma.importJob.findUnique({ where: { id: importJobId }, select: { report: true } });
    const report = current?.report && typeof current.report === "object" && !Array.isArray(current.report) ? current.report : {};
    await this.prisma.importJob.update({ where: { id: importJobId }, data: { report: { ...report, ...data } as Prisma.InputJsonValue } });
  }
  async process(job: Job) {
    const envelope = parseJobEnvelope(job.name, job.data);
    await job.updateProgress(5);
    try {
      if ("importJobId" in envelope.payload) {
        await this.progress(envelope.payload.importJobId, { queueStatus: "RUNNING", progress: 5, bullJobId: job.id });
      }
      switch (envelope.type) {
        case "OFFICIAL_IMPORT_DOWNLOAD": {
          const id = envelope.payload.importJobId; await downloadSelectedDocuments(this.prisma, id, await adminForImport(this.prisma, id)); break;
        }
        case "OFFICIAL_IMPORT_EXTRACT": {
          const id = envelope.payload.importJobId; await extractDocuments(this.prisma, id, await adminForImport(this.prisma, id)); break;
        }
        case "OFFICIAL_IMPORT_GENERATE": {
          const id = envelope.payload.importJobId; await validateExamArtifact(this.prisma, id, await adminForImport(this.prisma, id)); break;
        }
        case "OFFICIAL_IMPORT_DRY_RUN": {
          const id = envelope.payload.importJobId; await dryRunJob(this.prisma, id, await adminForImport(this.prisma, id)); break;
        }
        case "OFFICIAL_IMPORT_PERSIST": {
          const id = envelope.payload.importJobId; await importJobForReview(this.prisma, id, await adminForImport(this.prisma, id)); break;
        }
        case "MONITOR_SINGLE_SOURCE":
          await executeMonitor(this.prisma, envelope.payload.sourceMonitorId, { manual: true }); break;
        case "CATALOG_SYNC_SOURCE":
          await syncCatalogSource(this.prisma, envelope.payload.catalogSourceId, { dryRun: envelope.payload.dryRun }); break;
        case "MONITOR_DUE_SOURCES": {
          const sources = await this.prisma.sourceMonitor.findMany({ where: { enabled: true, frequency: { not: "MANUAL" }, OR: [{ nextCheckAt: null }, { nextCheckAt: { lte: new Date() } }] }, select: { id: true } });
          for (const source of sources) await this.executor.enqueue({ type: "MONITOR_SINGLE_SOURCE", payload: { version: 1, sourceMonitorId: source.id, scheduledAt: envelope.payload.scheduledAt } }); break;
        }
        case "CATALOG_SYNC_DUE": {
          const sources = await this.prisma.catalogSource.findMany({ where: { enabled: true, frequency: { not: "MANUAL" }, OR: [{ nextSyncAt: null }, { nextSyncAt: { lte: new Date() } }] }, select: { id: true } });
          for (const source of sources) await this.executor.enqueue({ type: "CATALOG_SYNC_SOURCE", payload: { version: 1, catalogSourceId: source.id, scheduledAt: envelope.payload.scheduledAt } }); break;
        }
        case "OFFICIAL_IMPORT_DISCOVER": {
          const id = envelope.payload.importJobId; await discoverOfficialImport(this.prisma, id, await adminForImport(this.prisma, id)); break;
        }
        case "STORAGE_MIGRATION":
          throw new UnrecoverableError("Migração de storage exige execução operacional explícita.");
      }
      await job.updateProgress(100);
      if ("importJobId" in envelope.payload) await this.progress(envelope.payload.importJobId, { queueStatus: "COMPLETED", progress: 100, bullJobId: job.id });
      return { status: "COMPLETED" };
    } catch (error) {
      const message = error instanceof Error ? error.message.slice(0, 500) : "Falha interna.";
      if ("importJobId" in envelope.payload) await this.progress(envelope.payload.importJobId, { queueStatus: "FAILED", progress: Number(job.progress) || 0, error: message, bullJobId: job.id }).catch(() => undefined);
      if (isPermanentJobError(error)) throw new UnrecoverableError(message);
      throw error;
    }
  }
}
