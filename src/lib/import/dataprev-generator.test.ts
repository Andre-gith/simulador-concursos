import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it, vi } from "vitest";

import { examImportSchema } from "../examImportSchema";
import { executeExamImport } from "./exam-import-runner";
import {
  buildDataprevExam,
  extractDataprevQuestions,
  type DataprevPhysicalPage,
} from "./dataprev-generator";

const physicalRanges = [
  { page: 1, start: 51, end: 84 },
  { page: 2, start: 85, end: 116 },
  { page: 3, start: 117, end: 120 },
  { page: 4, start: 1, end: 10 },
  { page: 5, start: 11, end: 25 },
  { page: 6, start: 26, end: 40 },
  { page: 7, start: 41, end: 50 },
] as const;

function syntheticPages(): DataprevPhysicalPage[] {
  return physicalRanges.map(({ page, start, end }) => ({
    number: page,
    text: Array.from(
      { length: end - start + 1 },
      (_, index) => `${start + index}\nItem oficial ${start + index}.`,
    ).join("\n"),
  }));
}

function syntheticAnswers() {
  return Object.fromEntries(
    Array.from({ length: 120 }, (_, index) => [String(index + 1), true]),
  );
}

function generatedDocument() {
  const path = resolve(
    process.cwd(),
    "data/imports/dataprev/desenvolvimento-de-software/exam.json",
  );
  return examImportSchema.parse(JSON.parse(readFileSync(path, "utf8")));
}

describe("gerador determinístico da prova Dataprev", () => {
  it("respeita a ordem física não numérica e entrega 1 a 120 ordenadas", () => {
    const pages = syntheticPages().reverse();
    const questions = extractDataprevQuestions(pages);

    expect(questions).toHaveLength(120);
    expect(questions.map(({ number }) => number)).toEqual(
      Array.from({ length: 120 }, (_, index) => index + 1),
    );
    expect(questions.find(({ number }) => number === 1)?.sourcePage).toBe(4);
    expect(questions.find(({ number }) => number === 51)?.sourcePage).toBe(1);
    expect(questions.find(({ number }) => number === 120)?.sourcePage).toBe(3);
  });

  it("rejeita lacuna ou sequência incompatível com o caderno", () => {
    const pages = syntheticPages();
    pages[3].text = pages[3].text.replace("5\nItem oficial 5.", "");

    expect(() => extractDataprevQuestions(pages)).toThrow(
      "sequência inesperada",
    );
  });

  it("gera somente CE, mantém o gabarito preliminar em revisão e referencia os visuais", () => {
    const document = buildDataprevExam({
      pages: syntheticPages(),
      answers: syntheticAnswers(),
      assets: {
        "119": resolve(
          process.cwd(),
          "data/imports/dataprev/desenvolvimento-de-software/assets/questao-119/visual-01-p3.png",
        ),
        "120": resolve(
          process.cwd(),
          "data/imports/dataprev/desenvolvimento-de-software/assets/questao-120/visual-01-p3.png",
        ),
      },
      projectRoot: process.cwd(),
    });
    const parsed = examImportSchema.parse(document);

    expect(parsed.reviewStatus).toBe("IN_REVIEW");
    expect(parsed.contentNotice).toContain("Gabarito oficial preliminar");
    expect(parsed.questions).toHaveLength(120);
    expect(parsed.questions.every(({ type }) => type === "CE")).toBe(true);
    expect(
      parsed.questions
        .filter(({ requiresVisualReview }) => requiresVisualReview)
        .map(({ number }) => number),
    ).toEqual([119, 120]);
  });

  it("valida o arquivo final, suas páginas, pesos e ausência de publicação", () => {
    const document = generatedDocument();

    expect(document.questions).toHaveLength(120);
    expect(document.questions.every(({ type }) => type === "CE")).toBe(true);
    expect(document.questions.slice(0, 50).every(({ weight }) => weight === 1))
      .toBe(true);
    expect(document.questions.slice(50).every(({ weight }) => weight === 2))
      .toBe(true);
    expect(document.questions[0].sourcePage).toBe(4);
    expect(document.questions[50].sourcePage).toBe(1);
    expect(document.questions[119].sourcePage).toBe(3);
    expect(document.reviewStatus).toBe("IN_REVIEW");
  });

  it("não executa persistência no dry-run", async () => {
    const persist = vi.fn();
    const execution = await executeExamImport(generatedDocument(), {
      dryRun: true,
      persist,
    });

    expect(execution.kind).toBe("dry-run");
    expect(persist).not.toHaveBeenCalled();
  });
});
