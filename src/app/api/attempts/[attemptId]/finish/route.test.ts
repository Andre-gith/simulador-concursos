import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  findUnique: vi.fn(),
  createMany: vi.fn(),
  updateMany: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    $transaction: vi.fn(async (callback: (transaction: unknown) => unknown) =>
      callback({
        attempt: {
          findUnique: mocks.findUnique,
          updateMany: mocks.updateMany,
        },
        attemptAnswer: { createMany: mocks.createMany },
      }),
    ),
  },
}));

vi.mock("@/auth", () => ({
  auth: vi.fn(async () => ({
    user: { id: "user", role: "USER", email: "user@example.com" },
  })),
}));

vi.mock("@/lib/scoring", () => ({
  scoreAttempt: vi.fn(
    (
      answers: Array<{ userAnswer: string; weight?: number }>,
      rule: {
        pointsCorrect: number;
        pointsWrong: number;
        pointsBlank: number;
      },
    ) => {
      const breakdown = answers.map((answer) => ({
        userAnswer: answer.userAnswer,
        weight: answer.weight ?? 1,
        points:
          answer.userAnswer === ""
            ? rule.pointsBlank * (answer.weight ?? 1)
            : rule.pointsCorrect * (answer.weight ?? 1),
      }));

      return {
        total: breakdown.reduce((total, item) => total + item.points, 0),
        breakdown,
      };
    },
  ),
}));

vi.mock("@/lib/attemptTiming", () => ({
  getAttemptTiming: vi.fn(
    (startedAt: Date, durationMinutes: number | null) => {
      const expiresAt =
        durationMinutes === null
          ? null
          : new Date(startedAt.getTime() + durationMinutes * 60_000);
      return {
        hasTimeLimit: durationMinutes !== null,
        expiresAt,
        remainingMilliseconds:
          expiresAt === null
            ? null
            : Math.max(0, expiresAt.getTime() - Date.now()),
        isExpired:
          expiresAt !== null && Date.now() >= expiresAt.getTime(),
      };
    },
  ),
}));

import { POST } from "./route";

const rule = {
  id: "rule",
  concursoId: "contest",
  type: "CE_PENALTY" as const,
  pointsCorrect: 1,
  pointsWrong: -1,
  pointsBlank: 0,
  minimumTotalScore: null,
  minimumCorrect: null,
  floorAtZero: true,
};

function question(overrides: Record<string, unknown> = {}) {
  return {
    id: "q1",
    type: "CE" as const,
    ceAnswer: true,
    weight: 1,
    alternatives: [],
    ...overrides,
  };
}

function attempt(questionData = question()) {
  return {
    id: "attempt",
    userId: "user",
    startedAt: new Date("2026-01-01T12:00:00.000Z"),
    finishedAt: null,
    finishReason: null,
    totalScore: null,
    simulatedExam: {
      durationMinutes: null,
      concurso: { scoringRule: rule },
      questions: [{ question: questionData }],
    },
  };
}

function request(answers: Array<{ questionId: string; userAnswer: string }>) {
  return new Request("http://localhost/api/attempts/attempt/finish", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ answers }),
  });
}

async function post(
  answers: Array<{ questionId: string; userAnswer: string }>,
) {
  return POST(request(answers), {
    params: Promise.resolve({ attemptId: "attempt" }),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.findUnique.mockResolvedValue(attempt());
  mocks.createMany.mockResolvedValue({ count: 1 });
  mocks.updateMany.mockResolvedValue({ count: 1 });
});

describe("POST finish validation", () => {
  it("rejeita questão CE sem gabarito", async () => {
    mocks.findUnique.mockResolvedValue(attempt(question({ ceAnswer: null })));
    expect((await post([{ questionId: "q1", userAnswer: "C" }])).status).toBe(422);
  });

  it("rejeita MC sem alternativa correta", async () => {
    mocks.findUnique.mockResolvedValue(
      attempt(
        question({
          type: "MC",
          ceAnswer: null,
          alternatives: [{ letter: "A", isCorrect: false }],
        }),
      ),
    );
    expect((await post([{ questionId: "q1", userAnswer: "A" }])).status).toBe(422);
  });

  it("rejeita MC com duas alternativas corretas", async () => {
    mocks.findUnique.mockResolvedValue(
      attempt(
        question({
          type: "MC",
          ceAnswer: null,
          alternatives: [
            { letter: "A", isCorrect: true },
            { letter: "B", isCorrect: true },
          ],
        }),
      ),
    );
    expect((await post([{ questionId: "q1", userAnswer: "A" }])).status).toBe(422);
  });

  it("rejeita resposta duplicada", async () => {
    const baseAttempt = attempt();
    mocks.findUnique.mockResolvedValue({
      ...baseAttempt,
      simulatedExam: {
        ...baseAttempt.simulatedExam,
        questions: [
          { question: question() },
          { question: question({ id: "q2" }) },
        ],
      },
    });
    const response = await post([
      { questionId: "q1", userAnswer: "C" },
      { questionId: "q1", userAnswer: "C" },
    ]);
    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: "Existem respostas duplicadas para a mesma questão.",
    });
  });

  it.each(["inexistente", "de outra tentativa"])(
    "rejeita questão %s",
    async () => {
      const response = await post([
        { questionId: "external", userAnswer: "C" },
      ]);
      expect(response.status).toBe(400);
    },
  );

  it("mantém tentativa já finalizada sem alterar respostas", async () => {
    mocks.findUnique.mockResolvedValue({
      ...attempt(),
      finishedAt: new Date(),
      totalScore: 3,
    });
    const response = await post([{ questionId: "external", userAnswer: "X" }]);
    const body = (await response.json()) as {
      totalScore: number;
      alreadyFinished: boolean;
    };

    expect(response.status).toBe(200);
    expect(body).toEqual(
      expect.objectContaining({ totalScore: 3, alreadyFinished: true }),
    );
    expect(mocks.createMany).not.toHaveBeenCalled();
  });

  it("finaliza automaticamente como tempo esgotado", async () => {
    const expiredAttempt = attempt();
    mocks.findUnique.mockResolvedValue({
      ...expiredAttempt,
      simulatedExam: {
        ...expiredAttempt.simulatedExam,
        durationMinutes: 1,
      },
    });

    const response = await post([{ questionId: "q1", userAnswer: "C" }]);
    const body = (await response.json()) as { finishReason: string };

    expect(response.status).toBe(200);
    expect(body.finishReason).toBe("TIME_EXPIRED");
    expect(mocks.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          finishReason: "TIME_EXPIRED",
        }),
      }),
    );
  });

  it("impede finalizar tentativa de outro usuário", async () => {
    mocks.findUnique.mockResolvedValue({
      ...attempt(),
      userId: "other-user",
    });
    const response = await post([{ questionId: "q1", userAnswer: "C" }]);
    expect(response.status).toBe(403);
    expect(mocks.createMany).not.toHaveBeenCalled();
  });
});
