import Link from "next/link";
import { AdminShell } from "@/components/layout/AdminShell";
import { requireAdmin } from "@/lib/admin";
import { prisma } from "@/lib/prisma";

export default async function MonitoringPage() {
  await requireAdmin();
  const [monitors, pending, failures] = await Promise.all([
    prisma.sourceMonitor.findMany({ include: { board: true, runs: { orderBy: { startedAt: "desc" }, take: 1 }, _count: { select: { runs: true } } }, orderBy: { createdAt: "desc" } }),
    prisma.documentChange.count({ where: { status: "WAITING_REVIEW" } }),
    prisma.monitorRun.count({ where: { status: "FAILED", startedAt: { gte: new Date(Date.now() - 7 * 86400000) } } }),
  ]);
  return <AdminShell><main className="mx-auto max-w-7xl px-4 py-10">
    <div className="flex flex-wrap justify-between gap-4"><div><p className="text-xs font-black uppercase tracking-[.2em] text-amber-700">Fontes oficiais</p><h1 className="mt-2 text-3xl font-black text-emerald-950">Monitoramento</h1></div><div className="flex gap-3"><Link href="/admin/monitoramento/alteracoes" className="rounded-xl border border-emerald-900 px-4 py-3 font-black text-emerald-900">Alterações pendentes</Link><Link href="/admin/monitoramento/novo" className="rounded-xl bg-emerald-900 px-4 py-3 font-black text-white">Novo monitor</Link></div></div>
    <div className="mt-6 grid gap-3 md:grid-cols-3"><Card label="Monitores ativos" value={monitors.filter((item) => item.enabled).length} /><Card label="Atualizações pendentes" value={pending} /><Card label="Falhas recentes" value={failures} /></div>
    <div className="mt-6 overflow-x-auto rounded-2xl border bg-white"><table className="min-w-[1000px] w-full text-sm"><thead><tr>{["Monitor","Instituição","Banca","Frequência","Ativo","Próxima","Última execução","Falhas","Ação"].map((x)=><th key={x} className="px-3 py-3 text-left">{x}</th>)}</tr></thead><tbody>{monitors.map((monitor)=><tr key={monitor.id} className="border-t"><td className="px-3 py-4 font-bold">{monitor.name}</td><td className="px-3">{monitor.institution}</td><td className="px-3">{monitor.board?.name ?? "—"}</td><td className="px-3">{monitor.frequency}</td><td className="px-3">{monitor.enabled ? "Sim" : "Não"}</td><td className="px-3">{monitor.nextCheckAt?.toLocaleString("pt-BR") ?? "Manual"}</td><td className="px-3">{monitor.runs[0]?.status ?? "—"}</td><td className="px-3">{monitor.consecutiveFailures}</td><td className="px-3"><Link href={`/admin/monitoramento/${monitor.id}`} className="font-black text-emerald-800">Abrir</Link></td></tr>)}</tbody></table></div>
  </main></AdminShell>;
}
function Card({label,value}:{label:string;value:number}) { return <div className="rounded-2xl border border-amber-200 bg-[#fffdf5] p-5"><p className="text-sm text-slate-600">{label}</p><p className="mt-1 text-3xl font-black text-emerald-950">{value}</p></div>; }
