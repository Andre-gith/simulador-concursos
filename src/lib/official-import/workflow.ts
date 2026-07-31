import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { basename, resolve } from "node:path";
import type { ArtifactType, DocumentType, ImportJobStage, PrismaClient } from "@prisma/client";
import { Prisma } from "@prisma/client";
import { PdfParseTextExtractor } from "../import/pdf-extractor";
import { examImportSchema, formatImportValidationErrors, summarizeExamImport } from "../examImportSchema";
import { sourceAdapters } from "./adapters";
import { downloadOfficialPdf, safeImportPath } from "./download";
import type { OfficialImportMetadata } from "./types";
import { approvedOfficialHosts, DOWNLOAD_LIMITS, parseSecureUrl, validatePublicDns } from "./url-security";

const root = resolve(process.cwd(), "data", "imports", "official-sources");

function digest(value: string | Buffer) {
  return createHash("sha256").update(value).digest("hex");
}

function cleanFilename(value: string, fallback: string) {
  const cleaned = basename(value).normalize("NFKD").replace(/[^\w.-]+/g, "-").replace(/^\.+/, "").slice(0, 100);
  return cleaned && cleaned.toLowerCase().endsWith(".pdf") ? cleaned : `${fallback}.pdf`;
}

async function audit(prisma: PrismaClient, importJobId: string, adminUserId: string, action: string, details?: Prisma.InputJsonValue) {
  await prisma.importAuditEvent.create({ data: { importJobId, adminUserId, action, details } });
}

async function fetchOfficialPage(url: URL, fetcher: typeof fetch) {
  let current = url;
  for (let count = 0; count <= DOWNLOAD_LIMITS.maxRedirects; count += 1) {
    await validatePublicDns(current);
    const response = await fetcher(current, { redirect: "manual", signal: AbortSignal.timeout(DOWNLOAD_LIMITS.timeoutMs),
      headers: { "user-agent": "NotaDeBanca-OfficialImporter/1.0" } });
    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get("location");
      if (!location) throw new Error("Redirecionamento inválido.");
      current = parseSecureUrl(new URL(location, current).href, approvedOfficialHosts());
      continue;
    }
    if (!response.ok) throw new Error(`Página oficial indisponível (HTTP ${response.status}).`);
    const type = response.headers.get("content-type")?.toLowerCase() ?? "";
    if (!type.includes("text/html") && !type.includes("application/xhtml+xml")) {
      throw new Error("A URL oficial não retornou uma página HTML.");
    }
    const text = await response.text();
    if (Buffer.byteLength(text) > 2 * 1024 * 1024) throw new Error("Página oficial excede 2 MB.");
    return { current, text };
  }
  throw new Error("Limite de redirecionamentos excedido.");
}

export async function prepareOfficialImport(prisma: PrismaClient, metadata: OfficialImportMetadata, adminUserId: string) {
  const hosts = approvedOfficialHosts();
  const url = parseSecureUrl(metadata.officialUrl, hosts);
  const idempotencyKey = digest(JSON.stringify({
    url: url.href, institution: metadata.institution.trim(), position: metadata.position.trim(),
    specialty: metadata.specialty?.trim() ?? "", edition: metadata.edition?.trim() ?? "", paperCode: metadata.paperCode?.trim() ?? "",
  }));
  const existing = await prisma.importJob.findUnique({ where: { idempotencyKey } });
  if (existing) return { job: existing, reused: true };
  const job = await prisma.importJob.create({ data: {
    pdfUrl: url.href, officialUrl: url.href, idempotencyKey, institution: metadata.institution,
    position: metadata.position, specialty: metadata.specialty, board: metadata.board, year: metadata.year,
    edition: metadata.edition, paperCode: metadata.paperCode, adminNotes: metadata.adminNotes,
    adminUserId, stage: "DISCOVERING_DOCUMENTS", startedAt: new Date(),
  } });
  return { job, reused: false };
}

