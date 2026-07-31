import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import { validateProductionConfig } from "./production-config";
import { LocalPrivateStorageProvider, safeStorageKey } from "./storage";
import { MemoryRateLimitProvider } from "./rate-limit";
import { log } from "./logger";

describe("prontidão de produção", () => {
  it("rejeita segredos e providers críticos ausentes em produção sem imprimir valores", () => {
    const secret = "segredo-que-nao-pode-vazar";
    const issues = validateProductionConfig({ NODE_ENV: "production", AUTH_SECRET: secret });
    expect(issues.some((issue) => issue.key === "DATABASE_URL" && issue.severity === "error")).toBe(true);
    expect(JSON.stringify(issues)).not.toContain(secret);
  });
  it("storage local preserva conteúdo, hash, metadados e bloqueia traversal", async () => {
    const root = await mkdtemp(join(tmpdir(), "private-storage-"));
    const storage = new LocalPrivateStorageProvider(root);
    const stored = await storage.put("data/imports/test.txt", Buffer.from("teste"));
    expect(stored.sha256).toHaveLength(64);
    expect((await storage.get("data/imports/test.txt")).toString()).toBe("teste");
    expect(await storage.exists("data/imports/test.txt")).toBe(true);
    expect(() => safeStorageKey("../segredo")).toThrow();
    await expect(storage.delete("data/imports/test.txt")).rejects.toThrow("autorizada");
  });
  it("rate limiter em memória bloqueia após o limite", async () => {
    const provider = new MemoryRateLimitProvider();
    expect((await provider.consume("login", 1, 60)).allowed).toBe(true);
    expect((await provider.consume("login", 1, 60)).allowed).toBe(false);
  });
  it("logger mascara segredos e Authorization", () => {
    const spy = vi.spyOn(console, "info").mockImplementation(() => undefined);
    log("info", "request", { requestId: "r1", authorization: "Bearer supersecreto", status: 200 });
    const output = String(spy.mock.calls[0][0]);
    expect(output).not.toContain("supersecreto");
    expect(output).toContain("requestId");
    spy.mockRestore();
  });
});
