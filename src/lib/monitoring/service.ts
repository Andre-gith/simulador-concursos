import { createHash, randomUUID } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import type { DocumentImpactType, DocumentType, MonitorFrequency, Prisma, PrismaClient } from "@prisma/client";
import { sourceAdapters } from "../official-import/adapters";
import { downloadOfficialPdf, safeImportPath } from "../official-import/download";
import { approvedOfficialHosts, DOWNLOAD_LIMITS, parseSecureUrl, validatePublicDns } from "../official-import/url-security";
import { validatePdfBuffer } from "../import/pdf-extractor";
import { PdfParseTextExtractor } from "../import/pdf-extractor";

export const MONITOR_LIMIT = 20;
export const LOCK_MINUTES = 10;
export const MANUAL_RATE_LIMIT_MINUTES = 2;

export type MonitoredDocument = {
  url: string; title: string; documentType: DocumentType; content: Buffer;
  publishedAt?: Date; metadata?: Record<string, unknown>;
};
export interface MonitorDiscoveryProvider {
  discover(monitor: { sourceUrl: string; adapterType: string; id: string }): Promise<MonitoredDocument[]>;
}

const storageRoot = resolve(process.cwd(), "data", "imports", "official-sources");
const sha = (value: Buffer | string) => createHash("sha256").update(value).digest("hex");

export function nextCheckAt(frequency: MonitorFrequency, from = new Date()) {
  if (frequency === "MANUAL") return null;
  return new Date(from.getTime() + (frequency === "DAILY" ? 24 : 7 * 24) * 60 * 60 * 1000);
}

export function isDue(monitor: { enabled: boolean; frequency: MonitorFrequency; nextCheckAt: Date | null }, now = new Date()) {
  return monitor.enabled && monitor.frequency !== "MANUAL" && monitor.nextCheckAt !== null && monitor.nextCheckAt <= now;
}

export function classifyImpact(type: DocumentType, changed: boolean): DocumentImpactType {
  if (type === "ANSWER_KEY_FINAL") return changed ? "ANSWER_KEY_CHANGED" : "NEW_ANSWER_KEY_FINAL";
  if (type === "ANSWER_KEY_PRELIMINARY") return "NEW_ANSWER_KEY_PRELIMINARY";
  if (type === "EXAM") return "NEW_EXAM";
  if (type === "RECTIFICATION") return "RECTIFICATION";
  if (type === "ANNULMENT_NOTICE") return "ANNULMENT_NOTICE";
  if (type === "NOTICE") return changed ? "NOTICE_CHANGED" : "UNKNOWN";
  if (type === "RESULT") return "NEW_RESULT";
  return "UNKNOWN";
}

export class OfficialPageDiscoveryProvider implements MonitorDiscoveryProvider {
  async discover(monitor: { sourceUrl: string; adapterType: string; id: string }) {
    let current = parseSecureUrl(monitor.sourceUrl, approvedOfficialHosts());
    let html = "";
    for (let redirect = 0; redirect <= DOWNLOAD_LIMITS.maxRedirects; redirect += 1) {
      await validatePublicDns(current);
      const response = await fetch(current, { redirect: "manual", signal: AbortSignal.timeout(DOWNLOAD_LIMITS.timeoutMs), headers: { "user-agent": "NotaDeBanca-OfficialMonitor/1.0" } });
      if (response.status >= 300 && response.status < 400) {
        const location = response.headers.get("location"); if (!location) throw new Error("Redirecionamento inválido.");
        current = parseSecureUrl(new URL(location, current).href, approvedOfficialHosts()); continue;
      }
      if (!response.ok) throw new Error(`Fonte oficial indisponível (HTTP ${response.status}).`);
      html = await response.text(); break;
    }
    const adapter = sourceAdapters.find((item) => item.name === monitor.adapterType) ??
      sourceAdapters.find((item) => item.supports(current));
    if (!adapter) throw new Error("Adaptador não suportado.");
    const analysis = await adapter.analyze(current, html);
    if (analysis.documents.length > DOWNLOAD_LIMITS.maxDocuments) throw new Error("Limite de documentos excedido.");
    const output: MonitoredDocument[] = [];
    for (const [index, document] of analysis.documents.entries()) {
      const temporary = safeImportPath(storageRoot, "monitor-temp", monitor.id, `${index}.pdf`);
      await mkdir(resolve(temporary, ".."), { recursive: true });
      await downloadOfficialPdf({ url: document.url, destination: temporary, approvedHosts: approvedOfficialHosts() });
      output.push({ url: document.url, title: document.title, documentType: document.documentType, content: await readFile(temporary), metadata: { confidence: document.confidence } });
    }
    return output;
  }
}