export async function discoverOfficialImport(prisma: PrismaClient, jobId: string, adminUserId: string, fetcher = fetch) {
  const job = await prisma.importJob.findUniqueOrThrow({ where: { id: jobId } });
  if (!job.officialUrl) throw new Error("ImportJob sem URL oficial.");
  const url = parseSecureUrl(job.officialUrl, approvedOfficialHosts());
  try {
    const page = await fetchOfficialPage(url, fetcher);
    const adapter = sourceAdapters.find((candidate) => candidate.supports(page.current))!;
    const analysis = await adapter.analyze(page.current, page.text);
    if (analysis.documents.length > DOWNLOAD_LIMITS.maxDocuments) throw new Error("A página excede o limite de 12 documentos.");
    await prisma.$transaction([
      ...analysis.documents.map((document) => prisma.sourceDocument.create({ data: {
        importJobId: job.id, sourceUrl: document.url, documentType: document.documentType,
        originalFilename: document.title, metadata: { confidence: document.confidence },
      } })),
      prisma.importJob.update({ where: { id: job.id }, data: {
        board: job.board ?? analysis.detectedBoard, stage: "WAITING_DOCUMENT_SELECTION",
        warnings: analysis.warning ? [analysis.warning] : Prisma.JsonNull,
        report: { adapter: analysis.adapter, analysisStatus: analysis.status },
      } }),
    ]);
    await audit(prisma, job.id, adminUserId, "DOCUMENTS_DISCOVERED", { url: page.current.href, adapter: analysis.adapter, count: analysis.documents.length });
    return { job: await prisma.importJob.findUniqueOrThrow({ where: { id: job.id } }), reused: false };
  } catch (error) {
    await prisma.importJob.update({ where: { id: job.id }, data: { stage: "FAILED", previousStage: "DISCOVERING_DOCUMENTS", errorMessage: error instanceof Error ? error.message : String(error), finishedAt: new Date() } });
    await audit(prisma, job.id, adminUserId, "FAILED", { stage: "DISCOVERING_DOCUMENTS", message: error instanceof Error ? error.message : String(error) });
    throw error;
  }
}

export async function analyzeOfficialSource(prisma: PrismaClient, metadata: OfficialImportMetadata, adminUserId: string, fetcher = fetch) {
  const prepared = await prepareOfficialImport(prisma, metadata, adminUserId);
  if (prepared.reused) return prepared;
  return discoverOfficialImport(prisma, prepared.job.id, adminUserId, fetcher);
}

export type ManualDocumentInput = {
  url: string;
  documentType: DocumentType;
  description?: string;
  paperCode?: string;
  publishedAt?: Date;
  displayOrder: number;
};

export async function createManualImport(
  prisma: PrismaClient,
  metadata: Omit<OfficialImportMetadata, "officialUrl">,
  documents: ManualDocumentInput[],
  adminUserId: string,
) {
  if (!documents.length || documents.length > DOWNLOAD_LIMITS.maxDocuments) {
    throw new Error("Informe entre 1 e 12 URLs diretas.");
  }
  const normalized = documents.map((document) => ({
    ...document,
    url: parseSecureUrl(document.url, approvedOfficialHosts()).href,
  }));
  const idempotencyKey = digest(JSON.stringify({
    urls: normalized.map(({ url, documentType, paperCode }) => ({ url, documentType, paperCode })),
    institution: metadata.institution.trim(), position: metadata.position.trim(),
    specialty: metadata.specialty?.trim() ?? "", edition: metadata.edition?.trim() ?? "",
  }));
  const existing = await prisma.importJob.findUnique({ where: { idempotencyKey } });
  if (existing) return { job: existing, reused: true };
  const job = await prisma.importJob.create({ data: {
    pdfUrl: normalized[0].url, officialUrl: normalized[0].url, idempotencyKey,
    institution: metadata.institution, position: metadata.position, specialty: metadata.specialty,
    board: metadata.board, year: metadata.year, edition: metadata.edition, paperCode: metadata.paperCode,
    adminNotes: metadata.adminNotes, adminUserId, stage: "WAITING_DOCUMENT_SELECTION", startedAt: new Date(),
    sourceDocuments: { create: normalized.map((document) => ({
      sourceUrl: document.url, documentType: document.documentType, originalFilename: document.description,
      description: document.description, paperCode: document.paperCode, publishedAt: document.publishedAt,
      displayOrder: document.displayOrder, metadata: { confidence: "ADMIN_CONFIRMED", detectedType: document.documentType },
    })) },
    report: { adapter: "ManualSourceAdapter", analysisStatus: "ADMIN_CONFIRMED" },
  } });
  await audit(prisma, job.id, adminUserId, "MANUAL_URLS_ADDED", { count: normalized.length });
  return { job, reused: false };
}

