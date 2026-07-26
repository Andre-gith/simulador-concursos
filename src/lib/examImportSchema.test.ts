import { describe, expect, it } from "vitest";

import { examImportSchema, summarizeExamImport } from "./examImportSchema";

function validDocument() {
  return {
    schemaVersion: 1,
    contentNotice: "Conteúdo original de demonstração.",
    reviewStatus: "IN_REVIEW",
    contest: {
      board: "Banca",
      agency: "Órgão",
      year: 2026,
      position: "Cargo",
    },
    paper: { code: "P1" },
    scoringRule: {
      type: "MC_NO_PENALTY",
      pointsCorrect: 1,
      pointsWrong: 0,
      pointsBlank: 0,
      floorAtZero: true,
    },
    blocks: [{ name: "Bloco", order: 1 }],
    subjects: [{ name: "Matéria", topics: ["Assunto"] }],
    questions: [
      {
        number: 1,
        type: "MC",
        subject: "Matéria",
        topic: "Assunto",
        block: "Bloco",
        weight: 1,
        statement: "Enunciado demonstrativo.",
        alternatives: [
          { letter: "A", text: "Correta", isCorrect: true },
          { letter: "B", text: "Incorreta", isCorrect: false },
        ],
      },
      {
        number: 2,
        type: "CE",
        subject: "Matéria",
        weight: 2,
        statement: "Item demonstrativo.",
        ceAnswer: true,
      },
    ],
  };
}

describe("examImportSchema", () => {
  it("aceita um documento completo e resume o conteúdo", () => {
    const parsed = examImportSchema.parse(validDocument());
    expect(summarizeExamImport(parsed)).toMatchObject({
      questions: 2,
      ceQuestions: 1,
      mcQuestions: 1,
      reviewStatus: "IN_REVIEW",
    });
  });

  it("rejeita números duplicados no caderno", () => {
    const document = validDocument();
    document.questions[1].number = 1;
    expect(examImportSchema.safeParse(document).success).toBe(false);
  });

  it("rejeita peso zero e negativo", () => {
    for (const weight of [0, -1]) {
      const document = validDocument();
      document.questions[0].weight = weight;
      expect(examImportSchema.safeParse(document).success).toBe(false);
    }
  });

  it("rejeita letras duplicadas sem diferenciar caixa", () => {
    const document = validDocument();
    const mcQuestion = document.questions[0];
    if ("alternatives" in mcQuestion) {
      mcQuestion.alternatives![1].letter = "a";
    }
    expect(examImportSchema.safeParse(document).success).toBe(false);
  });

  it("rejeita MC sem uma única alternativa correta", () => {
    for (const correctAnswers of [0, 2]) {
      const document = validDocument();
      const mcQuestion = document.questions[0];
      if ("alternatives" in mcQuestion) {
        mcQuestion.alternatives!.forEach((alternative, index) => {
          alternative.isCorrect = index < correctAnswers;
        });
      }
      expect(examImportSchema.safeParse(document).success).toBe(false);
    }
  });

  it("rejeita CE sem ceAnswer", () => {
    const document = validDocument();
    const ceQuestion = document.questions[1];
    if ("ceAnswer" in ceQuestion) {
      delete ceQuestion.ceAnswer;
    }
    expect(examImportSchema.safeParse(document).success).toBe(false);
  });

  it("rejeita bloco, matéria e assunto não declarados", () => {
    for (const field of ["block", "subject", "topic"] as const) {
      const document = validDocument();
      document.questions[0][field] = "Não declarado";
      expect(examImportSchema.safeParse(document).success).toBe(false);
    }
  });

  it("rejeita publicação automática e campos desconhecidos", () => {
    expect(
      examImportSchema.safeParse({
        ...validDocument(),
        reviewStatus: "PUBLISHED",
      }).success,
    ).toBe(false);
    expect(
      examImportSchema.safeParse({
        ...validDocument(),
        unknownField: true,
      }).success,
    ).toBe(false);
  });

  it("mantém texto obrigatório em alternativas comuns", () => {
    const document = validDocument();
    const question = document.questions[0];
    if ("alternatives" in question) {
      question.alternatives![0].text = "";
    }
    expect(examImportSchema.safeParse(document).success).toBe(false);
  });

  it("rejeita alternativa visual sem recurso e página", () => {
    const document = validDocument();
    const question = document.questions[0];
    Object.assign(question, { requiresVisualReview: true });
    if ("alternatives" in question) {
      Object.assign(question.alternatives![0], { isVisual: true });
    }
    expect(examImportSchema.safeParse(document).success).toBe(false);
  });

  it("rejeita alternativa visual em questão sem revisão visual", () => {
    const document = validDocument();
    const question = document.questions[0];
    if ("alternatives" in question) {
      Object.assign(question.alternatives![0], {
        isVisual: true,
        visualAssetPath: "data/imports/exemplo/alternativa-a.png",
        sourcePage: 2,
      });
    }
    expect(examImportSchema.safeParse(document).success).toBe(false);
  });

  it("aceita alternativas visuais referenciadas somente em revisão", () => {
    const document = validDocument();
    const question = document.questions[0];
    Object.assign(question, { requiresVisualReview: true });
    if ("alternatives" in question) {
      question.alternatives!.forEach((alternative, index) => {
        Object.assign(alternative, {
          isVisual: true,
          visualAssetPath: `data/imports/exemplo/alternativa-${index}.png`,
          sourcePage: 2,
        });
      });
    }

    const parsed = examImportSchema.parse(document);
    const parsedQuestion = parsed.questions[0];
    expect(parsed.reviewStatus).toBe("IN_REVIEW");
    expect(parsedQuestion.requiresVisualReview).toBe(true);
    if (parsedQuestion.type !== "MC") {
      throw new Error("Questão MC esperada.");
    }
    expect(parsedQuestion.alternatives.map(({ letter }) => letter)).toEqual([
      "A",
      "B",
    ]);
  });
});
