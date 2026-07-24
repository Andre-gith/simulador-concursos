import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";

import { z } from "zod";

import type {
  ExamExtractionInput,
  ExamExtractor,
} from "../ai/exam-extractor";
import type { ExamImportService } from "./import-service";
import {
  PdfParseTextExtractor,
  validatePdfBuffer,
  type PdfTextExtractor,
} from "./pdf-extractor";

const optionalText = z
  .string()
  .trim()
  .transform((value) => value || undefined)
  .optional();

export const pdfImportMetadataSchema = z
  .object({
    agency: z.string().trim().min(1, "Informe a instituição."),
    board: optionalText,
    year: z
      .string()
      .trim()
      .transform((value) => (value ? Number(value) : undefined))
      .pipe(z.number().int().min(1900).max(2200).optional()),
    edition: optionalText,
    position: optionalText,
    specialty: optionalText,
    educationLevel: z
      .enum(["", "FUNDAMENTAL", "MEDIO", "TECNICO", "SUPERIOR"])
      .transform((value) => value || undefined),
    paperCode: optionalText,
  })
  .strict();

export type PdfImportMetadata = z.infer<typeof pdfImportMetadataSchema>;

export type PdfImportFiles = {
  exam: Buffer;
  answerKey: Buffer;
};

export type PdfImportWorkflowResult = {
  workspaceId: string;
  intermediateRelativePath: string;
  imported: boolean;
  importResult?: Awaited<ReturnType<ExamImportService["importAiDocument"]>>;
};

export function validatePdfPair(files: Partial<PdfImportFiles>) {
  if (!files.exam) throw new Error("O PDF oficial da prova é obrigatório.");
  if (!files.answerKey) {
    throw new Error("O PDF oficial do gabarito é obrigatório.");
  }
  validatePdfBuffer(files.exam, "Prova");
  validatePdfBuffer(files.answerKey, "Gabarito");
  return files as PdfImportFiles;
}

type WorkflowOptions = {
  files: PdfImportFiles;
  metadata: PdfImportMetadata;
  extractor?: PdfTextExtractor;
  aiExtractor?: ExamExtractor;
  importService?: ExamImportService;
  workspaceRoot?: string;
};

export async function runPdfImportWorkflow({
  files,
  metadata,
  extractor = new PdfParseTextExtractor(),
  aiExtractor,
  importService,
  workspaceRoot = resolve(process.cwd(), "data", "imports"),
}: WorkflowOptions): Promise<PdfImportWorkflowResult> {
  validatePdfPair(files);

  const workspaceId = randomUUID();
  const workspace = join(workspaceRoot, workspaceId);
  await mkdir(workspace, { recursive: true });
  await Promise.all([
    writeFile(join(workspace, "prova.pdf"), files.exam),
    writeFile(join(workspace, "gabarito.pdf"), files.answerKey),
  ]);

  const [exam, answerKey] = await Promise.all([
    extractor.extract(files.exam),
    extractor.extract(files.answerKey),
  ]);
  const examSourceReference = `local-document://${workspaceId}/prova.pdf`;
  const answerKeySourceReference = `local-document://${workspaceId}/gabarito.pdf`;
  const extractionInput: ExamExtractionInput = {
    examText: exam.text,
    answerKeyText: answerKey.text,
    examPageCount: exam.pageCount,
    answerKeyPageCount: answerKey.pageCount,
    examSourceReference,
    answerKeySourceReference,
    metadata,
  };
  const intermediateRelativePath = `data/imports/${workspaceId}/intermediario.json`;
  await writeFile(
    join(workspace, "intermediario.json"),
    JSON.stringify(
      {
        createdAt: new Date().toISOString(),
        status: aiExtractor ? "AWAITING_AI" : "TEXT_EXTRACTED",
        ...extractionInput,
      },
      null,
      2,
    ),
    "utf8",
  );

  if (!aiExtractor || !importService) {
    return {
      workspaceId,
      intermediateRelativePath,
      imported: false,
    };
  }

  const aiDocument = await aiExtractor.extract(extractionInput);
  await writeFile(
    join(workspace, "resposta-ia.json"),
    JSON.stringify(aiDocument, null, 2),
    "utf8",
  );
  const importResult = await importService.importAiDocument(aiDocument, {
    exam: examSourceReference,
    answerKey: answerKeySourceReference,
  });
  return {
    workspaceId,
    intermediateRelativePath,
    imported: true,
    importResult,
  };
}
