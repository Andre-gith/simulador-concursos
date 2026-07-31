import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("admin de monitoramento", () => {
  it("todas as páginas e ações exigem ADMIN", () => {
    for (const file of [
      "src/app/admin/monitoramento/page.tsx",
      "src/app/admin/monitoramento/novo/page.tsx",
      "src/app/admin/monitoramento/[id]/page.tsx",
      "src/app/admin/monitoramento/alteracoes/page.tsx",
      "src/app/admin/monitoramento/actions.ts",
    ]) expect(readFileSync(resolve(file), "utf8")).toContain("requireAdmin");
  });
  it("home pública permanece sem referências ao monitoramento", () => {
    const home = readFileSync(resolve("src/app/(public)/page.tsx"), "utf8");
    expect(home).not.toContain("/admin/monitoramento");
    expect(home).not.toContain("Atualizações oficiais pendentes");
  });
});
