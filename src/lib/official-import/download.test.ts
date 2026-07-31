import { describe, expect, it } from "vitest";
import { safeImportPath } from "./download";
import { validatePdfBuffer } from "../import/pdf-extractor";

describe("armazenamento de documentos oficiais", () => {
  it("bloqueia path traversal", () => {
    expect(() => safeImportPath("C:\\data\\imports", "..", "segredo")).toThrow(/traversal/);
  });
  it("valida assinatura PDF independentemente de MIME", () => {
    const fake = Buffer.from("não é pdf");
    expect(() => validatePdfBuffer(fake, "Documento")).toThrow(/não é um PDF/);
  });
  it("rejeita PDF acima do limite", () => {
    expect(() => validatePdfBuffer(Buffer.concat([Buffer.from("%PDF-"), Buffer.alloc(20 * 1024 * 1024)]), "Documento")).toThrow(/20 MB/);
  });
});
