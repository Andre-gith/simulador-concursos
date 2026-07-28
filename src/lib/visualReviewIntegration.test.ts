import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

const actionSource = readFileSync(resolve("src/app/admin/actions.ts"), "utf8");
const pageSource = readFileSync(
  resolve("src/app/admin/revisao-visual/banco-do-brasil/page.tsx"),
  "utf8",
);
const previewSource = readFileSync(
  resolve("src/app/admin/revisao-visual/banco-do-brasil/preview/page.tsx"),
  "utf8",
);

describe("revisão visual administrativa", () => {
  it("exige ADMIN, confirmação explícita e transação serializável", () => {
    expect(actionSource).toContain("export async function approveVisualQuestions");
    expect(actionSource).toContain("await requireAdmin()");
    expect(actionSource).toContain("Confirmo que o recurso visual corresponde");
    expect(actionSource).toContain("TransactionIsolationLevel.Serializable");
  });

  it("não inclui a questão 67 arquivada na fila", () => {
    expect(pageSource).toContain('id: { not: "cms16on8y00ddvpvkbjcj4y5o" }');
    expect(previewSource).toContain('id: { not: "cms16on8y00ddvpvkbjcj4y5o" }');
  });

  it("prévia não consulta gabarito nem cria tentativa", () => {
    expect(previewSource).not.toContain("isCorrect");
    expect(previewSource).not.toContain("ceAnswer");
    expect(previewSource).not.toContain("attempt.create");
    expect(previewSource).not.toContain("prisma.$transaction");
  });
});