export function documentWarnings(documents: Array<{ documentType: DocumentType; paperCode: string | null }>) {
  const warnings: string[] = [];
  const valid = documents;
  if (!valid.some((doc) => doc.documentType === "EXAM")) warnings.push("Nenhuma prova foi selecionada.");
  if (!valid.some((doc) => doc.documentType === "ANSWER_KEY_PRELIMINARY" || doc.documentType === "ANSWER_KEY_FINAL")) warnings.push("Nenhum gabarito foi selecionado.");
  if (valid.filter((doc) => doc.documentType === "ANSWER_KEY_FINAL").length > 1) warnings.push("Existem dois ou mais gabaritos definitivos; confirme o correto.");
  const papers = new Set(valid.map((doc) => doc.paperCode).filter(Boolean));
  if (papers.size > 1) warnings.push("Foram identificados documentos de cadernos diferentes.");
  return warnings;
}

export async function classifyDocuments(
  prisma: PrismaClient,
  jobId: string,
  updates: Array<{ id: string; documentType: DocumentType; selected: boolean }>,
  adminUserId: string,
) {
  const owned = await prisma.sourceDocument.count({ where: { importJobId: jobId, id: { in: updates.map((item) => item.id) } } });
  if (owned !== updates.length) throw new Error("Um documento não pertence ao trabalho.");
  const selected = updates.filter((item) => item.selected);
  if (!selected.length) throw new Error("Selecione ao menos um documento.");
  const docs = await prisma.sourceDocument.findMany({ where: { importJobId: jobId } });
  const selectedIds = new Set(selected.map((item) => item.id));
  const merged = docs.filter((doc) => selectedIds.has(doc.id)).map((doc) => {
    const update = updates.find((item) => item.id === doc.id);
    return { documentType: update?.documentType ?? doc.documentType, paperCode: doc.paperCode };
  });
  const warnings = documentWarnings(merged);
  await prisma.$transaction([
    ...updates.map((item) => prisma.sourceDocument.update({ where: { id: item.id }, data: {
      documentType: item.documentType, status: item.selected ? "SELECTED" : "DISCOVERED",
      metadata: { confirmedByAdmin: true },
    } })),
    prisma.importJob.update({ where: { id: jobId }, data: { stage: "DOWNLOADING", warnings } }),
    prisma.importAuditEvent.create({ data: { importJobId: jobId, adminUserId, action: "DOCUMENT_CLASSIFICATION_CONFIRMED", details: { warnings } } }),
  ]);
  return warnings;
}

