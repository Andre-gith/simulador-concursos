import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { downloadOfficialPdf } from "../src/lib/official-import/download";
import { PdfParseTextExtractor } from "../src/lib/import/pdf-extractor";

async function main() {
  const [sourceUrl] = process.argv.slice(2);
  if (!sourceUrl) throw new Error("Informe uma única URL HTTPS oficial de PDF.");
  const outputDirectory = resolve(process.cwd(), "data", "imports", "official-sources", "controlled-test");
  await mkdir(outputDirectory, { recursive: true });
  const pdfPath = resolve(outputDirectory, "official-document.pdf");
  const downloaded = await downloadOfficialPdf({
    url: sourceUrl,
    destination: pdfPath,
    approvedHosts: ["cebraspe.org.br"],
  });
  const extracted = await new PdfParseTextExtractor().extract(await readFile(pdfPath));
  const extractionPath = resolve(outputDirectory, "extraction.json");
  const extractionContents = `${JSON.stringify({
    sourceUrl: downloaded.finalUrl,
    pdf: { sha256: downloaded.sha256, size: downloaded.size, mimeType: downloaded.mimeType },
    extraction: { pages: extracted.pageCount, textCharacters: extracted.text.length },
    persistedImportJob: false,
    importedForReview: false,
    published: false,
  }, null, 2)}\n`;
  await writeFile(extractionPath, extractionContents, "utf8");
  const report = {
    ...JSON.parse(extractionContents),
    extractionArtifactSha256: createHash("sha256").update(extractionContents).digest("hex"),
  };
  console.log(JSON.stringify(report, null, 2));
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
