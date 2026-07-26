import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it, vi } from "vitest";

import {
  examImportSchema,
  type ExamImportDocument,
} from "../examImportSchema";

import { executeExamImport } from "./exam-import-runner";
import { assertExamIdentity } from "./exam-source-validation";

const technologyPath = resolve(
  "data/imports/banco-do-brasil/agente-tecnologia/exam.json",
);
const commercialPath = resolve(
  "data/imports/banco-do-brasil/agente-comercial/exam.json",
);

function readJson(path: string): unknown {
  return JSON.parse(readFileSync(path, "utf8")) as unknown;
}

function validCommercialDocument(): ExamImportDocument {
  return examImportSchema.parse(readJson(commercialPath));
}

describe("arquivos extraídos do Banco do Brasil", () => {
  it("mantém concursos, cadernos e fontes das especialidades separados", () => {
    const technology = readJson(technologyPath) as {
      contest: { specialty?: string };
      paper: { code: string };
      questions: Array<{ sourceUrl?: string }>;
    };
    const commercial = validCommercialDocument();

    expect(technology.contest.specialty).toBe("Agente de Tecnologia");
    expect(technology.paper.code).toBe("MICRORREGIAO-158-TI-GABARITO-1");
    expect(
      technology.questions.every((question) =>
        question.sourceUrl?.includes("/agente-tecnologia/"),
      ),
    ).toBe(true);

    expect(commercial.contest.specialty).toBe("Agente Comercial");
    expect(commercial.paper.code).toBe(
      "PROVA-A-AGENTE-COMERCIAL-GABARITO-1",
    );
    expect(
      commercial.questions.every((question) =>
        question.sourceUrl?.includes("/agente-comercial/"),
      ),
    ).toBe(true);
  });

  it("rejeita caderno incompatível com a importação esperada", () => {
    const document = validCommercialDocument();
    expect(() =>
      assertExamIdentity(document, {
        specialty: "Agente Comercial",
        paperCode: "MICRORREGIAO-158-TI-GABARITO-1",
      }),
    ).toThrow("Caderno incompatível");
  });

  it("rejeita especialidade incompatível com a importação esperada", () => {
    const document = validCommercialDocument();
    expect(() =>
      assertExamIdentity(document, {
        specialty: "Agente de Tecnologia",
        paperCode: "PROVA-A-AGENTE-COMERCIAL-GABARITO-1",
      }),
    ).toThrow("Especialidade incompatível");
  });

  it("rejeita questão duplicada", () => {
    const document = validCommercialDocument();
    document.questions[1].number = document.questions[0].number;
    expect(examImportSchema.safeParse(document).success).toBe(false);
  });

  it("rejeita alternativa duplicada", () => {
    const document = validCommercialDocument();
    const question = document.questions[0];
    if (question.type !== "MC") throw new Error("Questão MC esperada.");
    question.alternatives[1].letter = question.alternatives[0].letter;
    expect(examImportSchema.safeParse(document).success).toBe(false);
  });

  it("rejeita gabarito inexistente", () => {
    const document = validCommercialDocument();
    const question = document.questions[0];
    if (question.type !== "MC") throw new Error("Questão MC esperada.");
    question.alternatives.forEach((alternative) => {
      alternative.isCorrect = false;
    });
    expect(examImportSchema.safeParse(document).success).toBe(false);
  });

  it("rejeita múltiplas respostas corretas", () => {
    const document = validCommercialDocument();
    const question = document.questions[0];
    if (question.type !== "MC") throw new Error("Questão MC esperada.");
    question.alternatives[0].isCorrect = true;
    question.alternatives[1].isCorrect = true;
    expect(examImportSchema.safeParse(document).success).toBe(false);
  });

  it("rejeita marcação de questão anulada não suportada pelo schema atual", () => {
    const document = validCommercialDocument();
    const question = {
      ...document.questions[0],
      annulled: true,
    };
    expect(
      examImportSchema.safeParse({
        ...document,
        questions: [question, ...document.questions.slice(1)],
      }).success,
    ).toBe(false);
  });

  it("aceita a questão 67 como visual, preservando ordem e gabarito", () => {
    const technology = examImportSchema.parse(readJson(technologyPath));
    const question = technology.questions.find(({ number }) => number === 67);

    expect(question?.type).toBe("MC");
    if (!question || question.type !== "MC") {
      throw new Error("Questão 67 MC esperada.");
    }

    expect(question.requiresVisualReview).toBe(true);
    expect(question.alternatives.map(({ letter }) => letter)).toEqual([
      "A",
      "B",
      "C",
      "D",
      "E",
    ]);
    expect(
      question.alternatives.every(
        (alternative) =>
          alternative.isVisual &&
          Boolean(alternative.visualAssetPath) &&
          Boolean(alternative.sourcePage),
      ),
    ).toBe(true);
    expect(
      question.alternatives.filter(({ isCorrect }) => isCorrect),
    ).toHaveLength(1);
    expect(
      question.alternatives.find(({ isCorrect }) => isCorrect)?.letter,
    ).toBe("A");
  });

  it("não chama persistência durante o dry-run", async () => {
    const persist = vi.fn().mockResolvedValue({ imported: true });
    const execution = await executeExamImport(validCommercialDocument(), {
      dryRun: true,
      persist,
    });

    expect(execution.kind).toBe("dry-run");
    expect(persist).not.toHaveBeenCalled();
  });
});
