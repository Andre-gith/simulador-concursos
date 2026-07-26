import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

import { adminCandidatePreviewSelect } from "./adminPreview";
import { resolveImportVisualAsset } from "./visualAssets";

const previewSource = readFileSync(
  resolve("src/app/admin/concursos/[id]/preview/page.tsx"),
  "utf8",
);

describe("prévia administrativa de candidato", () => {
  it("é protegida por ADMIN e não executa mutações", () => {
    expect(previewSource).toContain("await requireAdmin()");
    for (const mutation of [
      "attempt.create",
      "attempt.update",
      "attemptAnswer",
      "prisma.$transaction",
      "setContestStatus",
    ]) {
      expect(previewSource).not.toContain(mutation);
    }
  });

  it("não consulta respostas corretas ou gabarito", () => {
    const query = JSON.stringify(adminCandidatePreviewSelect);
    for (const sensitiveField of [
      "isCorrect",
      "ceAnswer",
      "answerKey",
      "gabarito",
    ]) {
      expect(query).not.toContain(sensitiveField);
    }
  });

  it("bloqueia path traversal e arquivos fora de data/imports", () => {
    expect(
      resolveImportVisualAsset(
        "../../prisma/schema.prisma",
        "C:/concurso-simulador/concurso-simulador",
      ),
    ).toBeNull();
    expect(
      resolveImportVisualAsset(
        "C:/Windows/System32/example.png",
        "C:/concurso-simulador/concurso-simulador",
      ),
    ).toBeNull();
  });

  it("aceita somente imagens suportadas dentro de data/imports", () => {
    expect(
      resolveImportVisualAsset(
        "data/imports/banco/assets/questao.png",
        "C:/concurso-simulador/concurso-simulador",
      ),
    ).toMatchObject({ mimeType: "image/png" });
    expect(
      resolveImportVisualAsset(
        "data/imports/banco/prova.pdf",
        "C:/concurso-simulador/concurso-simulador",
      ),
    ).toBeNull();
  });
});
