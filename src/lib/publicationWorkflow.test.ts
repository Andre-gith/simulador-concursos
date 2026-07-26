import { describe, expect, it } from "vitest";

import {
  validateBulkQuestionSelection,
  type BulkPublicationQuestion,
} from "./publicationWorkflow";

function ready(
  overrides: Partial<BulkPublicationQuestion> = {},
): BulkPublicationQuestion {
  return {
    number: 1,
    status: "IN_REVIEW",
    type: "MC",
    statement: "Questão oficial conferida.",
    ceAnswer: null,
    weight: 1,
    subjectId: "subject",
    blockId: "block",
    sourceUrl: "https://official.example/prova.pdf",
    sourcePage: 10,
    textReviewed: true,
    alternativesReviewed: true,
    answerKeyReviewed: true,
    requiresVisualReview: false,
    visualReviewResolved: false,
    annulmentStatus: "NOT_ANNULLED",
    paper: null,
    alternatives: [
      {
        text: "A",
        isCorrect: true,
        isVisual: false,
        visualAssetPath: null,
        sourcePage: 10,
      },
      {
        text: "B",
        isCorrect: false,
        isVisual: false,
        visualAssetPath: null,
        sourcePage: 10,
      },
    ],
    ...overrides,
  };
}

describe("fluxo editorial em lote", () => {
  it("aceita publicação de questão pronta", () => {
    expect(validateBulkQuestionSelection([ready()], "PUBLISH_READY")).toEqual(
      [],
    );
  });

  it("não republica nem sobrescreve questão fora de IN_REVIEW", () => {
    const issues = validateBulkQuestionSelection(
      [ready({ status: "PUBLISHED" })],
      "PUBLISH_READY",
    );
    expect(issues.some((issue) => issue.includes("em revisão"))).toBe(true);
  });

  it("bloqueia a seleção inteira quando uma questão não está pronta", () => {
    const issues = validateBulkQuestionSelection(
      [ready(), ready({ number: 2, answerKeyReviewed: false })],
      "PUBLISH_READY",
    );
    expect(issues.some((issue) => issue.includes("Questão 2"))).toBe(true);
  });

  it("bloqueia questão visual pendente, inclusive a questão 67", () => {
    const issues = validateBulkQuestionSelection(
      [
        ready({
          number: 67,
          requiresVisualReview: true,
          visualReviewResolved: false,
        }),
      ],
      "PUBLISH_READY",
    );
    expect(issues.some((issue) => issue.includes("visual"))).toBe(true);
  });

  it("bloqueia divergência e dados estruturais ausentes", () => {
    const issues = validateBulkQuestionSelection(
      [
        ready({
          extractionNotes: "Divergência com o gabarito",
          blockId: null,
          sourceUrl: null,
          sourcePage: null,
        }),
      ],
      "TEXT_REVIEWED",
    );
    expect(issues.some((issue) => issue.includes("divergência"))).toBe(true);
    expect(issues.some((issue) => issue.includes("bloco"))).toBe(true);
    expect(issues.some((issue) => issue.includes("fonte"))).toBe(true);
  });

  it("trata anulada como impeditiva e permite confirmar anulação pendente", () => {
    expect(
      validateBulkQuestionSelection(
        [ready({ annulmentStatus: "ANNULLED" })],
        "PUBLISH_READY",
      ).some((issue) => issue.includes("anuladas")),
    ).toBe(true);
    expect(
      validateBulkQuestionSelection(
        [ready({ annulmentStatus: "PENDING" })],
        "NOT_ANNULLED",
      ),
    ).toEqual([]);
  });
});
