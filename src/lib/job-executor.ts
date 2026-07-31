import { Queue, type JobsOptions } from "bullmq";
import Redis from "ioredis";
import { assertSafeQueuePayload, deterministicJobId, parseJobEnvelope, type JobEnvelope, type JobType } from "./jobs/contracts";

export type EnqueueResult = { queued: true; jobId: string; duplicated: boolean };
export interface JobExecutor {
  readonly mode: "inline" | "queue";
  execute<T>(name: string, payload: Record<string, unknown>, inline: () => Promise<T>): Promise<T>;
  enqueue<T extends JobType>(job: JobEnvelope<T>): Promise<EnqueueResult>;
  close(): Promise<void>;
}

export class InlineJobExecutor implements JobExecutor {
  readonly mode = "inline" as const;
  constructor(environment = process.env) {
    if (environment.NODE_ENV === "production") throw new Error("Executor inline é proibido em produção.");
  }
  execute<T>(_name: string, _payload: Record<string, unknown>, inline: () => Promise<T>) { return inline(); }
  async enqueue(): Promise<EnqueueResult> { throw new Error("Enfileiramento exige JOB_EXECUTOR=queue."); }
  async close() {}
}

export class QueueJobExecutor implements JobExecutor {
  readonly mode = "queue" as const;
  private redis: Redis;
  private queue: Queue;
  constructor(environment = process.env, queue?: Queue) {
    if (!environment.REDIS_URL && !queue) throw new Error("REDIS_URL obrigatória para a fila.");
    this.redis = new Redis(environment.REDIS_URL ?? "redis://mock", { maxRetriesPerRequest: 1, enableOfflineQueue: false, lazyConnect: true });
    this.queue = queue ?? new Queue(`${environment.QUEUE_PREFIX || "nota-de-banca"}-jobs`, { connection: this.redis, prefix: environment.QUEUE_PREFIX || "nota-de-banca" });
  }
  async execute<T>(): Promise<T> { throw new Error("QueueJobExecutor exige contrato tipado; não executa closures."); }
  async enqueue<T extends JobType>(job: JobEnvelope<T>) {
    parseJobEnvelope(job.type, job.payload);
    assertSafeQueuePayload(job.payload);
    const jobId = deterministicJobId(job.type, job.payload);
    const existing = await this.queue.getJob(jobId);
    if (existing) {
      const state = await existing.getState();
      if (["waiting", "active", "completed", "delayed"].includes(state)) return { queued: true as const, jobId, duplicated: true };
      if (state === "failed") await existing.remove();
    }
    const options: JobsOptions = { jobId, attempts: 3, backoff: { type: "exponential", delay: 2_000 }, removeOnComplete: 500, removeOnFail: 1000 };
    await this.queue.add(job.type, job.payload, options);
    return { queued: true as const, jobId, duplicated: false };
  }
  async close() { await this.queue.close(); await this.redis.quit().catch(() => undefined); }
}

let singleton: JobExecutor | undefined;
export function jobExecutor(env = process.env): JobExecutor {
  singleton ??= env.JOB_EXECUTOR === "queue" ? new QueueJobExecutor(env) : new InlineJobExecutor(env);
  if (env.NODE_ENV === "production" && singleton.mode !== "queue") throw new Error("JOB_EXECUTOR=queue é obrigatório em produção.");
  return singleton;
}
