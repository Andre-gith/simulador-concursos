import { describe, expect, it, vi } from "vitest";
import { InlineJobExecutor, QueueJobExecutor } from "../job-executor";
import { assertSafeQueuePayload, deterministicJobId } from "./contracts";

const payload = { version: 1 as const, importJobId: "cm12345678901234567890123", documentRevision: 0 };
describe("fila BullMQ", () => {
  it("gera jobId determinístico sem conteúdo sensível", () => {
    expect(deterministicJobId("OFFICIAL_IMPORT_EXTRACT", payload)).toBe(deterministicJobId("OFFICIAL_IMPORT_EXTRACT", payload));
    expect(() => assertSafeQueuePayload({ password: "x" })).toThrow("sensível");
    expect(() => assertSafeQueuePayload({ pdf: "%PDF conteúdo" })).toThrow("sensível");
  });
  it("adiciona uma vez e reconhece duplicata waiting", async () => {
    const add = vi.fn(); const getJob = vi.fn().mockResolvedValueOnce(null).mockResolvedValueOnce({ getState: vi.fn().mockResolvedValue("waiting") });
    const executor = new QueueJobExecutor({ NODE_ENV: "test", REDIS_URL: "redis://mock", QUEUE_PREFIX: "test" }, { add, getJob, close: vi.fn() } as never);
    const first = await executor.enqueue({ type: "OFFICIAL_IMPORT_EXTRACT", payload });
    const second = await executor.enqueue({ type: "OFFICIAL_IMPORT_EXTRACT", payload });
    expect(first.duplicated).toBe(false); expect(second.duplicated).toBe(true); expect(add).toHaveBeenCalledTimes(1);
    expect(add.mock.calls[0][2]).toMatchObject({ attempts: 3, backoff: { type: "exponential" } });
  });
  it("bloqueia inline em produção e exige queue/Redis", () => {
    expect(() => new InlineJobExecutor({ NODE_ENV: "production" })).toThrow("proibido");
    expect(() => new QueueJobExecutor({ NODE_ENV: "test" })).toThrow("REDIS_URL");
  });
});
