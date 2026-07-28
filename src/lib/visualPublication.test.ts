import { describe, expect, it } from "vitest";

import {
  validateQuestionForPublication,
  type PublicationQuestion,
} from "./publication";

function visualQuestion(
  overrides: Partial<PublicationQuestion> = {},
): PublicationQuestion {
  return {
    number: 1,
    status: "IN_REVIEW",
    type: "MC",
    statement: "Enunciado oficial.",
    ceAnswer: null,
    weight: 1,
    subjectId: "subject",
    blockId: "block",
    sourceUrl: "https://oficial.example/prova.pdf",
    sourcePage: 1,
    textReviewed: true,
    alternativesReviewed: true,
    answerKeyReviewed: true,
    requiresVisualReview: true,
    visualReviewResolved: true,
    annulmentStatus: "NOT_ANNULLED",
    alternatives: [
      {
        text: "A",
        isCorrect: true,
        isVisual: false,
        visualAssetPath: null,
        sourcePage: null,
      },
      {
        text: "B",
        isCorrect: false,
        isVisual: false,
        visualAssetPath: null,
        sourcePage: null,
      },
    ],
    visualAssets: [
      { assetPath: "data/imports/banco/q1-p1.png", sourcePage: 1 },
      { assetPath: "data/imports/banco/q1-p2.png", sourcePage: 2 },
    ],
    ...overrides,
  };
}

describe("publicação de questões visuais", () => {
  it("aceita múltiplos recursos após a aprovação explícita", () => {
    expect(validateQuestionForPublication(visualQuestion())).toEqual([]);
  });

  it("bloqueia visual aprovado sem recurso oficial registrado", () => {
    const issues = validateQuestionForPublication(
      visualQuestion({ visualAssets: [] }),
    );
    expect(issues.some((issue) => issue.includes("recurso visual oficial"))).toBe(
      true,
    );
  });

  it("bloqueia visual ainda pendente", () => {
    const issues = validateQuestionForPublication(
      visualQuestion({ visualReviewResolved: false }),
    );
    expect(issues.some((issue) => issue.includes("visual"))).toBe(true);
  });

  it("permite override visual auditável sem marcar a revisão como resolvida", () => {
    expect(
      validateQuestionForPublication(
        visualQuestion({
          visualReviewResolved: false,
          publicationOverride: true,
          publicationOverrideReason:
            "Publicação temporária autorizada pelo administrador.",
          publicationOverrideAt: new Date(),
        }),
      ),
    ).toEqual([]);
  });

  it("rejeita override sem motivo e data", () => {
    const issues = validateQuestionForPublication(
      visualQuestion({
        visualReviewResolved: false,
        publicationOverride: true,
        publicationOverrideReason: null,
        publicationOverrideAt: null,
      }),
    );
    expect(issues.some((issue) => issue.includes("override administrativo"))).toBe(
      true,
    );
  });
});
