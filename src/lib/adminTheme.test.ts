import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

function source(path: string) {
  return readFileSync(resolve(path), "utf8");
}

describe("identidade e proteção administrativa", () => {
  it("aplica shell claro escopado sem alterar a home", () => {
    const shell = source("src/components/layout/AdminShell.tsx");
    const styles = source("src/app/globals.css");
    expect(shell).toContain("admin-surface");
    expect(shell).toContain("<AppShell");
    expect(styles).toContain(".admin-surface");
    expect(styles).toContain("background: #f6f4ed");
  });

  it.each([
    "src/app/admin/page.tsx",
    "src/app/admin/concursos/[id]/page.tsx",
    "src/app/admin/questoes/[id]/page.tsx",
    "src/app/admin/concursos/[id]/preview/page.tsx",
  ])("protege %s e reutiliza AdminShell", (path) => {
    const contents = source(path);
    expect(contents).toContain("requireAdmin");
    expect(contents).toContain("<AdminShell>");
  });
});
