import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

const themedFiles = [
  "src/app/concursos/[id]/page.tsx",
  "src/app/concursos/[id]/StartSimuladoForm.tsx",
  "src/app/simulado/[attemptId]/SimuladoClient.tsx",
  "src/app/resultado/[attemptId]/page.tsx",
  "src/app/historico/page.tsx",
  "src/app/login/LoginForm.tsx",
  "src/app/registro/RegisterForm.tsx",
];

function source(path: string) {
  return readFileSync(resolve(path), "utf8");
}

describe("identidade visual das páginas públicas e autenticadas", () => {
  it.each(themedFiles)("%s não depende do tema preto e laranja", (path) => {
    const contents = source(path);
    for (const legacyClass of [
      "bg-neutral-950",
      "bg-neutral-900",
      "border-neutral-800",
      "bg-orange-500",
      "text-orange-400",
    ]) {
      expect(contents).not.toContain(legacyClass);
    }
  });

  it("reutiliza o shell claro e o cabeçalho da home", () => {
    const shell = source("src/components/layout/AppShell.tsx");
    expect(shell).toContain("bg-[#f6f4ed]");
    expect(shell).toContain("<HomeHeader");
  });

  it("mantém o gabarito fora do payload do simulado em andamento", () => {
    const page = source("src/app/simulado/[attemptId]/page.tsx");
    const client = source(
      "src/app/simulado/[attemptId]/SimuladoClient.tsx",
    );

    expect(page).not.toContain("ceAnswer:");
    expect(page).not.toContain("isCorrect:");
    expect(client).not.toMatch(/\bceAnswer\b|\bisCorrect\b|\bgabarito\b/i);
  });

  it("mantém proteção por sessão nas rotas autenticadas", () => {
    for (const path of [
      "src/app/simulado/[attemptId]/page.tsx",
      "src/app/resultado/[attemptId]/page.tsx",
      "src/app/historico/page.tsx",
    ]) {
      const contents = source(path);
      expect(contents).toContain("session?.user.id");
      expect(contents).toContain('redirect("/login")');
    }
  });
});