export async function selectDestination(
  prisma: PrismaClient,
  jobId: string,
  destinationType: "NEW_CONTEST" | "EDITORIAL_ENTRY" | "EXISTING_CONTEST_NEW_PAPER" | "CANCELLED",
  destinationId: string | undefined,
  adminUserId: string,
) {
  if (destinationType === "EXISTING_CONTEST_NEW_PAPER") {
    const contest = await prisma.concurso.findUnique({ where: { id: destinationId ?? "" }, select: { status: true } });
    if (!contest || !["DRAFT", "IN_REVIEW"].includes(contest.status)) throw new Error("Somente concursos DRAFT ou IN_REVIEW podem receber caderno.");
  }
  if (destinationType === "EDITORIAL_ENTRY") {
    const entry = await prisma.editorialCatalogEntry.findUnique({ where: { id: destinationId ?? "" }, select: { id: true } });
    if (!entry) throw new Error("Entrada editorial inválida.");
  }
  const cancelled = destinationType === "CANCELLED";
  await prisma.importJob.update({ where: { id: jobId }, data: {
    destinationType,
    destinationContestId: destinationType === "EXISTING_CONTEST_NEW_PAPER" ? destinationId : null,
    destinationEditorialEntryId: destinationType === "EDITORIAL_ENTRY" ? destinationId : null,
    cancelledAt: cancelled ? new Date() : null,
  } });
  await audit(prisma, jobId, adminUserId, cancelled ? "IMPORT_CANCELLED" : "DESTINATION_SELECTED", { destinationType, destinationId });
}

export async function selectDocuments(prisma: PrismaClient, jobId: string, ids: string[], adminUserId: string) {
  if (!ids.length || ids.length > DOWNLOAD_LIMITS.maxDocuments) throw new Error("Selecione entre 1 e 12 documentos.");
  await prisma.$transaction([
    prisma.sourceDocument.updateMany({ where: { importJobId: jobId }, data: { status: "DISCOVERED" } }),
    prisma.sourceDocument.updateMany({ where: { importJobId: jobId, id: { in: ids } }, data: { status: "SELECTED" } }),
    prisma.importJob.update({ where: { id: jobId }, data: { stage: "DOWNLOADING", errorMessage: null } }),
  ]);
  await audit(prisma, jobId, adminUserId, "DOCUMENTS_SELECTED", { documentIds: ids });
}

export async function downloadSelectedDocuments(prisma: PrismaClient, jobId: string, adminUserId: string) {
  const documents = await prisma.sourceDocument.findMany({ where: { importJobId: jobId, status: "SELECTED" } });
  if (!documents.length) throw new Error("Nenhum documento selecionado.");
  const jobRoot = safeImportPath(root, jobId);
  await mkdir(safeImportPath(jobRoot, "documents"), { recursive: true });
  try {
    for (const [index, document] of documents.entries()) {
      const filename = cleanFilename(document.originalFilename ?? new URL(document.sourceUrl).pathname, `documento-${index + 1}`);
      const destination = safeImportPath(jobRoot, "documents", `${document.id}-${filename}`);
      const result = await downloadOfficialPdf({ url: document.sourceUrl, destination, approvedHosts: approvedOfficialHosts() });
      const same = await prisma.sourceDocument.findFirst({ where: { importJobId: jobId, sha256: result.sha256, documentType: document.documentType, id: { not: document.id } } });
      if (same) {
        await prisma.sourceDocument.update({ where: { id: document.id }, data: { status: "SUPERSEDED", sha256: result.sha256, size: result.size, mimeType: result.mimeType, localPath: destination } });
        continue;
      }
      const previous = await prisma.sourceDocument.findFirst({ where: { sourceUrl: document.sourceUrl, documentType: document.documentType, sha256: { not: null }, id: { not: document.id } }, orderBy: { version: "desc" } });
      await prisma.sourceDocument.update({ where: { id: document.id }, data: {
        status: "VALIDATED", sha256: result.sha256, size: result.size, mimeType: result.mimeType,
        localPath: destination, downloadedAt: new Date(), version: previous ? previous.version + 1 : 1, supersedesId: previous?.id,
      } });
    }
    await writeManifest(prisma, jobId);
    await prisma.importJob.update({ where: { id: jobId }, data: { stage: "EXTRACTING", errorMessage: null } });
    await audit(prisma, jobId, adminUserId, "DOCUMENTS_DOWNLOADED", { count: documents.length });
  } catch (error) {
    await failStage(prisma, jobId, "DOWNLOADING", error, adminUserId); throw error;
  }
}

