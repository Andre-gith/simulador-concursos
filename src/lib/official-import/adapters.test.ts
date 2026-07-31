import { describe, expect, it } from "vitest";
import { CebraspeSourceAdapter, CesgranrioSourceAdapter, GenericOfficialPageAdapter, ManualSourceAdapter } from "./adapters";

const html = `<a href="/prova.pdf">Caderno de prova</a><a href="https://x.gov.br/gabarito-final.pdf">Gabarito definitivo</a><a href="/edital.pdf">Edital</a>`;

describe("adaptadores oficiais", () => {
  it("descobre e classifica documentos sem estrutura fixa", async () => {
    const result = await new GenericOfficialPageAdapter().analyze(new URL("https://x.gov.br/concurso"), html);
    expect(result.status).toBe("READY");
    expect(result.documents.map((item) => item.documentType)).toEqual(["EXAM", "ANSWER_KEY_FINAL", "NOTICE"]);
  });
  it("identifica Cebraspe e Cesgranrio", () => {
    expect(new CebraspeSourceAdapter().supports(new URL("https://www.cebraspe.org.br/x"))).toBe(true);
    expect(new CesgranrioSourceAdapter().supports(new URL("https://concursos.cesgranrio.org.br/x"))).toBe(true);
  });
  it("modo manual nunca presume classificação segura", async () => {
    const result = await new ManualSourceAdapter().analyze(new URL("https://x.gov.br/prova.pdf"));
    expect(result.status).toBe("MANUAL_REVIEW_REQUIRED");
    expect(result.documents[0].confidence).toBe("LOW");
  });
});
