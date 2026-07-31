import Link from "next/link";
import { ImportJobStage, ImportStatus } from "@prisma/client";
import { AdminShell } from "@/components/layout/AdminShell";
import { requireAdmin } from "@/lib/admin";
import { prisma } from "@/lib/prisma";

function first(value: string | string[] | undefined) { return Array.isArray(value) ? value[0] ?? "" : value ?? ""; }

export default async function ImportsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  await requireAdmin(); const query = await searchParams;
  const status = Object.values(ImportStatus).includes(first(query.status) as ImportStatus) ? first(query.status) as ImportStatus : undefined;
  const stage = Object.values(ImportJobStage).includes(first(query.stage) as ImportJobStage) ? first(query.stage) as ImportJobStage : undefined;
  const board = first(query.board).trim().slice(0, 100); const state = first(query.state);
  const from = first(query.from); const to = first(query.to);
  const jobs = await prisma.importJob.findMany({
    where: {
      ...(status ? { status } : {}), ...(stage ? { stage } : {}), ...(board ? { board: { contains: board, mode: "insensitive" } } : {}),
      ...(state === "failed" ? { stage: "FAILED" } : state === "review" ? { stage: "WAITING_REVIEW" } : state === "completed" ? { stage: "COMPLETED" } : {}),
      ...(from || to ? { createdAt: { ...(from ? { gte: new Date(`${from}T00:00:00`) } : {}), ...(to ? { lte: new Date(`${to}T23:59:59.999`) } : {}) } } : {}),
    },
    include: { adminUser: { select: { name: true, email: true } }, _count: { select: { sourceDocuments: true } } },
    orderBy: { createdAt: "desc" }, take: 200,
  });
  return <AdminShell><main className="mx-auto max-w-7xl px-4 py-10">
    <div className="flex flex-wrap items-start justify-between gap-4"><div><p className="text-xs font-black uppercase tracking-[0.2em] text-amber-700">Fluxos oficiais</p><h1 className="mt-2 text-3xl font-black text-emerald-950">Importações</h1></div><Link href="/admin/importacoes/nova" className="rounded-xl bg-emerald-900 px-5 py-3 font-black text-white">Nova importação</Link></div>
    <form className="mt-6 grid gap-3 rounded-2xl border border-amber-200 bg-[#fffdf5] p-5 md:grid-cols-3 lg:grid-cols-6">
      <select name="status" defaultValue={status ?? ""} className="input"><option value="">Todos os status</option>{Object.values(ImportStatus).map((item) => <option key={item}>{item}</option>)}</select>
      <select name="stage" defaultValue={stage ?? ""} className="input"><option value="">Todas as etapas</option>{Object.values(ImportJobStage).map((item) => <option key={item}>{item}</option>)}</select>
      <input name="board" defaultValue={board} placeholder="Banca" className="input" />
      <input name="from" type="date" defaultValue={from} className="input" /><input name="to" type="date" defaultValue={to} className="input" />
      <select name="state" defaultValue={state} className="input"><option value="">Qualquer situação</option><option value="failed">Falhou</option><option value="review">Aguardando revisão</option><option value="completed">Concluído</option></select>
      <button className="rounded-xl bg-amber-400 px-4 py-2 font-black text-emerald-950">Filtrar</button>
    </form>
    <div className="mt-6 overflow-x-auto rounded-2xl border border-stone-200 bg-white"><table className="min-w-[1100px] w-full text-left text-sm"><thead className="bg-stone-50 text-xs uppercase text-slate-500"><tr>{["ID", "Instituição", "Cargo / especialidade", "Banca", "Etapa", "Status", "Docs", "Data", "Responsável", "Avisos", "Ação"].map((label) => <th key={label} className="px-3 py-3">{label}</th>)}</tr></thead><tbody>
      {jobs.map((job) => <tr key={job.id} className="border-t border-stone-100"><td className="px-3 py-4 font-mono text-xs">{job.id}</td><td className="px-3 py-4 font-bold">{job.institution ?? "—"}</td><td className="px-3 py-4">{job.position ?? "—"}<span className="block text-slate-500">{job.specialty ?? "—"}</span></td><td className="px-3 py-4">{job.board ?? "—"}</td><td className="px-3 py-4"><Badge>{job.stage}</Badge></td><td className="px-3 py-4">{job.status}</td><td className="px-3 py-4 text-center">{job._count.sourceDocuments}</td><td className="px-3 py-4">{job.createdAt.toLocaleDateString("pt-BR")}</td><td className="px-3 py-4">{job.adminUser?.name ?? job.adminUser?.email ?? "—"}</td><td className="max-w-48 px-3 py-4 text-xs">{Array.isArray(job.warnings) ? job.warnings.join(" ") : "—"}</td><td className="px-3 py-4"><Link href={`/admin/importacoes/${job.id}`} className="font-black text-emerald-800">Abrir</Link></td></tr>)}
    </tbody></table>{!jobs.length && <p className="p-8 text-center text-slate-500">Nenhuma importação encontrada.</p>}</div>
  </main></AdminShell>;
}

function Badge({ children }: { children: React.ReactNode }) { return <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-black text-amber-900">{children}</span>; }