export class FixtureDiscoveryProvider implements MonitorDiscoveryProvider {
  constructor(private readonly directory: string) {}
  async discover() {
    const manifest = JSON.parse(await readFile(resolve(this.directory, "manifest.json"), "utf8")) as {
      documents: Array<{ url: string; title: string; documentType: DocumentType; file: string; publishedAt?: string; metadata?: Record<string, unknown> }>;
    };
    return Promise.all(manifest.documents.map(async (item) => {
      const content = await readFile(safeImportPath(this.directory, item.file));
      validatePdfBuffer(content, item.title);
      return { url: item.url, title: item.title, documentType: item.documentType,
        content, publishedAt: item.publishedAt ? new Date(item.publishedAt) : undefined, metadata: item.metadata };
    }));
  }
}

function notificationFor(impact: DocumentImpactType) {
  const critical = ["NEW_ANSWER_KEY_FINAL", "ANSWER_KEY_CHANGED", "ANNULMENT_NOTICE", "RECTIFICATION"].includes(impact);
  const titles: Partial<Record<DocumentImpactType, string>> = {
    NEW_ANSWER_KEY_FINAL: "Novo gabarito definitivo detectado",
    ANSWER_KEY_CHANGED: "Gabarito oficial alterado",
    ANNULMENT_NOTICE: "Comunicado de anulação detectado",
    RECTIFICATION: "Retificação oficial detectada",
    NEW_EXAM: "Nova prova oficial detectada",
    NOTICE_CHANGED: "Edital oficial alterado",
    UNKNOWN: "Mudança oficial requer classificação",
  };
  return { title: titles[impact] ?? "Atualização oficial detectada", severity: critical ? "CRITICAL" : "INFO" };
}

async function createProposals(
  tx: Prisma.TransactionClient,
  monitor: { contestId: string | null },
  changeId: string,
  documentId: string,
  previousMetadata: unknown,
  currentMetadata: Record<string, unknown> | undefined,
) {
  if (!monitor.contestId) return;
  const previous = previousMetadata && typeof previousMetadata === "object" ? previousMetadata as Record<string, unknown> : {};
  const oldAnswers = previous.answers && typeof previous.answers === "object" ? previous.answers as Record<string, unknown> : {};
  const newAnswers = currentMetadata?.answers && typeof currentMetadata.answers === "object" ? currentMetadata.answers as Record<string, unknown> : {};
  for (const [number, answer] of Object.entries(newAnswers)) {
    if (number in oldAnswers && oldAnswers[number] !== answer) {
      const question = await tx.question.findFirst({ where: { concursoId: monitor.contestId, number: Number(number) }, select: { id: true, status: true, textReviewed: true, answerKeyReviewed: true } });
      await tx.editorialChangeProposal.create({ data: {
        documentChangeId: changeId, contestId: monitor.contestId, questionId: question?.id,
        field: "ANSWER_KEY", previousValue: oldAnswers[number] as Prisma.InputJsonValue,
        proposedValue: answer as Prisma.InputJsonValue, sourceDocumentId: documentId,
        status: question?.status === "PUBLISHED" || question?.textReviewed || question?.answerKeyReviewed ? "CONFLICT" : "PENDING",
      } });
    }
  }
  const annulled = Array.isArray(currentMetadata?.annulled) ? currentMetadata.annulled : [];
  for (const value of annulled) {
    const number = Number(value); const question = await tx.question.findFirst({ where: { concursoId: monitor.contestId, number }, select: { id: true, annulmentStatus: true } });
    await tx.editorialChangeProposal.create({ data: {
      documentChangeId: changeId, contestId: monitor.contestId, questionId: question?.id,
      field: "annulmentStatus", previousValue: question?.annulmentStatus ?? "UNKNOWN",
      proposedValue: "ANNULLED", sourceDocumentId: documentId, status: "PENDING",
    } });
  }
}

