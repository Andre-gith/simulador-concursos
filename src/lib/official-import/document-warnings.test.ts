import { describe, expect, it } from "vitest";
import { documentWarnings } from "./workflow";

describe("alertas de classificação documental", () => {
  it("avisa sobre prova, gabarito, duplicidade e cadernos conflitantes", () => {
    expect(documentWarnings([])).toEqual(expect.arrayContaining([
      "Nenhuma prova foi selecionada.", "Nenhum gabarito foi selecionado.",
    ]));
    const warnings = documentWarnings([
      { documentType: "EXAM", paperCode: "A" },
      { documentType: "ANSWER_KEY_FINAL", paperCode: "A" },
      { documentType: "ANSWER_KEY_FINAL", paperCode: "B" },
    ]);
    expect(warnings).toEqual(expect.arrayContaining([
      "Existem dois ou mais gabaritos definitivos; confirme o correto.",
      "Foram identificados documentos de cadernos diferentes.",
    ]));
  });
  it("não gera alerta quando prova e gabarito de um caderno estão presentes", () => {
    expect(documentWarnings([
      { documentType: "EXAM", paperCode: "A" },
      { documentType: "ANSWER_KEY_PRELIMINARY", paperCode: "A" },
    ])).toEqual([]);
  });
});
