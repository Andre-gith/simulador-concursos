import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const cards = readFileSync(
  resolve("src/components/home/ContestCards.tsx"),
  "utf8",
);
const home = readFileSync(resolve("src/app/(public)/page.tsx"), "utf8");

describe("cards de concursos da home", () => {
  it("preserva e quebra naturalmente edições longas", () => {
    expect(cards).toContain("{editionLabel(contest)}");
    expect(cards).toContain("min-w-0");
    expect(cards).toContain("break-words");
    expect(cards).toContain("[overflow-wrap:anywhere]");
    expect(cards).not.toMatch(/\btruncate\b/);
    expect(cards).not.toMatch(/\boverflow-hidden\b/);
    expect(cards).not.toMatch(/line-clamp/);
  });

  it("usa células e colunas que podem encolher sem rolagem horizontal", () => {
    expect(cards).toContain(
      "grid-cols-[minmax(0,1fr)_minmax(0,1fr)]",
    );
    expect(home).toContain(
      "md:grid-cols-[repeat(2,minmax(0,1fr))]",
    );
    expect(home).toContain(
      "xl:grid-cols-[repeat(3,minmax(0,1fr))]",
    );
    expect(`${cards}\n${home}`).not.toMatch(/overflow-x-(auto|scroll)/);
  });
});
