import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

function source(path: string) {
  return readFileSync(resolve(process.cwd(), path), "utf8");
}

describe("integração da revisão em lote", () => {
  const page = source("src/app/admin/page.tsx");
  const form = source("src/components/admin/BulkReviewForm.tsx");
  const actions = source("src/app/admin/actions.ts");

  it("usa a Server Action diretamente no formulário cliente", () => {
    expect(form).toContain(
      'import { bulkReviewQuestions } from "@/app/admin/actions"',
    );
    expect(form).toContain("action={bulkReviewQuestions}");
    expect(page).toContain("<BulkReviewForm>");
    expect(page).not.toContain(
      "<BulkReviewForm action={bulkReviewQuestions}>",
    );
  });

  it("mantém a assinatura FormData sem misturar useActionState", () => {
    expect(actions).toContain(
      "export async function bulkReviewQuestions(data: FormData)",
    );
    expect(form).not.toContain("useActionState");
    expect(actions.startsWith('"use server"')).toBe(true);
  });

  it("não chama action.call e apresenta validação sem seleção", () => {
    expect(form).not.toContain(".call(");
    expect(page).not.toContain(".call(");
    expect(form).toContain("Selecione pelo menos uma questão");
    expect(form).toContain('role="alert"');
  });
});
