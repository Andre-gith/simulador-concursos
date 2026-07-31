import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { isValidCronAuthorization } from "./cron-auth";

describe("segurança do monitoramento", () => {
  it("cron recusa segredo ausente ou incorreto e aceita Bearer correto", () => {
    expect(isValidCronAuthorization(null, "secret")).toBe(false);
    expect(isValidCronAuthorization("Bearer wrong", "secret")).toBe(false);
    expect(isValidCronAuthorization("Bearer secret", "secret")).toBe(true);
    expect(isValidCronAuthorization("Bearer secret", undefined)).toBe(false);
  });
  it("endpoint não aceita parâmetros arbitrários e só executa vencidos", () => {
    const route = readFileSync(resolve("src/app/api/internal/monitor-sources/route.ts"), "utf8");
    expect(route).toContain("executeDueMonitors");
    expect(route).not.toContain("searchParams");
    expect(route).not.toContain("request.json");
    expect(route).not.toContain("console.");
  });
  it("serviço não aplica propostas nem altera questões", () => {
    const service = readFileSync(resolve("src/lib/monitoring/service.ts"), "utf8");
    expect(service).not.toContain("question.update");
    expect(service).not.toContain("attempt.update");
    expect(service).not.toContain('status: "PUBLISHED"');
    expect(service).toContain("editorialChangeProposal.create");
  });
  it("migração é aditiva", () => {
    const sql = readFileSync(resolve("prisma/official-monitoring-phase3.sql"), "utf8").toUpperCase();
    expect(sql).toContain("CREATE TABLE");
    expect(sql).not.toContain("DROP TABLE");
    expect(sql).not.toContain("DROP COLUMN");
    expect(sql).not.toContain("DELETE FROM");
    expect(sql).not.toContain("TRUNCATE");
  });
});
