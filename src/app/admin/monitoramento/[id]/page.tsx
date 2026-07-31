import Link from "next/link";
import { notFound } from "next/navigation";
import { AdminShell } from "@/components/layout/AdminShell";
import { requireAdmin } from "@/lib/admin";
import { prisma } from "@/lib/prisma";
import { runMonitorAction, toggleMonitorAction } from "../actions";

export default async function MonitorPage({params,searchParams}:{params:Promise<{id:string}>;searchParams:Promise<{error?:string;notice?:string}>}) {
  await requireAdmin(); const [{id},query]=await Promise.all([params,searchParams]);
  const monitor=await prisma.sourceMonitor.findUnique({where:{id},include:{board:true,contest:true,editorialCatalogEntry:true,runs:{orderBy:{startedAt:"desc"},take:30,include:{_count:{select:{changes:true}}}}}});
  if(!monitor) notFound();
  return <AdminShell><main className="mx-auto max-w-6xl px-4 py-10"><Link href="/admin/monitoramento" className="font-bold text-emerald-800">← Monitoramento</Link><div className="mt-5 flex flex-wrap justify-between gap-4"><div><h1 className="text-3xl font-black text-emerald-950">{monitor.name}</h1><p className="mt-2 break-all text-sm">{monitor.sourceUrl}</p></div><span className="rounded-full bg-amber-100 px-4 py-2 font-black">{monitor.enabled?"ATIVO":"INATIVO"}</span></div>
  {query.error&&<p className="mt-4 bg-red-50 p-3 text-red-800">{query.error}</p>}{query.notice&&<p className="mt-4 bg-emerald-50 p-3 text-emerald-800">{query.notice}</p>}
  <section className="mt-6 grid gap-3 md:grid-cols-3"><Info label="Frequência" value={monitor.frequency}/><Info label="Próxima execução" value={monitor.nextCheckAt?.toLocaleString("pt-BR")??"Manual"}/><Info label="Falhas consecutivas" value={String(monitor.consecutiveFailures)}/></section>
  {monitor.consecutiveFailures>=3&&<p className="mt-4 rounded-xl border border-red-300 bg-red-50 p-4 font-black text-red-800">Monitor com falhas recorrentes.</p>}
  <div className="mt-5 flex gap-3"><form action={runMonitorAction}><input type="hidden" name="monitorId" value={monitor.id}/><button className="rounded-xl bg-emerald-900 px-5 py-3 font-black text-white">Executar verificação agora</button></form><form action={toggleMonitorAction}><input type="hidden" name="monitorId" value={monitor.id}/><input type="hidden" name="enabled" value={monitor.enabled?"false":"true"}/><button className="rounded-xl border px-5 py-3 font-black">{monitor.enabled?"Desativar":"Ativar"}</button></form></div>
  <section className="mt-6 rounded-2xl border bg-white p-5"><h2 className="text-xl font-black text-emerald-950">Execuções</h2><table className="mt-3 w-full text-sm"><thead><tr><th>Início</th><th>Status</th><th>Novos</th><th>Alterados</th><th>Inalterados</th><th>Tentativas</th><th>Alterações</th></tr></thead><tbody>{monitor.runs.map(run=><tr key={run.id} className="border-t text-center"><td className="py-3">{run.startedAt.toLocaleString("pt-BR")}</td><td>{run.status}</td><td>{run.documentsNew}</td><td>{run.documentsChanged}</td><td>{run.documentsUnchanged}</td><td>{run.attempts}</td><td>{run._count.changes}</td></tr>)}</tbody></table></section>
  </main></AdminShell>;
}
function Info({label,value}:{label:string;value:string}){return <div className="rounded-2xl border border-amber-200 bg-[#fffdf5] p-4"><p className="text-sm">{label}</p><p className="mt-1 font-black">{value}</p></div>}
