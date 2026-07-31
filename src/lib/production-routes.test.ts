import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(resolve(path), "utf8");
describe("superfície de produção", () => {
  it("health é sanitizado e readiness verifica banco/config/storage", () => {
    const health = read("src/app/api/health/route.ts");
    const ready = read("src/app/api/health/ready/route.ts");
    expect(health).not.toContain("DATABASE_URL");
    expect(ready).toContain("SELECT 1");
    expect(ready).toContain("privateStorage");
    expect(ready).toContain("503");
  });
  it("configura headers de segurança", () => {
    const config = read("next.config.ts");
    for (const header of ["Content-Security-Policy", "X-Content-Type-Options", "Referrer-Policy", "Permissions-Policy", "Strict-Transport-Security", "frame-ancestors"]) expect(config).toContain(header);
  });
  it("login, registro e importações possuem rate limit", () => {
    expect(read("src/auth.ts")).toContain("enforceRateLimit");
    expect(read("src/app/api/register/route.ts")).toContain("enforceRateLimit");
    expect(read("src/app/admin/importacoes/actions.ts")).toContain("enforceRateLimit");
  });
  it("downloads privados usam a abstração de storage", () => {
    expect(read("src/app/api/admin/importacoes/[jobId]/documentos/[documentId]/route.ts")).toContain("privateStorage");
    expect(read("src/app/api/admin/importacoes/[jobId]/artefatos/[artifactId]/route.ts")).toContain("privateStorage");
    expect(read("src/app/api/visual-assets/[assetId]/route.ts")).toContain("privateStorage");
  });
});
