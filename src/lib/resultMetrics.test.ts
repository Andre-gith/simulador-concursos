import { describe, expect, it } from "vitest";

import { calculateResultMetrics } from "./resultMetrics";

describe("calculateResultMetrics", () => {
  it("calcula pontuação máxima ponderada e pesos diferentes", () => {
    const result = calculateResultMetrics(
      [
        { id: "q1", weight: 2, subject: "Português", block: null },
        { id: "q2", weight: 0.5, subject: "Português", block: null },
      ],
      [
        {
          questionId: "q1",
          userAnswer: "C",
          isCorrect: true,
          pointsEarned: 2,
        },
        {
          questionId: "q2",
          userAnswer: "",
          isCorrect: null,
          pointsEarned: 0,
        },
      ],
      1,
      2,
    );

    expect(result.overall.maximumScore).toBe(2.5);
    expect(result.overall.scorePercentage).toBe(80);
    expect(result.subjects[0].maximumScore).toBe(2.5);
  });

  it("separa taxa de acerto, percentual máximo e nota líquida", () => {
    const questions = Array.from({ length: 5 }, (_, index) => ({
      id: `q${index + 1}`,
      weight: 1,
      subject: "Direito",
      block: null,
    }));
    const result = calculateResultMetrics(
      questions,
      [
        { questionId: "q1", userAnswer: "C", isCorrect: true, pointsEarned: 1 },
        { questionId: "q2", userAnswer: "C", isCorrect: true, pointsEarned: 1 },
        { questionId: "q3", userAnswer: "C", isCorrect: false, pointsEarned: -1 },
        { questionId: "q4", userAnswer: "C", isCorrect: false, pointsEarned: -1 },
        { questionId: "q5", userAnswer: "", isCorrect: null, pointsEarned: 0 },
      ],
      1,
      0,
    );

    expect(result.overall.netScore).toBe(0);
    expect(result.overall.scorePercentage).toBe(0);
    expect(result.overall.accuracyRate).toBe(40);
  });

  it("agrega matéria e avalia mínimos configurados por bloco", () => {
    const block = {
      id: "b1",
      name: "Conhecimentos básicos",
      order: 1,
      minimumScore: 2,
      minimumCorrect: 2,
    };
    const result = calculateResultMetrics(
      [
        { id: "q1", weight: 2, subject: "Português", block },
        { id: "q2", weight: 1, subject: "Português", block },
      ],
      [
        { questionId: "q1", userAnswer: "C", isCorrect: true, pointsEarned: 2 },
        { questionId: "q2", userAnswer: "E", isCorrect: false, pointsEarned: -1 },
      ],
      1,
      1,
    );

    expect(result.subjects[0]).toMatchObject({
      total: 2,
      correct: 1,
      wrong: 1,
      netScore: 1,
      maximumScore: 3,
      accuracyRate: 50,
    });
    expect(result.blocks[0]).toMatchObject({
      meetsMinimumScore: false,
      meetsMinimumCorrect: false,
      meetsConfiguredMinimums: false,
    });
  });
});