async function saveArtifact(prisma: PrismaClient, jobId: string, artifactType: ArtifactType, path: string, contents: string, metadata?: Prisma.InputJsonValue) {
  const sha256 = digest(contents);
  const existing = await prisma.importArtifact.findUnique({ where: { importJobId_artifactType_sha256: { importJobId: jobId, artifactType, sha256 } } });
  if (existing) return existing;
  const versionedPath = path.replace(/(\.[^.]+)$/, `-${sha256.slice(0, 12)}$1`);
  await mkdir(resolve(versionedPath, ".."), { recursive: true });
  await writeFile(versionedPath, contents, { encoding: "utf8", flag: "wx" });
  return prisma.importArtifact.create({ data: { importJobId: jobId, artifactType, localPath: versionedPath, sha256, metadata } });
}

async function writeManifest(prisma: PrismaClient, jobId: string) {
  const docs = await prisma.sourceDocument.findMany({ where: { importJobId: jobId }, select: { sourceUrl: true, documentType: true, localPath: true, sha256: true, size: true, version: true, status: true } });
  const path = safeImportPath(root, jobId, "manifest.json");
  const contents = `${JSON.stringify({ importJobId: jobId, createdAt: new Date().toISOString(), documents: docs }, null, 2)}\n`;
  await writeFile(path, contents, "utf8");
  await prisma.importArtifact.upsert({ where: { importJobId_artifactType_sha256: { importJobId: jobId, artifactType: "MANIFEST", sha256: digest(contents) } }, update: {}, create: { importJobId: jobId, artifactType: "MANIFEST", localPath: path, sha256: digest(contents) } });
}

export async function extractDocuments(prisma: PrismaClient, jobId: string, adminUserId: string) {
  const docs = await prisma.sourceDocument.findMany({ where: { importJobId: jobId, status: "VALIDATED", localPath: { not: null } } });
  const extractor = new PdfParseTextExtractor();
  try {
    for (const doc of docs) {
      const extracted = await extractor.extract(await readFile(doc.localPath!));
      const path = safeImportPath(root, jobId, "extracted", `${doc.id}.json`);
      await saveArtifact(prisma, jobId, "EXTRACTED_TEXT", path, `${JSON.stringify({ sourceDocumentId: doc.id, pageCount: extracted.pageCount, text: extracted.text }, null, 2)}\n`, { documentType: doc.documentType });
    }
    await prisma.importJob.update({ where: { id: jobId }, data: { stage: "GENERATING_EXAM", warnings: ["Extração textual concluída. Geração determinística requer um extrator seguro compatível com o caderno."] } });
    await audit(prisma, jobId, adminUserId, "LOCAL_EXTRACTION_COMPLETED", { documents: docs.length, aiProvider: "disabled" });
  } catch (error) { await failStage(prisma, jobId, "EXTRACTING", error, adminUserId); throw error; }
}

export async function validateExamArtifact(prisma: PrismaClient, jobId: string, adminUserId: string) {
  const path = safeImportPath(root, jobId, "exam.json");
  let raw: unknown;
  try { raw = JSON.parse(await readFile(path, "utf8")); } catch { throw new Error("exam.json ainda não existe. Gere-o a partir dos artefatos revisados, sem inventar conteúdo."); }
  const parsed = examImportSchema.safeParse(raw);
  if (!parsed.success) throw new Error(formatImportValidationErrors(parsed.error).join(" "));
  const contents = `${JSON.stringify(parsed.data, null, 2)}\n`;
  const sha256 = digest(contents);
  await prisma.importArtifact.upsert({ where: { importJobId_artifactType_sha256: { importJobId: jobId, artifactType: "EXAM_JSON", sha256 } }, update: {}, create: { importJobId: jobId, artifactType: "EXAM_JSON", localPath: path, sha256, metadata: summarizeExamImport(parsed.data) } });
  await prisma.importJob.update({ where: { id: jobId }, data: { stage: "VALIDATING" } });
  await audit(prisma, jobId, adminUserId, "EXAM_JSON_VALIDATED", { sha256 });
}

