import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { isCatalogCronAuthorized } from "./cron-auth";

describe("segurança da sincronização do catálogo", () => {
  it("usa segredo próprio e comparação timing-safe", () => {
    expect(isCatalogCronAuthorized("Bearer correto", "correto")).toBe(true);
    expect(isCatalogCronAuthorized("Bearer errado", "correto")).toBe(false);
    expect(isCatalogCronAuthorized(null, "")).toBe(false);
  });
  it("cron processa somente fontes vencidas e não aceita parâmetros arbitrários", () => {
    const route = readFileSync(resolve("src/app/api/internal/catalog-sync/route.ts"), "utf8");
    expect(route).toContain("syncDueCatalogSources");
    expect(route).not.toContain("searchParams");
    expect(route).not.toContain("request.json");
  });
  it("serviço comunitário não escreve entidades operacionais", () => {
    const service = readFileSync(resolve("src/lib/catalog-sync/service.ts"), "utf8");
    for (const forbidden of ["tx.concurso.", "tx.question.", "tx.attempt.", "tx.simulatedExam.", "tx.examPaper."]) {
      expect(service).not.toContain(forbidden);
    }
    expect(service).toContain("editorialCatalogEntry.create");
    expect(service).toContain("PROTECTED_FIELD");
  });
});
