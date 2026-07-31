import Link from "next/link";
import { AdminShell } from "@/components/layout/AdminShell";
import { requireAdmin } from "@/lib/admin";
import { OfficialImportForm } from "./OfficialImportForm";
import { prisma } from "@/lib/prisma";

export default async function NewOfficialImportPage({ searchParams }: { searchParams: Promise<{ error?: string; editorialCatalogEntryId?: string }> }) {
  await requireAdmin(); const { error, editorialCatalogEntryId } = await searchParams;
  const entry = editorialCatalogEntryId ? await prisma.editorialCatalogEntry.findUnique({ where: { id: editorialCatalogEntryId }, include: { banca: true } }) : null;
  return <AdminShell><main className="mx-auto max-w-5xl px-4 py-10">
    <Link href="/admin" className="font-bold text-emerald-800">← Painel administrativo</Link>
    <div className="mt-6 rounded-3xl border border-amber-200 bg-[#fffdf5] p-6 shadow-sm">
      <p className="text-xs font-black uppercase tracking-[0.2em] text-amber-700">Importação oficial · etapa 1 de 7</p>
      <h1 className="mt-2 text-3xl font-black text-emerald-950">Importar concurso por URL oficial</h1>
      <p className="mt-2 text-slate-600">A análise apenas localiza documentos. Nenhum concurso ou questão será criado nesta etapa.</p>
      {error && <p className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm font-semibold text-red-800">{error}</p>}
      {entry && <p className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm font-semibold">Confirmando “{entry.title}” por fonte oficial. A entrada editorial será vinculada ao trabalho.</p>}
      <OfficialImportForm defaults={entry ? { editorialCatalogEntryId: entry.id, institution: entry.orgao, board: entry.banca?.name, position: entry.cargo ?? entry.title, specialty: entry.especialidade ?? undefined, year: entry.ano ?? undefined, edition: entry.edicao ?? undefined } : {}} />
    </div>
  </main></AdminShell>;
}
