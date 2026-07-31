import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { createContentSecurityPolicy } from "./content-security-policy";

describe("Content Security Policy", () => {
  it("permite eval somente para o React Refresh em desenvolvimento", () => {
    expect(createContentSecurityPolicy("development")).toContain(
      "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
    );
  });

  it("mantém a política de produção rigorosa e sem Google Fonts", () => {
    const policy = createContentSecurityPolicy("production");
    expect(policy).not.toContain("'unsafe-eval'");
    expect(policy).not.toContain("fonts.googleapis.com");
    expect(policy).not.toContain("fonts.gstatic.com");
    expect(policy).toContain("object-src 'none'");
    expect(policy).toContain("form-action 'self'");
    expect(policy).toContain("frame-ancestors 'none'");
  });

  it("carrega Inter por next/font sem links ou imports externos", () => {
    const layout = readFileSync(resolve("src/app/layout.tsx"), "utf8");
    const css = readFileSync(resolve("src/app/globals.css"), "utf8");
    expect(layout).toContain('from "next/font/google"');
    expect(`${layout}\n${css}`).not.toMatch(/fonts\.(googleapis|gstatic)\.com/);
    expect(css).not.toMatch(/@import\s+url/i);
  });
});
