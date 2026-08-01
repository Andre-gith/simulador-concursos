"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { CatalogProviderType, CatalogTrustLevel, MonitorFrequency } from "@prisma/client";
import { requireAdmin } from "@/lib/admin";
import { syncCatalogSource } from "@/lib/catalog-sync/service";
import { prisma } from "@/lib/prisma";
import { enforceRateLimit } from "@/lib/rate-limit";
import { jobExecutor } from "@/lib/job-executor";
import { DEMO_AUTOMATION_MESSAGE, isDemoDeployment } from "@/lib/deployment-mode";

const text = (data: FormData, key: string) => String(data.get(key) ?? "").trim();
const blockDemo = (path: string) => {
  if (isDemoDeployment()) redirect(`${path}?error=${encodeURIComponent(DEMO_AUTOMATION_MESSAGE)}`);
};

export async function createCatalogSourceAction(data: FormData) {
  const session = await requireAdmin();
  blockDemo("/admin/catalogo");
  const providerType = text(data, "providerType") as CatalogProviderType;
  const frequency = text(data, "frequency") as MonitorFrequency;
  const trustLevel = text(data, "trustLevel") as CatalogTrustLevel;
  if (!Object.values(CatalogProviderType).includes(providerType) ||
      !Object.values(MonitorFrequency).includes(frequency) ||
      !Object.values(CatalogTrustLevel).includes(trustLevel)) redirect("/admin/catalogo/fontes/nova?error=Configuração inválida");
  if (["OFFICIAL_CONFIRMED", "ADMIN_CONFIRMED"].includes(trustLevel)) redirect("/admin/catalogo/fontes/nova?error=Fontes externas não podem nascer confirmadas");
  const fixturePath = text(data, "fixturePath");
  const source = await prisma.catalogSource.create({ data: {
    name: text(data, "name"), providerType, frequency, trustLevel,
    baseUrl: text(data, "baseUrl") || null, notes: text(data, "notes") || null,
    config: fixturePath ? { fixturePath } : undefined, supportedFields: ["institution", "board", "position", "specialty", "year", "edition", "possibleOfficialUrl", "informativeUrl", "estimatedDate", "forecastStatus"],
    createdById: session.user.id,
  } });
  redirect(`/admin/catalogo/fontes/${source.id}`);
}

export async function runCatalogSourceAction(data: FormData) {
  const session = await requireAdmin();
  const id = text(data, "sourceId");
  blockDemo(`/admin/catalogo/fontes/${id}`);
  if (!(await enforceRateLimit(`admin:catalog-sync:${session.user.id}`, 10, 600)).allowed) redirect(`/admin/catalogo/fontes/${id}?error=Limite de sincronizações excedido`);
  try { const executor = jobExecutor(); const dryRun = data.get("dryRun") === "true"; if (executor.mode === "queue") await executor.enqueue({ type: "CATALOG_SYNC_SOURCE", payload: { version: 1, catalogSourceId: id, scheduledAt: new Date().toISOString(), dryRun } }); else await executor.execute("catalog-sync", { sourceId: id }, () => syncCatalogSource(prisma, id, { dryRun })); }
  catch (error) { redirect(`/admin/catalogo/fontes/${id}?error=${encodeURIComponent(error instanceof Error ? error.message : "Falha na sincronização")}`); }
  revalidatePath("/admin/catalogo"); redirect(`/admin/catalogo/fontes/${id}?notice=Execução aceita para processamento`);
}

export async function resolveCatalogConflictAction(data: FormData) {
  const session = await requireAdmin();
  const id = text(data, "conflictId");
  const decision = text(data, "decision");
  const conflict = await prisma.catalogConflict.findUnique({ where: { id }, include: { catalogExternalRecord: true } });
  if (!conflict || conflict.status !== "PENDING") redirect("/admin/catalogo/conflitos?error=Conflito indisponível");
  await prisma.$transaction(async (tx) => {
    if (decision === "accept" && conflict.editorialCatalogEntryId && conflict.field &&
        ["possibleOfficialUrl", "informativeUrl", "estimatedDate", "forecastStatus"].includes(conflict.field)) {
      const value = conflict.proposedValue == null ? null : String(conflict.proposedValue);
      await tx.editorialCatalogEntry.update({ where: { id: conflict.editorialCatalogEntryId }, data: {
        [conflict.field]: conflict.field === "estimatedDate" && value ? new Date(value) : value,
      } });
    }
    await tx.catalogConflict.update({ where: { id }, data: {
      status: decision === "accept" ? "ACCEPTED" : "REJECTED", reviewedById: session.user.id,
      reviewedAt: new Date(), resolutionNote: text(data, "note") || null,
    } });
  });
  revalidatePath("/admin/catalogo/conflitos"); redirect("/admin/catalogo/conflitos?notice=Decisão auditada");
}
