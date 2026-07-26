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
    statement: "Enunciado conferido.",
    ceAnswer: null,
    weight: 1,
    subjectId: "subject",
    blockId: "block",
    sourceUrl: "https://oficial.example/prova.pdf",
    sourcePage: 2,
    textReviewed: true,
    alternativesReviewed: true,
    answerKeyReviewed: true,
    requiresVisualReview: false,
    visualReviewResolved: false,
    annulmentStatus: "NOT_ANNULLED",
    paper: null,
    alternatives: [
      {
        text: "Alternativa A",
        isCorrect: true,
        isVisual: false,
        visualAssetPath: null,
        sourcePage: null,
      },
      {
        text: "Alternativa B",
        isCorrect: false,
        isVisual: false,
        visualAssetPath: null,
        sourcePage: null,
      },
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

  it("aceita publicação somente a partir de IN_REVIEW", () => {
    expect(
      validateContestForPublication({
        status: "DRAFT",
        scoringRule: {},
        questions: [question()],
      }).some((issue) => issue.includes("em revisão")),
    ).toBe(true);
  });

  it("exige regra de pontuação e questão publicada", () => {
    const issues = validateContestForPublication({
      scoringRule: null,
      questions: [question({ status: "IN_REVIEW" })],
    });
    expect(issues.some((issue) => issue.includes("regra de pontuação"))).toBe(
      true,
    );
    expect(
      issues.some((issue) => issue.includes("pelo menos uma questão publicada")),
    ).toBe(true);
    expect(issues.some((issue) => issue.includes("ativa(s)"))).toBe(true);
  });

  it("exige que todas as questões ativas estejam publicadas", () => {
    const issues = validateContestForPublication({
      status: "IN_REVIEW",
      scoringRule: {},
      questions: [question(), question({ number: 2, status: "IN_REVIEW" })],
    });
    expect(issues.some((issue) => issue.includes("ativa(s)"))).toBe(true);
  });

  it("ignora questões arquivadas ao validar a cobertura do simulado", () => {
    expect(
      validateContestForPublication({
        status: "IN_REVIEW",
        scoringRule: {},
        questions: [question(), question({ number: 2, status: "ARCHIVED" })],
      }),
    ).toEqual([]);
  });

  it("rejeita regra de pontuação com valor não finito", () => {
    const issues = validateContestForPublication({
      status: "IN_REVIEW",
      scoringRule: { pointsCorrect: Number.NaN },
      questions: [question()],
    });
    expect(issues.some((issue) => issue.includes("valores inválidos"))).toBe(
      true,
    );
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
          alternatives: [
            {
              text: "Alternativa A",
              isCorrect: true,
              isVisual: false,
              visualAssetPath: null,
              sourcePage: null,
            },
            {
              text: "Alternativa B",
              isCorrect: true,
              isVisual: false,
              visualAssetPath: null,
              sourcePage: null,
            },
          ],
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

  it("exige todas as conferências editoriais", () => {
    const issues = validateQuestionForPublication(
      question({
        textReviewed: false,
        alternativesReviewed: false,
        answerKeyReviewed: false,
        annulmentStatus: "PENDING",
        requiresVisualReview: true,
        visualReviewResolved: false,
      }),
    );
    expect(issues.some((issue) => issue.includes("texto ainda"))).toBe(true);
    expect(issues.some((issue) => issue.includes("alternativas ainda"))).toBe(
      true,
    );
    expect(issues.some((issue) => issue.includes("gabarito ainda"))).toBe(true);
    expect(issues.some((issue) => issue.includes("anulação"))).toBe(true);
    expect(issues.some((issue) => issue.includes("pendência visual"))).toBe(
      true,
    );
  });

  it("rejeita questão anulada e alternativa sem texto", () => {
    const issues = validateQuestionForPublication(
      question({
        annulmentStatus: "ANNULLED",
        alternatives: [
          {
            text: "",
            isCorrect: true,
            isVisual: false,
            visualAssetPath: null,
            sourcePage: null,
          },
          {
            text: "Alternativa B",
            isCorrect: false,
            isVisual: false,
            visualAssetPath: null,
            sourcePage: null,
          },
        ],
      }),
    );
    expect(issues.some((issue) => issue.includes("anuladas"))).toBe(true);
    expect(issues.some((issue) => issue.includes("alternativas precisam"))).toBe(
      true,
    );
  });

  it("bloqueia publicação enquanto a revisão visual estiver pendente", () => {
    const issues = validateQuestionForPublication(
      question({
        requiresVisualReview: true,
        visualReviewResolved: false,
        alternatives: [
          {
            text: "Alternativa visual A",
            isCorrect: true,
            isVisual: true,
            visualAssetPath: "data/imports/exemplo/alternativa-a.png",
            sourcePage: 2,
          },
          {
            text: "Alternativa visual B",
            isCorrect: false,
            isVisual: true,
            visualAssetPath: "data/imports/exemplo/alternativa-b.png",
            sourcePage: 2,
          },
        ],
      }),
    );

    expect(issues.some((issue) => issue.includes("pendência visual"))).toBe(
      true,
    );
  });

  it("rejeita alternativa visual sem recurso oficial ou página", () => {
    const issues = validateQuestionForPublication(
      question({
        alternatives: [
          {
            text: "Alternativa visual A",
            isCorrect: true,
            isVisual: true,
            visualAssetPath: null,
            sourcePage: null,
          },
          {
            text: "Alternativa B",
            isCorrect: false,
            isVisual: false,
            visualAssetPath: null,
            sourcePage: null,
          },
        ],
      }),
    );

    expect(
      issues.some(
        (issue) => issue.includes("recurso") && issue.includes("página"),
      ),
    ).toBe(true);
  });
});
