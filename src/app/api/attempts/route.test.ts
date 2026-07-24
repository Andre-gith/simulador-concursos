import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  findFirst: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    concurso: { findFirst: mocks.findFirst },
  },
}));

vi.mock("@/auth", () => ({
  auth: vi.fn(async () => ({
    user: { id: "user", role: "USER", email: "user@example.com" },
  })),
}));

import { POST } from "./route";

function request(subjectIds = ["subject"]) {
  return new Request("http://localhost/api/attempts", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      concursoId: "contest",
      questionCount: 1,
      subjectIds,
    }),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("POST start validation", () => {
  it("rejeita matéria de outro concurso", async () => {
    mocks.findFirst.mockResolvedValue({
      id: "contest",
      orgao: "Órgão",
      cargo: "Cargo",
      scoringRule: { id: "rule" },
      questions: [{ id: "q1", subjectId: "subject" }],
    });

    const response = await POST(request(["external-subject"]));
    expect(response.status).toBe(400);
  });

  it("rejeita concurso sem regra de pontuação", async () => {
    mocks.findFirst.mockResolvedValue({
      id: "contest",
      orgao: "Órgão",
      cargo: "Cargo",
      scoringRule: null,
      questions: [{ id: "q1", subjectId: "subject" }],
    });

    const response = await POST(request());
    expect(response.status).toBe(400);
  });
});
