import { describe, expect, it } from "vitest";
import { classifyMatch, normalizedIdentity } from "./normalize";

const record = (overrides = {}) => ({
  externalId: "1", institution: "Caixa", board: "Cesgranrio", position: "Técnico Bancário",
  specialty: "TI", year: 2026, edition: "1", raw: {}, ...overrides,
});

describe("deduplicação do catálogo comunitário", () => {
  it("trata Caixa e CEF como alias explicitamente registrado", () => {
    expect(classifyMatch(record(), { orgao: "Caixa Econômica Federal", banca: { name: "Cesgranrio" }, cargo: "Técnico Bancário", especialidade: "TI", ano: 2026, edicao: "1" })).toBe("EXACT");
  });
  it("não trata Petrobras e Transpetro como aliases", () => {
    expect(classifyMatch(record({ institution: "Petrobras" }), { orgao: "Transpetro", banca: { name: "Cesgranrio" }, cargo: "Técnico Bancário", especialidade: "TI", ano: 2026, edicao: "1" })).toBe("NONE");
  });
  it("marca especialidades, anos e bancas incompatíveis como conflito", () => {
    const base = { orgao: "CEF", banca: { name: "Cesgranrio" }, cargo: "Técnico Bancário", especialidade: "TI", ano: 2026, edicao: "1" };
    expect(classifyMatch(record({ specialty: "Enfermagem" }), base)).toBe("CONFLICT");
    expect(classifyMatch(record({ year: 2025 }), base)).toBe("CONFLICT");
    expect(classifyMatch(record({ board: "FGV" }), base)).toBe("CONFLICT");
  });
  it("não funde automaticamente quando ano ou banca estão ausentes", () => {
    const base = { orgao: "CEF", banca: null, cargo: "Técnico Bancário", especialidade: "TI", ano: null, edicao: "1" };
    expect(classifyMatch(record({ board: null, year: null }), base)).toBe("PROBABLE");
  });
  it("inclui especialidade, ano, banca e edição na identidade", () => {
    expect(normalizedIdentity(record())).not.toBe(normalizedIdentity(record({ year: 2025 })));
  });
});
