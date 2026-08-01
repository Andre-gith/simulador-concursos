"use server";

import { MonitorFrequency } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/admin";
import { executeMonitor, nextCheckAt } from "@/lib/monitoring/service";
import { prisma } from "@/lib/prisma";
import { approvedOfficialHosts, parseSecureUrl } from "@/lib/official-import/url-security";
import { enforceRateLimit } from "@/lib/rate-limit";
import { jobExecutor } from "@/lib/job-executor";
import { DEMO_AUTOMATION_MESSAGE, isDemoDeployment } from "@/lib/deployment-mode";

const value = (data: FormData, name: string) => String(data.get(name) ?? "").trim();
const optional = (data: FormData, name: string) => value(data, name) || undefined;
const blockDemo = (path: string) => {
  if (isDemoDeployment()) redirect(`${path}?error=${encodeURIComponent(DEMO_AUTOMATION_MESSAGE)}`);
};

export async function createMonitorAction(data: FormData) {
  const session = await requireAdmin();
  blockDemo("/admin/monitoramento");
  const name = value(data, "name"); const institution = value(data, "institution");
  const sourceUrl = parseSecureUrl(value(data, "sourceUrl"), approvedOfficialHosts()).href;
  const frequency = value(data, "frequency") as MonitorFrequency;
  if (!name || !institution || !Object.values(MonitorFrequency).includes(frequency)) redirect("/admin/monitoramento/novo?error=Dados inválidos");
  const monitor = await prisma.sourceMonitor.create({ data: {
    name, institution, sourceUrl, adapterType: value(data, "adapterType"),
    boardId: optional(data, "boardId"), contestId: optional(data, "contestId"),
    editorialCatalogEntryId: optional(data, "editorialCatalogEntryId"), frequency,
    enabled: data.get("enabled") === "on", notes: optional(data, "notes"),
    createdById: session.user.id, nextCheckAt: nextCheckAt(frequency),
  } });
  redirect(`/admin/monitoramento/${monitor.id}`);
}

export async function runMonitorAction(data: FormData) {
  const session = await requireAdmin(); const id = value(data, "monitorId");
  blockDemo(`/admin/monitoramento/${id}`);
  if (!(await enforceRateLimit(`admin:monitor:${session.user.id}`, 10, 600)).allowed) redirect(`/admin/monitoramento/${id}?error=Limite de execuções excedido`);
  try { const executor = jobExecutor(); if (executor.mode === "queue") await executor.enqueue({ type: "MONITOR_SINGLE_SOURCE", payload: { version: 1, sourceMonitorId: id, scheduledAt: new Date().toISOString() } }); else await executor.execute("source-monitor", { monitorId: id }, () => executeMonitor(prisma, id, { manual: true })); }
  catch (error) { redirect(`/admin/monitoramento/${id}?error=${encodeURIComponent(error instanceof Error ? error.message : "Execução falhou")}`); }
  revalidatePath("/admin/monitoramento"); revalidatePath(`/admin/monitoramento/${id}`);
  redirect(`/admin/monitoramento/${id}?notice=Verificação aceita para processamento`);
}

export async function toggleMonitorAction(data: FormData) {
  await requireAdmin(); const id = value(data, "monitorId");
  blockDemo(`/admin/monitoramento/${id}`);
  await prisma.sourceMonitor.update({ where: { id }, data: { enabled: data.get("enabled") === "true" } });
  revalidatePath("/admin/monitoramento"); redirect(`/admin/monitoramento/${id}`);
}

export async function reviewChangeAction(data: FormData) {
  const session = await requireAdmin(); const id = value(data, "changeId");
  const action = value(data, "reviewAction"); const justification = value(data, "justification");
  if (!["ACKNOWLEDGED", "DISMISSED"].includes(action) || (action === "DISMISSED" && !justification)) throw new Error("Justificativa obrigatória.");
  await prisma.$transaction([
    prisma.documentChange.update({ where: { id }, data: { status: action as "ACKNOWLEDGED" | "DISMISSED", metadata: { reviewJustification: justification, reviewedById: session.user.id } } }),
    prisma.adminNotification.updateMany({ where: { documentChangeId: id }, data: { readAt: new Date() } }),
  ]);
  revalidatePath("/admin/monitoramento/alteracoes");
}

export async function reviewProposalAction(data: FormData) {
  const session = await requireAdmin(); const id = value(data, "proposalId");
  const status = value(data, "status");
  if (!["ACCEPTED", "REJECTED"].includes(status)) throw new Error("Decisão inválida.");
  await prisma.editorialChangeProposal.update({ where: { id }, data: {
    status: status as "ACCEPTED" | "REJECTED", reviewedById: session.user.id, reviewedAt: new Date(),
  } });
  revalidatePath("/admin/monitoramento/alteracoes");
}
