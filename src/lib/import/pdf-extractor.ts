import pdfParse from "pdf-parse";

const PDF_HEADER = "%PDF-";
export const MAX_PDF_BYTES = 20 * 1024 * 1024;

export type ExtractedPdf = {
  text: string;
  pageCount: number;
};

export interface PdfTextExtractor {
  extract(buffer: Buffer): Promise<ExtractedPdf>;
}

export class PdfExtractionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PdfExtractionError";
  }
}

export function validatePdfBuffer(buffer: Buffer, label: string) {
  if (buffer.length === 0) {
    throw new PdfExtractionError(`${label}: o arquivo está vazio.`);
  }
  if (buffer.length > MAX_PDF_BYTES) {
    throw new PdfExtractionError(
      `${label}: o PDF excede o limite de 20 MB.`,
    );
  }
  if (buffer.subarray(0, PDF_HEADER.length).toString("ascii") !== PDF_HEADER) {
    throw new PdfExtractionError(`${label}: o arquivo enviado não é um PDF.`);
  }
}

export class PdfParseTextExtractor implements PdfTextExtractor {
  async extract(buffer: Buffer): Promise<ExtractedPdf> {
    validatePdfBuffer(buffer, "PDF");

    let result: Awaited<ReturnType<typeof pdfParse>>;
    let currentPage = 0;
    try {
      result = await pdfParse(buffer, {
        pagerender: async (pageData: unknown) => {
          currentPage += 1;
          if (
            typeof pageData !== "object" ||
            pageData === null ||
            !("getTextContent" in pageData) ||
            typeof pageData.getTextContent !== "function"
          ) {
            throw new PdfExtractionError(
              `Não foi possível ler a página ${currentPage} do PDF.`,
            );
          }
          const content = (await pageData.getTextContent()) as {
            items?: unknown[];
          };
          const pageText = (content.items ?? [])
            .map((item) =>
              typeof item === "object" &&
              item !== null &&
              "str" in item &&
              typeof item.str === "string"
                ? item.str
                : "",
            )
            .filter(Boolean)
            .join(" ");
          return `\n--- PÁGINA ${currentPage} ---\n${pageText}\n`;
        },
      });
    } catch (error) {
      throw new PdfExtractionError(
        `Não foi possível extrair o texto do PDF: ${
          error instanceof Error ? error.message : "erro desconhecido"
        }`,
      );
    }

    const text = result.text.trim();
    if (!text) {
      throw new PdfExtractionError(
        "O PDF não contém texto extraível. PDFs digitalizados precisam de OCR antes da importação.",
      );
    }

    return {
      text,
      pageCount: result.numpages,
    };
  }
}
