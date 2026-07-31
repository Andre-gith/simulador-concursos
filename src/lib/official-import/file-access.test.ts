import { describe, expect, it } from "vitest";
import { validateStoredImportFile } from "./file-access";

describe("acesso autenticado a arquivos", () => {
  it("bloqueia caminho fora do diretório fixo antes de ler o arquivo", async () => {
    await expect(validateStoredImportFile("C:\\Windows\\win.ini", "job-id")).rejects.toThrow(/fora do diretório/);
  });
  it("bloqueia extensão executável", async () => {
    const path = `${process.cwd()}\\data\\imports\\official-sources\\job-id\\arquivo.exe`;
    await expect(validateStoredImportFile(path, "job-id")).rejects.toThrow(/Extensão/);
  });
});
