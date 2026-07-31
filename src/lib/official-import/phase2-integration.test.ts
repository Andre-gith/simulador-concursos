import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(resolve(path), "utf8");

describe("Fase 1 completa: integração administrativa", () => {
  it("protege listagem, detalhe e nova importação com ADMIN", () => {
    for (const file of [
      "src/app/admin/importacoes/page.tsx",
      "src/app/admin/importacoes/nova/page.tsx",
      "src/app/admin/importacoes/[id]/page.tsx",
    ]) expect(read(file)).toContain("requireAdmin");
  });

  it("bloqueia concurso PUBLISHED ou ARCHIVED como destino", () => {
    const workflow = read("src/lib/official-import/workflow.ts");
    const page = read("src/app/admin/importacoes/[id]/page.tsx");
    expect(workflow).toContain('["DRAFT", "IN_REVIEW"].includes(contest.status)');
    expect(page).toContain('["PUBLISHED", "ARCHIVED"].includes(contest.status)');
  });

  it("executa importação serializável, idempotente e somente IN_REVIEW", () => {
    const importer = read("src/lib/official-import/review-import.ts");
    expect(importer).toContain("TransactionIsolationLevel.Serializable");
    expect(importer).toContain('job.stage === "COMPLETED"');
    expect(importer).toContain('status: "IN_REVIEW"');
    expect(importer).toContain("visualAssets:");
    expect(importer).not.toContain('status: "PUBLISHED"');
    expect(importer).not.toContain("question.update");
    expect(importer).not.toContain("alternative.delete");
  });

  it("não habilita importação sem prova, gabarito e exam.json", () => {
    const importer = read("src/lib/official-import/review-import.ts");
    expect(importer).toContain('validTypes.has("EXAM")');
    expect(importer).toContain("ANSWER_KEY_PRELIMINARY");
    expect(importer).toContain("exam.json validado não encontrado");
    expect(importer).toContain('job.stage !== "WAITING_REVIEW"');
  });

  it("arquivos exigem ADMIN, usam IDs e não expõem localPath", () => {
    for (const route of [
      "src/app/api/admin/importacoes/[jobId]/artefatos/[artifactId]/route.ts",
      "src/app/api/admin/importacoes/[jobId]/documentos/[documentId]/route.ts",
    ]) {
      const source = read(route);
      expect(source).toContain('session.user.role !== "ADMIN"');
      expect(source).toContain("importJobId: jobId");
      expect(source).not.toContain("searchParams.get(\"localPath\")");
      expect(source).toContain("content-disposition");
      expect(source).toContain("no-store");
    }
  });

  it("migração Fase 2 é apenas aditiva", () => {
    const sql = read("prisma/official-import-phase2.sql").toUpperCase();
    expect(sql).toContain("ADD COLUMN");
    expect(sql).toContain("ADD CONSTRAINT");
    expect(sql).not.toContain("DROP TABLE");
    expect(sql).not.toContain("DROP COLUMN");
    expect(sql).not.toContain("DELETE FROM");
    expect(sql).not.toContain("TRUNCATE");
  });
});
