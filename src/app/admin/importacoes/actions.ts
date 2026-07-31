"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireAdmin } from "@/lib/admin";
import { prisma } from "@/lib/prisma";
import {
  analyzeOfficialSource, prepareOfficialImport, classifyDocuments, createManualImport, downloadSelectedDocuments, dryRunJob,
  extractDocuments, provideExamJson, selectDestination, validateExamArtifact,
} from "@/lib/official-import/workflow";
import { importJobForReview } from "@/lib/official-import/review-import";
import { DocumentType, ImportDestinationType } from "@prisma/client";
import { enforceRateLimit } from "@/lib/rate-limit";
import { jobExecutor } from "@/lib/job-executor";
import type { JobType } from "@/lib/jobs/contracts";

const metadataSchema = z.object({
  officialUrl: z.string().url(),
  board: z.string().trim().max(100).optional(),
  institution: z.string().trim().min(1).max(150),
  position: z.string().trim().min(1).max(150),
  specialty: z.string().trim().max(150).optional(),
  year: z.coerce.number().int().min(1900).max(2200).optional(),
  edition: z.string().trim().max(100).optional(),
  paperCode: z.string().trim().max(100).optional(),
  adminNotes: z.string().trim().max(4000).optional(),
});

function optional(data: FormData, name: string) {
  const value = data.get(name); return typeof value === "string" && value.trim() ? value : undefined;
}
async function enqueueImportStage(type: Extract<JobType, `OFFICIAL_IMPORT_${string}`>, importJobId: string) {
  const executor = jobExecutor();
  const latest = await prisma.sourceDocument.aggregate({ where: { importJobId }, _max: { version: true } });
  const queued = await executor.enqueue({ type, payload: { version: 1, importJobId, documentRevision: latest._max.version ?? 0 } } as never);
  const current = await prisma.importJob.findUnique({ where: { id: importJobId }, select: { report: true } });
  const report = current?.report && typeof current.report === "object" && !Array.isArray(current.report) ? current.report : {};
  await prisma.importJob.update({ where: { id: importJobId }, data: { report: { ...report, queueStatus: "WAITING", progress: 0, bullJobId: queued.jobId, duplicated: queued.duplicated } } });
  return queued;
}

export async function analyzeSourceAction(data: FormData) {
  const session = await requireAdmin();
  if (!(await enforceRateLimit(`admin:analyze:${session.user.id}`, 10, 600)).allowed) redirect("/admin/importacoes/nova?error=Limite de análises excedido");
  const parsed = metadataSchema.safeParse({
    officialUrl: data.get("officialUrl"), board: optional(data, "board"),
    institution: data.get("institution"), position: data.get("position"),
    specialty: optional(data, "specialty"), year: optional(data, "year"),
    edition: optional(data, "edition"), paperCode: optional(data, "paperCode"),
    adminNotes: optional(data, "adminNotes"),
  });
  if (!parsed.success) redirect(`/admin/importacoes/nova?error=${encodeURIComponent(parsed.error.issues.map((issue) => issue.message).join(" "))}`);
  let result: Awaited<ReturnType<typeof analyzeOfficialSource>>;
  try {
    const executor = jobExecutor();
    if (executor.mode === "queue") {
      const prepared = await prepareOfficialImport(prisma, parsed.data, session.user.id);
      if (!prepared.reused) await enqueueImportStage("OFFICIAL_IMPORT_DISCOVER", prepared.job.id);
      result = prepared;
    } else result = await executor.execute("official-source-analysis", { adminUserId: session.user.id }, () => analyzeOfficialSource(prisma, parsed.data, session.user.id));
  }
  catch (error) { redirect(`/admin/importacoes/nova?error=${encodeURIComponent(error instanceof Error ? error.message : "Falha ao analisar a URL.")}`); }
  const editorialCatalogEntryId = optional(data, "editorialCatalogEntryId");
  if (editorialCatalogEntryId) await prisma.importJob.update({ where: { id: result.job.id }, data: { destinationType: "EDITORIAL_ENTRY", destinationEditorialEntryId: editorialCatalogEntryId } });
  redirect(`/admin/importacoes/${result.job.id}${result.reused ? "?notice=Execução já processada" : ""}`);
}

