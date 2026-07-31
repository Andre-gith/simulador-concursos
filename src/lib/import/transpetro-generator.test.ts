import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it, vi } from "vitest";

import { examImportSchema } from "../examImportSchema";
import { executeExamImport } from "./exam-import-runner";

function document() {
  return examImportSchema.parse(
    JSON.parse(
      readFileSync(
        resolve(
          process.cwd(),
          "data/imports/transpetro/manutencao-mecanica/exam.json",
        ),
        "utf8",
      ),
    ),
  );
}

describe("Prova 9 da Transpetro — Manutenção Mecânica", () => {
  it("mantém 60 questões MC, a ordem e a estrutura oficial", () => {
    const exam = document();

    expect(exam.reviewStatus).toBe("IN_REVIEW");
    expect(exam.paper.code).toBe("PROVA-9-MANUTENCAO-MECANICA");
    expect(exam.contest.specialty).toBe("Manutenção | Mecânica");
    expect(exam.questions).toHaveLength(60);
    expect(exam.questions.map(({ number }) => number)).toEqual(
      Array.from({ length: 60 }, (_, index) => index + 1),
    );
    expect(exam.questions.every(({ type }) => type === "MC")).toBe(true);
    expect(
      exam.questions.every(
        (question) =>
          question.type === "MC" &&
          question.alternatives.length === 5 &&
          question.alternatives.filter(({ isCorrect }) => isCorrect).length ===
            1,
      ),
    ).toBe(true);
  });

  it("preserva os recursos visuais e as cinco alternativas da questão 32", () => {
    const exam = document();
    const visualNumbers = exam.questions
      .filter(({ requiresVisualReview }) => requiresVisualReview)
      .map(({ number }) => number);
    const question = exam.questions.find(({ number }) => number === 32);

    expect(visualNumbers).toEqual([
      11, 12, 13, 14, 30, 32, 34, 35, 38, 41, 42, 43, 46, 50, 56, 57, 60,
    ]);
    expect(question?.visualAssets).toHaveLength(1);
    if (question?.type !== "MC") throw new Error("Questão 32 MC esperada.");
    expect(question.alternatives.map(({ letter }) => letter)).toEqual([
      "A",
      "B",
      "C",
      "D",
      "E",
    ]);
    expect(question.alternatives.every(({ isVisual }) => isVisual)).toBe(true);
  });

  it("não persiste durante o dry-run", async () => {
    const persist = vi.fn();
    const result = await executeExamImport(document(), {
      dryRun: true,
      persist,
    });

    expect(result.kind).toBe("dry-run");
    expect(persist).not.toHaveBeenCalled();
  });
});
