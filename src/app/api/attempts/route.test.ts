import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  findFirst: vi.fn(),
  transaction: vi.fn(),
  createSimulatedExam: vi.fn(),
  createAttempt: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    concurso: { findFirst: mocks.findFirst },
    $transaction: mocks.transaction,
  },
}));

vi.mock("@/auth", () => ({ auth: mocks.auth }));

import { POST } from "./route";

type TransactionClient = {
  simulatedExam: { create: typeof mocks.createSimulatedExam };
  attempt: { create: typeof mocks.createAttempt };
};

function request({
  subjectIds = ["subject"],
  questionCount = 1,
}: {
  subjectIds?: string[];
  questionCount?: number;
} = {}) {
  return new Request("http://localhost/api/attempts", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      concursoId: "contest",
      questionCount,
      subjectIds,
    }),
  });
}

function publishedContest(
  overrides: Partial<{
    scoringRule: { id: string } | null;
    questions: Array<{ id: string; subjectId: string }>;
  }> = {},
) {
  return {
    id: "contest",
    orgao: "Instituição",
    cargo: "Cargo",
    scoringRule: { id: "rule" },
    questions: [{ id: "q1", subjectId: "subject" }],
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.auth.mockResolvedValue({
    user: { id: "session-user", role: "USER", email: "user@example.com" },
  });
  mocks.findFirst.mockResolvedValue(publishedContest());
  mocks.createSimulatedExam.mockResolvedValue({ id: "exam" });
  mocks.createAttempt.mockResolvedValue({ id: "attempt" });
  mocks.transaction.mockImplementation(
    async (operation: (transaction: TransactionClient) => Promise<unknown>) =>
      operation({
        simulatedExam: { create: mocks.createSimulatedExam },
        attempt: { create: mocks.createAttempt },
      }),
  );
});

describe("POST /api/attempts", () => {
  it("exige autenticação", async () => {
    mocks.auth.mockResolvedValue(null);

    const response = await POST(request());

    expect(response.status).toBe(401);
    expect(mocks.findFirst).not.toHaveBeenCalled();
  });

  it("consulta somente concurso e questões PUBLISHED", async () => {
    await POST(request());

    expect(mocks.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "contest", status: "PUBLISHED" },
        select: expect.objectContaining({
          questions: expect.objectContaining({
            where: {
              status: "PUBLISHED",
              subjectId: { in: ["subject"] },
            },
            select: { id: true, subjectId: true },
          }),
        }),
      }),
    );
  });

  it.each(["DRAFT", "IN_REVIEW"])(
    "rejeita concurso %s porque não corresponde ao filtro publicado",
    async () => {
      mocks.findFirst.mockResolvedValue(null);

      const response = await POST(request());

      expect(response.status).toBe(404);
      expect(mocks.transaction).not.toHaveBeenCalled();
    },
  );

  it("exige regra de pontuação", async () => {
    mocks.findFirst.mockResolvedValue(
      publishedContest({ scoringRule: null }),
    );

    const response = await POST(request());

    expect(response.status).toBe(400);
    expect(mocks.transaction).not.toHaveBeenCalled();
  });

  it("rejeita matéria externa ou sem questão publicada", async () => {
    mocks.findFirst.mockResolvedValue(publishedContest());

    const response = await POST(
      request({ subjectIds: ["external-subject"] }),
    );

    expect(response.status).toBe(400);
    expect(mocks.transaction).not.toHaveBeenCalled();
  });

  it("rejeita IDs de matérias duplicados", async () => {
    const response = await POST(
      request({ subjectIds: ["subject", "subject"] }),
    );

    expect(response.status).toBe(400);
    expect(mocks.findFirst).not.toHaveBeenCalled();
  });

  it("rejeita quantidade maior que a disponível", async () => {
    const response = await POST(request({ questionCount: 2 }));

    expect(response.status).toBe(400);
    expect(mocks.transaction).not.toHaveBeenCalled();
  });

  it("vincula a tentativa ao usuário autenticado", async () => {
    const response = await POST(request());

    expect(response.status).toBe(201);
    expect(mocks.createAttempt).toHaveBeenCalledWith({
      data: {
        userId: "session-user",
        simulatedExamId: "exam",
      },
      select: { id: true },
    });
  });

  it("não seleciona nem retorna campos de gabarito", async () => {
    const response = await POST(request());
    const body = await response.json();
    const query = mocks.findFirst.mock.calls[0]?.[0];

    expect(body).toEqual({ attemptId: "attempt" });
    expect(JSON.stringify(query)).not.toMatch(
      /ceAnswer|isCorrect|alternatives|gabarito/i,
    );
  });
});