export async function createManualImportAction(data: FormData) {
  const session = await requireAdmin();
  const metadata = metadataSchema.omit({ officialUrl: true }).safeParse({
    board: optional(data, "board"), institution: data.get("institution"), position: data.get("position"),
    specialty: optional(data, "specialty"), year: optional(data, "year"), edition: optional(data, "edition"),
    paperCode: optional(data, "paperCode"), adminNotes: optional(data, "adminNotes"),
  });
  const count = Number(data.get("documentCount"));
  const documents = Array.from({ length: count }, (_, index) => ({
    url: String(data.get(`documentUrl.${index}`) ?? ""),
    documentType: String(data.get(`documentType.${index}`) ?? "") as DocumentType,
    description: optional(data, `documentDescription.${index}`),
    paperCode: optional(data, `documentPaper.${index}`),
    publishedAt: optional(data, `documentDate.${index}`) ? new Date(String(data.get(`documentDate.${index}`))) : undefined,
    displayOrder: index,
  }));
  const validTypes = new Set(Object.values(DocumentType));
  if (!metadata.success || !Number.isInteger(count) || count < 1 || count > 12 ||
      documents.some((document) => !validTypes.has(document.documentType))) {
    redirect(`/admin/importacoes/nova?error=${encodeURIComponent(metadata.success ? "Documentos diretos inválidos." : metadata.error.issues.map((issue) => issue.message).join(" "))}`);
  }
  try {
    const result = await createManualImport(prisma, metadata.data, documents, session.user.id);
    const editorialCatalogEntryId = optional(data, "editorialCatalogEntryId");
    if (editorialCatalogEntryId) await prisma.importJob.update({ where: { id: result.job.id }, data: { destinationType: "EDITORIAL_ENTRY", destinationEditorialEntryId: editorialCatalogEntryId } });
    redirect(`/admin/importacoes/${result.job.id}${result.reused ? "?notice=Execução já processada" : ""}`);
  } catch (error) {
    redirect(`/admin/importacoes/nova?error=${encodeURIComponent(error instanceof Error ? error.message : "Falha ao validar URLs.")}`);
  }
}

export async function classifyAndDownloadAction(data: FormData) {
  const session = await requireAdmin(); const jobId = String(data.get("jobId") ?? "");
  if (!(await enforceRateLimit(`admin:download:${session.user.id}`, 10, 600)).allowed) redirect(`/admin/importacoes/${jobId}?error=Limite de downloads excedido`);
  const ids = data.getAll("allDocumentIds").map(String);
  const selected = new Set(data.getAll("documentIds").map(String));
  const updates = ids.map((id) => ({ id, selected: selected.has(id), documentType: String(data.get(`documentType.${id}`)) as DocumentType }));
  try { await classifyDocuments(prisma, jobId, updates, session.user.id); const executor = jobExecutor(); if (executor.mode === "queue") await enqueueImportStage("OFFICIAL_IMPORT_DOWNLOAD", jobId); else await executor.execute("official-document-download", { jobId }, () => downloadSelectedDocuments(prisma, jobId, session.user.id)); }
  catch (error) { redirect(`/admin/importacoes/${jobId}?error=${encodeURIComponent(error instanceof Error ? error.message : "Falha no download.")}`); }
  revalidatePath(`/admin/importacoes/${jobId}`); redirect(`/admin/importacoes/${jobId}`);
}

export async function extractAction(data: FormData) {
  const session = await requireAdmin(); const jobId = String(data.get("jobId") ?? "");
  try { const executor = jobExecutor(); if (executor.mode === "queue") await enqueueImportStage("OFFICIAL_IMPORT_EXTRACT", jobId); else await executor.execute("official-document-extraction", { jobId }, () => extractDocuments(prisma, jobId, session.user.id)); }
  catch (error) { redirect(`/admin/importacoes/${jobId}?error=${encodeURIComponent(error instanceof Error ? error.message : "Falha na extração.")}`); }
  revalidatePath(`/admin/importacoes/${jobId}`); redirect(`/admin/importacoes/${jobId}`);
}

export async function validateExamAction(data: FormData) {
  const session = await requireAdmin(); const jobId = String(data.get("jobId") ?? "");
  try { const executor = jobExecutor(); if (executor.mode === "queue") await enqueueImportStage("OFFICIAL_IMPORT_GENERATE", jobId); else await validateExamArtifact(prisma, jobId, session.user.id); }
  catch (error) { redirect(`/admin/importacoes/${jobId}?error=${encodeURIComponent(error instanceof Error ? error.message : "exam.json inválido.")}`); }
  revalidatePath(`/admin/importacoes/${jobId}`); redirect(`/admin/importacoes/${jobId}`);
}

