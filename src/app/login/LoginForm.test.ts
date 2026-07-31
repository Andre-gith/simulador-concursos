import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(resolve("src/app/login/LoginForm.tsx"), "utf8");

describe("formulário de login", () => {
  it("submete por POST e impede a navegação padrão", () => {
    expect(source).toContain('method="post"');
    expect(source).toContain("event.preventDefault()");
    expect(source).not.toContain('method="get"');
  });

  it("não envia senha por query string, redirect ou logs", () => {
    expect(source).not.toMatch(/searchParams/);
    expect(source).not.toMatch(/[?&]password=/);
    expect(source).not.toMatch(/console\.(log|info|warn|error)/);
    expect(source).toContain("redirect: false");
  });

  it("usa autocomplete apropriado e erro genérico", () => {
    expect(source).toContain('autoComplete="email"');
    expect(source).toContain('autoComplete="current-password"');
    expect(source).toContain("E-mail ou senha inv");
    expect(source).not.toMatch(/usuário inexistente|senha incorreta/i);
  });
});