export async function acquireMonitorLock(prisma: PrismaClient, monitorId: string, token: string, now = new Date()) {
  const result = await prisma.sourceMonitor.updateMany({
    where: { id: monitorId, OR: [{ lockExpiresAt: null }, { lockExpiresAt: { lt: now } }] },
    data: { lockedAt: now, lockedBy: token, lockExpiresAt: new Date(now.getTime() + LOCK_MINUTES * 60_000) },
  });
  return result.count === 1;
}

export async function executeMonitor(
  prisma: PrismaClient,
  monitorId: string,
  options: { dryRun?: boolean; manual?: boolean; provider?: MonitorDiscoveryProvider; now?: Date } = {},
) {
  const now = options.now ?? new Date(); const monitor = await prisma.sourceMonitor.findUnique({ where: { id: monitorId } });
  if (!monitor) throw new Error("Monitor não encontrado.");
  if (options.manual && monitor.lastManualRunAt && now.getTime() - monitor.lastManualRunAt.getTime() < MANUAL_RATE_LIMIT_MINUTES * 60_000) throw new Error("Aguarde antes de executar o monitor novamente.");
  const provider = options.provider ?? new OfficialPageDiscoveryProvider();
  if (options.dryRun) {
    const documents = await provider.discover(monitor);
    const previous = await prisma.sourceDocument.findMany({ where: { importJob: { sourceMonitorId: monitor.id } }, orderBy: { version: "desc" } });
    return compareDocuments(documents, previous);
  }
  const token = randomUUID();
  if (!await acquireMonitorLock(prisma, monitor.id, token, now)) {
    return prisma.monitorRun.create({ data: { sourceMonitorId: monitor.id, status: "LOCKED", finishedAt: now } });
  }
  const run = await prisma.monitorRun.create({ data: { sourceMonitorId: monitor.id, status: "RUNNING", lockToken: token } });
  let attempts = 0;
  try {
    const discovery = await discoverWithRetry(provider, monitor);
    const discovered = discovery.documents;
    attempts = discovery.attempts;
    const previous = await prisma.sourceDocument.findMany({ where: { importJob: { sourceMonitorId: monitor.id } }, orderBy: [{ sourceUrl: "asc" }, { version: "desc" }] });
    const comparison = compareDocuments(discovered, previous);
    let newCount = 0; let changedCount = 0; let unchangedCount = 0;
    for (const item of comparison.items) {
      if (item.changeType === "UNCHANGED") { unchangedCount += 1; continue; }
      if (item.changeType === "DOCUMENT_REMOVED_FROM_PAGE") {
        await createChange(prisma, run.id, null, item.previous?.id ?? null, item.changeType, "UNKNOWN", { url: item.url });
        continue;
      }
      if (item.changeType === "DOCUMENT_RENAMED") {
        await createChange(prisma, run.id, item.previous?.id ?? null, item.previous?.id ?? null, item.changeType, "NO_EDITORIAL_IMPACT", { previousUrl: item.previous?.sourceUrl, currentUrl: item.url });
        unchangedCount += 1;
        continue;
      }
      const current = item.current!; const hash = sha(current.content);
      const impact = classifyImpact(current.documentType, item.changeType === "CONTENT_CHANGED");
      const identity = sha(JSON.stringify({ monitorId: monitor.id, url: current.url, hash, type: current.documentType }));
      let job = await prisma.importJob.findUnique({ where: { idempotencyKey: identity } });
      if (!job) {
        job = await prisma.importJob.create({ data: {
          pdfUrl: current.url, officialUrl: monitor.sourceUrl, institution: monitor.institution,
          board: null, concursoId: monitor.contestId, destinationContestId: monitor.contestId,
          destinationEditorialEntryId: monitor.editorialCatalogEntryId, sourceMonitorId: monitor.id,
          idempotencyKey: identity, isUpdate: true, stage: "EXTRACTING",
        } });
      }
      const path = safeImportPath(storageRoot, job.id, "documents", `${hash}.pdf`);
      await mkdir(resolve(path, ".."), { recursive: true }); await writeFile(path, current.content, { flag: "wx" }).catch(() => undefined);
      const version = item.previous ? item.previous.version + 1 : 1;
      const document = await prisma.sourceDocument.create({ data: {
        importJobId: job.id, documentType: current.documentType, sourceUrl: current.url,
        originalFilename: current.title, localPath: path, mimeType: "application/pdf",
        sha256: hash, size: current.content.length, publishedAt: current.publishedAt,
        downloadedAt: now, version, status: "VALIDATED", supersedesId: item.previous?.id,
        metadata: (current.metadata ?? {}) as Prisma.InputJsonValue,
      } });
      let extractionWarning = "MANUAL_EXTRACTION_REQUIRED";
      try {
        const extracted = await new PdfParseTextExtractor().extract(current.content);
        const artifactContents = `${JSON.stringify({ sourceDocumentId: document.id, pageCount: extracted.pageCount, text: extracted.text }, null, 2)}\n`;
        const artifactHash = sha(artifactContents); const artifactPath = safeImportPath(storageRoot, job.id, "extracted", `${document.id}-${artifactHash.slice(0, 12)}.json`);
        await mkdir(resolve(artifactPath, ".."), { recursive: true }); await writeFile(artifactPath, artifactContents, { flag: "wx" }).catch(() => undefined);
        await prisma.importArtifact.upsert({ where: { importJobId_artifactType_sha256: { importJobId: job.id, artifactType: "EXTRACTED_TEXT", sha256: artifactHash } }, update: {}, create: { importJobId: job.id, artifactType: "EXTRACTED_TEXT", localPath: artifactPath, sha256: artifactHash, metadata: { generatedByAi: false } } });
        extractionWarning = "EXAM_JSON_GENERATION_REQUIRES_SUPPORTED_EXTRACTOR";
      } catch {
        // O documento é preservado; formatos sem texto seguro ficam para revisão.
      }
      const change = await createChange(prisma, run.id, document.id, item.previous?.id ?? null, item.changeType, impact, { title: current.title, hash });
      await prisma.importJob.update({ where: { id: job.id }, data: { documentChangeId: change.id, warnings: [extractionWarning], stage: "WAITING_REVIEW" } });
      await prisma.$transaction(async (tx) => createProposals(tx, monitor, change.id, document.id, item.previous?.metadata, current.metadata));
      item.changeType === "NEW_DOCUMENT" ? newCount += 1 : changedCount += 1;
    }
    const finished = new Date();
    return await prisma.$transaction(async (tx) => {
      const saved = await tx.monitorRun.update({ where: { id: run.id }, data: {
        status: comparison.warnings.length ? "COMPLETED_WITH_WARNINGS" : "COMPLETED", finishedAt: finished,
        documentsDiscovered: discovered.length, documentsNew: newCount, documentsChanged: changedCount,
        documentsUnchanged: unchangedCount, warnings: comparison.warnings, attempts,
      } });
      await tx.sourceMonitor.update({ where: { id: monitor.id }, data: {
        lastCheckedAt: finished, lastSuccessfulAt: finished, nextCheckAt: nextCheckAt(monitor.frequency, finished),
        consecutiveFailures: 0, lastError: null, lockedAt: null, lockedBy: null, lockExpiresAt: null,
        ...(options.manual ? { lastManualRunAt: finished } : {}),
      } });
      return saved;
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await prisma.$transaction([
      prisma.monitorRun.update({ where: { id: run.id }, data: { status: "FAILED", error: message, attempts, finishedAt: new Date() } }),
      prisma.sourceMonitor.update({ where: { id: monitor.id }, data: {
        lastCheckedAt: new Date(), lastErrorAt: new Date(), lastError: message,
        consecutiveFailures: { increment: 1 }, nextCheckAt: new Date(Date.now() + 60 * 60_000),
        lockedAt: null, lockedBy: null, lockExpiresAt: null,
      } }),
    ]);
    throw error;
  }
}

export async function discoverWithRetry(provider: MonitorDiscoveryProvider, monitor: { sourceUrl: string; adapterType: string; id: string }) {
  let lastError: unknown;
  for (let attempts = 1; attempts <= 3; attempts += 1) {
    try { return { documents: await provider.discover(monitor), attempts }; }
    catch (error) {
      lastError = error;
      if (error instanceof Error && /URL|protocolo|privad|credenciais|limite|MIME|assinatura/i.test(error.message)) break;
    }
  }
  throw lastError;
}

async function createChange(prisma: PrismaClient, runId: string, documentId: string | null, previousId: string | null, changeType: any, impactType: DocumentImpactType, metadata: Record<string, unknown>) {
  const change = await prisma.documentChange.create({ data: {
    monitorRunId: runId, sourceDocumentId: documentId, previousDocumentId: previousId,
    changeType, impactType, status: impactType === "NO_EDITORIAL_IMPACT" ? "RESOLVED" : "WAITING_REVIEW",
    metadata: metadata as Prisma.InputJsonValue,
  } });
  const notification = notificationFor(impactType);
  await prisma.adminNotification.create({ data: { documentChangeId: change.id, ...notification } });
  return change;
}

export function compareDocuments(current: MonitoredDocument[], previous: Array<{ id: string; sourceUrl: string; sha256: string | null; originalFilename: string | null; version: number; metadata: unknown }>) {
  const items: Array<{ url: string; changeType: "NEW_DOCUMENT" | "CONTENT_CHANGED" | "DOCUMENT_REMOVED_FROM_PAGE" | "DOCUMENT_RENAMED" | "UNCHANGED"; current?: MonitoredDocument; previous?: typeof previous[number] }> = [];
  const currentUrls = new Set(current.map((item) => item.url));
  for (const doc of current) {
    const candidates = previous.filter((item) => item.sourceUrl === doc.url);
    const latest = candidates[0]; const hash = sha(doc.content);
    if (!latest) {
      const sameHash = previous.find((item) => item.sha256 === hash);
      items.push({ url: doc.url, changeType: sameHash ? "DOCUMENT_RENAMED" : "NEW_DOCUMENT", current: doc, previous: sameHash });
    } else items.push({ url: doc.url, changeType: latest.sha256 === hash ? "UNCHANGED" : "CONTENT_CHANGED", current: doc, previous: latest });
  }
  for (const old of previous.filter((item, index, all) => all.findIndex((candidate) => candidate.sourceUrl === item.sourceUrl) === index)) {
    if (!currentUrls.has(old.sourceUrl)) items.push({ url: old.sourceUrl, changeType: "DOCUMENT_REMOVED_FROM_PAGE", previous: old });
  }
  return { items, warnings: items.some((item) => item.changeType === "DOCUMENT_REMOVED_FROM_PAGE") ? ["Documento removido da página oficial; registro preservado."] : [] };
}

export async function executeDueMonitors(prisma: PrismaClient, options: { dryRun?: boolean; now?: Date; provider?: MonitorDiscoveryProvider } = {}) {
  const now = options.now ?? new Date();
  const monitors = await prisma.sourceMonitor.findMany({ where: { enabled: true, frequency: { not: "MANUAL" }, nextCheckAt: { lte: now } }, take: MONITOR_LIMIT, orderBy: { nextCheckAt: "asc" } });
  const results = [];
  for (const monitor of monitors) results.push(await executeMonitor(prisma, monitor.id, { ...options, now }).catch((error) => ({ monitorId: monitor.id, error: error instanceof Error ? error.message : String(error) })));
  return results;
}