export async function provideExamJsonAction(data: FormData) {
  const session = await requireAdmin(); const jobId = String(data.get("jobId") ?? "");
  const file = data.get("examJson");
  if (!(file instanceof File) || file.size === 0) redirect(`/admin/importacoes/${jobId}?error=Selecione um exam.json`);
  try { await provideExamJson(prisma, jobId, await file.text(), session.user.id); }
  catch (error) { redirect(`/admin/importacoes/${jobId}?error=${encodeURIComponent(error instanceof Error ? error.message : "exam.json rejeitado.")}`); }
  revalidatePath(`/admin/importacoes/${jobId}`); redirect(`/admin/importacoes/${jobId}?notice=exam.json validado sem importação`);
}

export async function dryRunAction(data: FormData) {
  const session = await requireAdmin(); const jobId = String(data.get("jobId") ?? "");
  try { const executor = jobExecutor(); if (executor.mode === "queue") await enqueueImportStage("OFFICIAL_IMPORT_DRY_RUN", jobId); else await dryRunJob(prisma, jobId, session.user.id); }
  catch (error) { redirect(`/admin/importacoes/${jobId}?error=${encodeURIComponent(error instanceof Error ? error.message : "Dry-run falhou.")}`); }
  revalidatePath(`/admin/importacoes/${jobId}`); redirect(`/admin/importacoes/${jobId}`);
}

export async function selectDestinationAction(data: FormData) {
  const session = await requireAdmin(); const jobId = String(data.get("jobId") ?? "");
  const destinationType = String(data.get("destinationType") ?? "") as ImportDestinationType;
  if (!Object.values(ImportDestinationType).includes(destinationType)) redirect(`/admin/importacoes/${jobId}?error=Destino inválido`);
  const destinationId = destinationType === "EDITORIAL_ENTRY"
    ? optional(data, "destinationEditorialEntryId")
    : destinationType === "EXISTING_CONTEST_NEW_PAPER"
      ? optional(data, "destinationContestId")
      : undefined;
  try { await selectDestination(prisma, jobId, destinationType, destinationId, session.user.id); }
  catch (error) { redirect(`/admin/importacoes/${jobId}?error=${encodeURIComponent(error instanceof Error ? error.message : "Destino inválido.")}`); }
  revalidatePath(`/admin/importacoes/${jobId}`); redirect(`/admin/importacoes/${jobId}`);
}

export async function importForReviewAction(data: FormData) {
  const session = await requireAdmin(); const jobId = String(data.get("jobId") ?? "");
  if (data.get("confirmation") !== "IMPORT_FOR_REVIEW") redirect(`/admin/importacoes/${jobId}?error=Confirmação obrigatória`);
  try { const executor = jobExecutor(); if (executor.mode === "queue") await enqueueImportStage("OFFICIAL_IMPORT_PERSIST", jobId); else await importJobForReview(prisma, jobId, session.user.id); }
  catch (error) { redirect(`/admin/importacoes/${jobId}?error=${encodeURIComponent(error instanceof Error ? error.message : "Importação rejeitada.")}`); }
  revalidatePath("/admin"); revalidatePath("/admin/importacoes"); revalidatePath(`/admin/importacoes/${jobId}`);
  redirect(`/admin/importacoes/${jobId}?notice=Importação aceita para processamento`);
}

export async function retryFailedStageAction(data: FormData) {
  const session = await requireAdmin(); const jobId = String(data.get("jobId") ?? "");
  const job = await prisma.importJob.findUnique({ where: { id: jobId }, select: { stage: true, previousStage: true } });
  if (!job || job.stage !== "FAILED" || !job.previousStage) redirect(`/admin/importacoes/${jobId}?error=O trabalho não possui etapa repetível`);
  const repeatable = ["DISCOVERING_DOCUMENTS", "DOWNLOADING", "EXTRACTING", "GENERATING_EXAM", "VALIDATING"];
  if (!repeatable.includes(job.previousStage)) redirect(`/admin/importacoes/${jobId}?error=Esta etapa não pode ser repetida automaticamente`);
  await prisma.$transaction([
    prisma.importJob.update({ where: { id: jobId }, data: { stage: job.previousStage, errorMessage: null, finishedAt: null } }),
    prisma.importAuditEvent.create({ data: { importJobId: jobId, adminUserId: session.user.id, action: "FAILED_STAGE_RETRY_REQUESTED", details: { stage: job.previousStage } } }),
  ]);
  revalidatePath(`/admin/importacoes/${jobId}`); redirect(`/admin/importacoes/${jobId}?notice=Etapa liberada para nova tentativa`);
}
