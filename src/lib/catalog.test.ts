import { describe, expect, it } from "vitest";

import {
  filterCatalog,
  hasSameCatalogIdentity,
  isAvailableContest,
  isPreparingContest,
  type CatalogContest,
} from "./catalog";

function contest(
  overrides: Partial<CatalogContest> = {},
): CatalogContest {
  return {
    id: "contest",
    institution: "Banco do Brasil",
    position: "Escriturário",
    specialty: "Agente de Tecnologia",
    board: "CESGRANRIO",
    edition: "2023/001",
    year: 2023,
    level: "MEDIO",
    status: "PUBLISHED",
    hasScoringRule: true,
    publishedQuestionCount: 10,
    subjects: ["Tecnologia da Informação"],
    scoringType: "MC_NO_PENALTY",
    pointsCorrect: 1,
    pointsWrong: 0,
    floorAtZero: true,
    ...overrides,
  };
}

describe("catálogo da home", () => {
  it("separa disponíveis e em preparação", () => {
    const available = contest();
    const preparing = contest({ id: "review", status: "IN_REVIEW" });

    expect(isAvailableContest(available)).toBe(true);
    expect(isPreparingContest(available)).toBe(false);
    expect(isAvailableContest(preparing)).toBe(false);
    expect(isPreparingContest(preparing)).toBe(true);
  });

  it("busca por instituição, cargo, especialidade, banca e edição", () => {
    const item = contest();
    for (const query of [
      "banco do brasil",
      "escriturário",
      "tecnologia",
      "cesgranrio",
      "2023/001",
    ]) {
      expect(filterCatalog([item], query, "all")).toEqual([item]);
    }
    expect(filterCatalog([item], "petrobras", "all")).toEqual([]);
  });

  it("filtra por banca e nível", () => {
    const item = contest();
    expect(filterCatalog([item], "", "cesgranrio")).toHaveLength(1);
    expect(filterCatalog([item], "", "cebraspe")).toHaveLength(0);
    expect(filterCatalog([item], "", "mid-level")).toHaveLength(1);
    expect(filterCatalog([item], "", "higher-level")).toHaveLength(0);
  });

  it("mantém concurso publicado disponível quando completo", () => {
    expect(isAvailableContest(contest({ status: "PUBLISHED" }))).toBe(true);
  });

  it("classifica concurso em revisão como preparação", () => {
    expect(isPreparingContest(contest({ status: "IN_REVIEW" }))).toBe(true);
  });

  it("classifica concurso sem questões publicadas como preparação", () => {
    expect(
      isPreparingContest(contest({ publishedQuestionCount: 0 })),
    ).toBe(true);
  });

  it("reconhece a mesma entrada editorial sem misturar especialidades", () => {
    const technology = {
      institution: " Banco do Brasil ",
      position: "Escriturário",
      specialty: "Agente de Tecnologia",
    };

    expect(
      hasSameCatalogIdentity(technology, {
        institution: "banco do brasil",
        position: "Escriturário",
        specialty: "Agente de Tecnologia",
      }),
    ).toBe(true);
    expect(
      hasSameCatalogIdentity(technology, {
        institution: "Banco do Brasil",
        position: "Escriturário",
        specialty: "Agente Comercial",
      }),
    ).toBe(false);
  });

  it("deduplica entrada editorial sem cargo quando a especialidade já virou concurso", () => {
    expect(
      hasSameCatalogIdentity(
        {
          institution: "Transpetro",
          position: "Profissional Transpetro de Nível Médio — Júnior",
          specialty: "Manutenção | Mecânica",
        },
        {
          institution: "Transpetro",
          position: null,
          specialty: "Manutenção | Mecânica",
        },
      ),
    ).toBe(true);
  });
});
