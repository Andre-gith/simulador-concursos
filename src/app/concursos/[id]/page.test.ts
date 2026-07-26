import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

import {
  isContestAvailable,
  publicContestDetailSelect,
} from "../../../lib/contestDetail";

const pageSource = readFileSync(
  resolve("src/app/concursos/[id]/page.tsx"),
  "utf8",
);
const formSource = readFileSync(
  resolve("src/app/concursos/[id]/StartSimuladoForm.tsx"),
  "utf8",
);

describe("página pública do concurso", () => {
  it("usa o tema claro da home sem depender das classes pretas antigas", () => {
    for (const legacyClass of [
      "bg-neutral-950",
      "bg-neutral-900",
      "border-neutral-800",
      "text-orange-400",
    ]) {
      expect(pageSource).not.toContain(legacyClass);
      expect(formSource).not.toContain(legacyClass);
    }
    expect(pageSource).toContain("bg-[#f6f4ed]");
    expect(formSource).toContain("bg-amber-400");
  });

  it("disponibiliza configuração somente para concurso publicado e completo", () => {
    expect(
      isContestAvailable({
        status: "PUBLISHED",
        hasScoringRule: true,
        publishedQuestionCount: 1,
      }),
    ).toBe(true);
    expect(pageSource).toContain(
      "{isAvailable && concurso.scoringRule && (",
    );
  });

  it("mantém concurso em revisão fora da configuração", () => {
    expect(
      isContestAvailable({
        status: "IN_REVIEW",
        hasScoringRule: true,
        publishedQuestionCount: 70,
      }),
    ).toBe(false);
    expect(pageSource).toContain(
      "Esta prova e seu gabarito estão em revisão editorial.",
    );
  });

  it("não apresenta o botão de início fora do formulário protegido", () => {
    expect(pageSource).not.toContain('"Iniciar simulado"');
    expect(formSource).toContain('"Iniciar simulado"');
  });

  it("consulta contagem editorial sem selecionar gabaritos", () => {
    const serializedSelect = JSON.stringify(publicContestDetailSelect);

    expect(serializedSelect).toContain('"status":true');
    expect(serializedSelect).toContain('"subject"');
    expect(serializedSelect).toContain('"block"');
    for (const sensitiveField of [
      "ceAnswer",
      "isCorrect",
      "alternatives",
      "answerKey",
      "gabarito",
    ]) {
      expect(serializedSelect).not.toContain(sensitiveField);
    }
  });

  it("expõe ferramentas de revisão somente dentro da condição de ADMIN", () => {
    const adminCondition = pageSource.indexOf(
      'session?.user?.role === "ADMIN"',
    );
    const editLink = pageSource.indexOf("Editar concurso");
    const questionsLink = pageSource.indexOf("Ver questões em revisão");
    const previewLink = pageSource.indexOf(
      "Pré-visualizar como candidato",
    );

    expect(adminCondition).toBeGreaterThan(-1);
    expect(editLink).toBeGreaterThan(adminCondition);
    expect(questionsLink).toBeGreaterThan(adminCondition);
    expect(previewLink).toBeGreaterThan(adminCondition);
  });
});