export async function provideExamJson(
  prisma: PrismaClient,
  jobId: string,
  contents: string,
  adminUserId: string,
) {
  if (Buffer.byteLength(contents) > 5 * 1024 * 1024) throw new Error("exam.json excede 5 MB.");
  let raw: unknown;
  try { raw = JSON.parse(contents); } catch { throw new Error("O arquivo fornecido não contém JSON válido."); }
  const parsed = examImportSchema.safeParse(raw);
  if (!parsed.success) throw new Error(formatImportValidationErrors(parsed.error).join(" "));
  const normalized = `${JSON.stringify(parsed.data, null, 2)}\n`;
  const path = safeImportPath(root, jobId, "exam.json");
  await mkdir(resolve(path, ".."), { recursive: true });
  try {
    await writeFile(path, normalized, { encoding: "utf8", flag: "wx" });
  } catch (error) {
    const current = await readFile(path, "utf8").catch(() => undefined);
    if (current !== normalized) throw new Error("Já existe um exam.json diferente; o arquivo anterior não foi sobrescrito.");
  }
  await audit(prisma, jobId, adminUserId, "EXAM_JSON_PROVIDED_BY_ADMIN", { sha256: digest(normalized), generatedByAi: false });
  return validateExamArtifact(prisma, jobId, adminUserId);
}

export async function dryRunJob(prisma: PrismaClient, jobId: string, adminUserId: string) {
  const artifact = await prisma.importArtifact.findFirst({ where: { importJobId: jobId, artifactType: "EXAM_JSON" }, orderBy: { createdAt: "desc" } });
  if (!artifact) throw new Error("Valide o exam.json antes do dry-run.");
  const document = examImportSchema.parse(JSON.parse(await readFile(artifact.localPath, "utf8")));
  const existing = await prisma.concurso.findFirst({ where: { orgao: document.contest.agency, cargo: document.contest.position, ano: document.contest.year, edicao: document.contest.edition ?? null, especialidade: document.contest.specialty ?? null }, select: { id: true, status: true } });
  const report = { ...summarizeExamImport(document), annulled: 0, divergences: [], impediments: existing?.status === "PUBLISHED" || existing?.status === "ARCHIVED" ? [`Concurso equivalente ${existing.status}; decisão administrativa obrigatória.`] : [], wroteData: false };
  const contents = `${JSON.stringify(report, null, 2)}\n`; const path = safeImportPath(root, jobId, "artifacts", "dry-run.json");
  const sha256 = digest(contents); await mkdir(resolve(path, ".."), { recursive: true }); await writeFile(path, contents, "utf8");
  await prisma.importArtifact.upsert({ where: { importJobId_artifactType_sha256: { importJobId: jobId, artifactType: "DRY_RUN_REPORT", sha256 } }, update: {}, create: { importJobId: jobId, artifactType: "DRY_RUN_REPORT", localPath: path, sha256, metadata: report } });
  await prisma.importJob.update({ where: { id: jobId }, data: { stage: report.impediments.length ? "DRY_RUN_COMPLETE" : "WAITING_REVIEW", report } });
  await audit(prisma, jobId, adminUserId, "DRY_RUN_COMPLETED", { wroteData: false, impediments: report.impediments });
  return report;
}

export async function failStage(prisma: PrismaClient, jobId: string, stage: ImportJobStage, error: unknown, adminUserId: string) {
  const message = error instanceof Error ? error.message : String(error);
  await prisma.importJob.update({ where: { id: jobId }, data: { stage: "FAILED", previousStage: stage, errorMessage: message, finishedAt: new Date() } });
  await audit(prisma, jobId, adminUserId, "FAILED", { stage, message });
}

export const officialImportStorageRoot = root;
