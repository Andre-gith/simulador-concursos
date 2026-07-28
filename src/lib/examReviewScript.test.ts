import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

const script = readFileSync(
  resolve(process.cwd(), "scripts/review-exam.ts"),
  "utf8",
);

describe("comando review:exam", () => {
  it("preserva questões arquivadas e a questão 67", () => {
    expect(script).toContain("PublicationStatus.ARCHIVED");
    expect(script).toContain("cms16on8y00ddvpvkbjcj4y5o");
    expect(script).toContain("Processo interrompido");
  });

  it("publica somente VERIFIED_AND_PUBLISHABLE em transação serializável", () => {
    expect(script).toContain('"VERIFIED_AND_PUBLISHABLE"');
    expect(script).toContain("prisma.$transaction");
    expect(script).toContain("TransactionIsolationLevel.Serializable");
    expect(script).toContain("validateQuestionForPublication");
    expect(script).toContain("validateContestForPublication");
  });

  it("exige confirmação explícita e protege revisão manual", () => {
    expect(script).toContain("confirmação explícita ausente");
    expect(script).toContain("revisão manual anterior");
    expect(script).toContain("não será sobrescrita");
  });

  it("não exclui questões, tentativas, respostas ou usuários", () => {
    expect(script).not.toMatch(/question\.(delete|deleteMany)/);
    expect(script).not.toMatch(/attempt\.(update|delete|deleteMany)/);
    expect(script).not.toMatch(/attemptAnswer\.(update|delete|deleteMany)/);
    expect(script).not.toMatch(/user\.(update|delete|deleteMany)/);
  });
});
