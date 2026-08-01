import Link from "next/link";
import { AdminShell } from "@/components/layout/AdminShell";
import { requireAdmin } from "@/lib/admin";
import { prisma } from "@/lib/prisma";
import { DEMO_AUTOMATION_MESSAGE, isDemoDeployment } from "@/lib/deployment-mode";

export default async function CatalogAdminPage() {
  await requireAdmin();
  const demo = isDemoDeployment();
  const [entries, sources, pending, runs] = await Promise.all([
    prisma.editorialCatalogEntry.count(), prisma.catalogSource.count(),
    prisma.catalogConflict.count({ where: { status: "PENDING" } }), prisma.catalogSyncRun.count(),
  ]);
  return <AdminShell><main className="mx-auto max-w-6xl px-4 py-10">
    <Link href="/admin" className="font-bold text-emerald-800">← Painel administrativo</Link>
    <h1 className="mt-5 text-3xl font-black text-emerald-950">Catálogo editorial</h1>
    <p className="mt-2 text-slate-600">Fontes comunitárias alimentam apenas oportunidades em preparação. Nunca criam simulados, concursos ou questões.</p>
    {demo && <p className="mt-5 rounded-xl border border-amber-300 bg-amber-50 p-4 font-bold text-amber-900">{DEMO_AUTOMATION_MESSAGE}</p>}
    <div className="mt-6 grid gap-4 sm:grid-cols-4">{[["Entradas",entries],["Fontes",sources],["Conflitos",pending],["Execuções",runs]].map(([label,value])=><div key={label} className="rounded-2xl border bg-white p-5"><p className="text-sm text-slate-500">{label}</p><p className="text-3xl font-black">{value}</p></div>)}</div>
    <nav className="mt-6 flex flex-wrap gap-3"><Link className="rounded-xl bg-emerald-800 px-4 py-3 font-bold text-white" href="/admin/catalogo/fontes">Fontes</Link><Link className="rounded-xl border px-4 py-3 font-bold" href="/admin/catalogo/sincronizacoes">Sincronizações</Link><Link className="rounded-xl border px-4 py-3 font-bold" href="/admin/catalogo/conflitos">Conflitos</Link></nav>
  </main></AdminShell>;
}
