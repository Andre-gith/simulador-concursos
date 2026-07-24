import { describe, expect, it } from "vitest";

import {
  validateContestForPublication,
  validateQuestionForPublication,
  type PublicationQuestion,
} from "./publication";

function question(
  overrides: Partial<PublicationQuestion> = {},
): PublicationQuestion {
  return {
    number: 1,
    status: "PUBLISHED",
    type: "MC",
    ceAnswer: null,
    weight: 1,
    sourceUrl: "https://oficial.example/prova.pdf",
    sourcePage: 2,
    paper: null,
    alternatives: [
      { isCorrect: true },
      { isCorrect: false },
    ],
    ...overrides,
  };
}

describe("validação de publicação", () => {
  it("aceita concurso completo", () => {
    expect(
      validateContestForPublication({
        scoringRule: {},
        questions: [question()],
      }),
    ).toEqual([]);
  });

  it("exige regra de pontuação e questão publicada", () => {
    const issues = validateContestForPublication({
      scoringRule: null,
      questions: [question({ status: "IN_REVIEW" })],
    });
    expect(issues).toHaveLength(2);
  });

  it("rejeita gabarito CE ausente", () => {
    expect(
      validateQuestionForPublication(
        question({ type: "CE", ceAnswer: null, alternatives: [] }),
      ),
    ).toContain("Questão 1: o gabarito Certo/Errado está ausente.");
  });

  it("rejeita MC sem exatamente uma alternativa correta", () => {
    expect(
      validateQuestionForPublication(
        question({
          alternatives: [{ isCorrect: true }, { isCorrect: true }],
        }),
      ).some((issue) => issue.includes("exatamente uma")),
    ).toBe(true);
  });

  it("rejeita peso inválido", () => {
    for (const weight of [0, -1, Number.NaN]) {
      expect(
        validateQuestionForPublication(question({ weight })).some((issue) =>
          issue.includes("peso"),
        ),
      ).toBe(true);
    }
  });

  it("exige fonte e página", () => {
    const issues = validateQuestionForPublication(
      question({ sourceUrl: null, sourcePage: null }),
    );
    expect(issues.some((issue) => issue.includes("fonte oficial"))).toBe(true);
    expect(issues.some((issue) => issue.includes("página"))).toBe(true);
  });
});
