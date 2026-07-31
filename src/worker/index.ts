import { Worker } from "bullmq";
import Redis from "ioredis";
import { prisma } from "../lib/prisma";
import { QueueJobExecutor } from "../lib/job-executor";
import { log } from "../lib/logger";
import { WorkerJobProcessor } from "./processor";

if (!process.env.REDIS_URL) throw new Error("REDIS_URL obrigatória para o worker.");
const prefix = process.env.QUEUE_PREFIX || "nota-de-banca";
const connection = new Redis(process.env.REDIS_URL, { maxRetriesPerRequest: null });
const executor = new QueueJobExecutor(process.env);
const processor = new WorkerJobProcessor(prisma, executor);
const concurrency = Math.max(1, Math.min(4, Number(process.env.WORKER_CONCURRENCY || 1)));
const worker = new Worker(`${prefix}-jobs`, (job) => processor.process(job), {
  connection, prefix, concurrency,
  lockDuration: Math.max(30_000, Number(process.env.WORKER_LOCK_DURATION_MS || 120_000)),
  maxStalledCount: 1,
});

worker.on("completed", (job) => log("info", "worker.job.completed", { jobId: job.id, type: job.name }));
worker.on("failed", (job, error) => log("error", "worker.job.failed", { jobId: job?.id, type: job?.name, error }));
worker.on("error", (error) => log("error", "worker.error", { error }));

let shuttingDown = false;
export async function gracefulShutdown(signal: string) {
  if (shuttingDown) return; shuttingDown = true;
  log("info", "worker.shutdown", { signal });
  const timeout = Math.max(5_000, Number(process.env.WORKER_JOB_TIMEOUT_MS || 300_000));
  await Promise.race([worker.close(), new Promise((_, reject) => setTimeout(() => reject(new Error("Timeout ao encerrar worker.")), timeout))]).catch((error) => log("error", "worker.shutdown.timeout", { error }));
  await executor.close(); await connection.quit().catch(() => undefined); await prisma.$disconnect();
}
process.once("SIGTERM", () => void gracefulShutdown("SIGTERM").finally(() => process.exit(0)));
process.once("SIGINT", () => void gracefulShutdown("SIGINT").finally(() => process.exit(0)));
log("info", "worker.started", { concurrency, prefix });
