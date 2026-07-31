import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("rotas administrativas de importação oficial", () => {
  it("exige ADMIN nas páginas e em todas as mutações", () => {
    for (const file of ["src/app/admin/importacoes/nova/page.tsx", "src/app/admin/importacoes/[id]/page.tsx", "src/app/admin/importacoes/actions.ts"]) {
      expect(readFileSync(resolve(file), "utf8")).toContain("requireAdmin");
    }
  });
  it("mantém ações separadas e não publica automaticamente", () => {
    const actions = readFileSync(resolve("src/app/admin/importacoes/actions.ts"), "utf8");
    expect(actions).toContain("classifyAndDownloadAction");
    expect(actions).toContain("extractAction");
    expect(actions).toContain("dryRunAction");
    expect(actions).not.toContain("PublicationStatus.PUBLISHED");
  });
  it("a página pública não foi alterada pelo fluxo", () => {
    const page = readFileSync(resolve("src/app/(public)/page.tsx"), "utf8");
    expect(page).not.toContain("official-import");
    expect(page).not.toContain("Importar concurso por URL oficial");
  });
  it("oferece URL oficial e múltiplas URLs diretas", () => {
    const form = readFileSync(resolve("src/app/admin/importacoes/nova/OfficialImportForm.tsx"), "utf8");
    expect(form).toContain("Página oficial");
    expect(form).toContain("URLs diretas");
    expect(form).toContain("Adicionar URL");
    expect(form).toContain("documentType.");
    expect(form).toContain("Mover para cima");
  });
  it("condiciona a importação a dry-run, destino e confirmação", () => {
    const page = readFileSync(resolve("src/app/admin/importacoes/[id]/page.tsx"), "utf8");
    const button = readFileSync(resolve("src/app/admin/importacoes/[id]/ImportForReviewButton.tsx"), "utf8");
    expect(page).toContain('job.stage === "WAITING_REVIEW"');
    expect(page).toContain("destinationType");
    expect(button).toContain("IMPORT_FOR_REVIEW");
    expect(button).toContain("Nenhuma questão será publicada");
  });
});
