import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

const actions = readFileSync(
  resolve(process.cwd(), "src/app/admin/actions.ts"),
  "utf8",
);
const attemptRoute = readFileSync(
  resolve(process.cwd(), "src/app/api/attempts/route.ts"),
  "utf8",
);

describe("segurança das ações administrativas de publicação", () => {
  it("exige ADMIN em publicação individual, lote e concurso", () => {
    for (const action of [
      "setQuestionStatus",
      "bulkReviewQuestions",
      "setContestStatus",
    ]) {
      const start = actions.indexOf(`function ${action}`);
      expect(start).toBeGreaterThan(-1);
      expect(actions.slice(start, start + 500)).toContain("requireAdmin()");
    }
  });

  it("executa publicações em transação serializável e registra publishedAt", () => {
    expect(actions).toContain("prisma.$transaction");
    expect(actions).toContain("TransactionIsolationLevel.Serializable");
    expect(actions).toContain("publishedAt");
    expect(actions).toContain("validateQuestionForPublication");
    expect(actions).toContain("validateContestForPublication");
  });

  it("não apaga tentativas nem histórico ao retornar concurso para revisão", () => {
    expect(actions).not.toMatch(/attempt\.(delete|deleteMany)/);
    expect(actions).not.toMatch(/simulatedExam\.(delete|deleteMany)/);
    expect(actions).not.toMatch(/attemptAnswer\.(delete|deleteMany)/);
  });

  it("a API continua consultando somente concurso e questões PUBLISHED", () => {
    expect(attemptRoute).toContain('status: "PUBLISHED"');
    expect(attemptRoute.match(/status: "PUBLISHED"/g)?.length).toBeGreaterThanOrEqual(
      2,
    );
  });
});
