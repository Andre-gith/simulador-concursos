import { describe, expect, it } from "vitest";

import {
  scoreAttempt,
  scoreQuestion,
  type ScoringRule,
} from "./scoring";

const cebraspeRule: ScoringRule = {
  type: "CE_PENALTY",
  pointsCorrect: 1,
  pointsWrong: -1,
  pointsBlank: 0,
  floorAtZero: true,
};

const cesgranrioRule: ScoringRule = {
  type: "MC_NO_PENALTY",
  pointsCorrect: 1,
  pointsWrong: 0,
  pointsBlank: 0,
  floorAtZero: true,
};

describe("scoreQuestion - CEBRASPE", () => {
  it("acerta marcando Certo numa questão Certa", () => {
    const result = scoreQuestion(
      "C",
      {
        type: "CE",
        correctAnswer: true,
      },
      cebraspeRule,
    );

    expect(result).toBe(1);
  });

  it("erra marcando Certo numa questão Errada", () => {
    const result = scoreQuestion(
      "C",
      {
        type: "CE",
        correctAnswer: false,
      },
      cebraspeRule,
    );

    expect(result).toBe(-1);
  });

  it("deixar em branco não pontua nem desconta", () => {
    const result = scoreQuestion(
      "",
      {
        type: "CE",
        correctAnswer: true,
      },
      cebraspeRule,
    );

    expect(result).toBe(0);
  });
});

describe("scoreQuestion - CESGRANRIO", () => {
  it("acerta a alternativa correta", () => {
    const result = scoreQuestion(
      "C",
      {
        type: "MC",
        correctLetter: "C",
      },
      cesgranrioRule,
    );

    expect(result).toBe(1);
  });

  it("erra a alternativa e não perde ponto", () => {
    const result = scoreQuestion(
      "A",
      {
        type: "MC",
        correctLetter: "C",
      },
      cesgranrioRule,
    );

    expect(result).toBe(0);
  });
});

describe("scoreQuestion - peso individual", () => {
  it("multiplica os pontos corretos pelo peso", () => {
    const result = scoreQuestion(
      "B",
      {
        type: "MC",
        correctLetter: "B",
      },
      cesgranrioRule,
      1.5,
    );

    expect(result).toBe(1.5);
  });

  it("multiplica a penalidade pelo peso", () => {
    const result = scoreQuestion(
      "C",
      {
        type: "CE",
        correctAnswer: false,
      },
      cebraspeRule,
      2,
    );

    expect(result).toBe(-2);
  });

  it("rejeita peso igual a zero", () => {
    expect(() =>
      scoreQuestion(
        "C",
        {
          type: "CE",
          correctAnswer: true,
        },
        cebraspeRule,
        0,
      ),
    ).toThrow(
      "O peso da questão deve ser um número maior que zero.",
    );
  });

  it("rejeita peso negativo", () => {
    expect(() =>
      scoreQuestion(
        "C",
        { type: "CE", correctAnswer: true },
        cebraspeRule,
        -1,
      ),
    ).toThrow(
      "O peso da questão deve ser um número maior que zero.",
    );
  });
});

describe("scoreAttempt - CEBRASPE", () => {
  it("zera o total quando o saldo fica negativo", () => {
    const result = scoreAttempt(
      [
        {
          userAnswer: "C",
          question: {
            type: "CE",
            correctAnswer: false,
          },
        },
        {
          userAnswer: "E",
          question: {
            type: "CE",
            correctAnswer: true,
          },
        },
      ],
      cebraspeRule,
    );

    expect(result.total).toBe(0);
  });

  it("soma corretamente acertos e erros mistos", () => {
    const result = scoreAttempt(
      [
        {
          userAnswer: "C",
          question: {
            type: "CE",
            correctAnswer: true,
          },
        },
        {
          userAnswer: "E",
          question: {
            type: "CE",
            correctAnswer: false,
          },
        },
        {
          userAnswer: "C",
          question: {
            type: "CE",
            correctAnswer: false,
          },
        },
      ],
      cebraspeRule,
    );

    expect(result.total).toBe(1);
    expect(result.breakdown).toHaveLength(3);
  });

  it("calcula questões com pesos diferentes", () => {
    const result = scoreAttempt(
      [
        {
          userAnswer: "C",
          question: {
            type: "CE",
            correctAnswer: true,
          },
          weight: 2,
        },
        {
          userAnswer: "E",
          question: {
            type: "CE",
            correctAnswer: false,
          },
          weight: 1.5,
        },
        {
          userAnswer: "C",
          question: {
            type: "CE",
            correctAnswer: false,
          },
          weight: 1,
        },
      ],
      cebraspeRule,
    );

    expect(result.total).toBe(2.5);
    expect(result.breakdown[0].points).toBe(2);
    expect(result.breakdown[1].points).toBe(1.5);
    expect(result.breakdown[2].points).toBe(-1);
  });

  it("permite nota negativa quando floorAtZero for false", () => {
    const ruleWithoutFloor: ScoringRule = {
      ...cebraspeRule,
      floorAtZero: false,
    };

    const result = scoreAttempt(
      [
        {
          userAnswer: "C",
          question: {
            type: "CE",
            correctAnswer: false,
          },
          weight: 2,
        },
      ],
      ruleWithoutFloor,
    );

    expect(result.total).toBe(-2);
  });
});

describe("scoreAttempt - demais regras", () => {
  it("mantém zero para resposta em branco", () => {
    const result = scoreAttempt(
      [
        {
          userAnswer: "",
          question: { type: "MC", correctLetter: "A" },
        },
      ],
      cesgranrioRule,
    );

    expect(result.total).toBe(0);
    expect(result.breakdown[0].points).toBe(0);
  });

  it("não penaliza erro em MC_NO_PENALTY", () => {
    const result = scoreAttempt(
      [
        {
          userAnswer: "B",
          question: { type: "MC", correctLetter: "A" },
        },
      ],
      cesgranrioRule,
    );

    expect(result.total).toBe(0);
  });

  it("aplica penalidade em MC_NEGATIVE", () => {
    const result = scoreAttempt(
      [
        {
          userAnswer: "B",
          question: { type: "MC", correctLetter: "A" },
          weight: 2,
        },
      ],
      {
        type: "MC_NEGATIVE",
        pointsCorrect: 1,
        pointsWrong: -0.25,
        pointsBlank: 0,
        floorAtZero: false,
      },
    );

    expect(result.total).toBe(-0.5);
  });
});
