import Link from "next/link";
import { AdminShell } from "@/components/layout/AdminShell";
import { requireAdmin } from "@/lib/admin";
import { prisma } from "@/lib/prisma";
import { createMonitorAction } from "../actions";

export default async function NewMonitorPage({ searchParams }:{searchParams:Promise<{error?:string}>}) {
  await requireAdmin(); const [{error}, banks, contests, entries] = await Promise.all([searchParams, prisma.banca.findMany({orderBy:{name:"asc"}}), prisma.concurso.findMany({where:{status:{in:["DRAFT","IN_REVIEW"]}},orderBy:{createdAt:"desc"},take:100}), prisma.editorialCatalogEntry.findMany({orderBy:{createdAt:"desc"},take:100})]);
  return <AdminShell><main className="mx-auto max-w-4xl px-4 py-10"><Link href="/admin/monitoramento" className="font-bold text-emerald-800">← Monitoramento</Link><section className="mt-5 rounded-2xl border border-amber-200 bg-[#fffdf5] p-6"><h1 className="text-3xl font-black text-emerald-950">Novo monitor</h1>{error&&<p className="mt-3 bg-red-50 p-3 text-red-800">{error}</p>}<form action={createMonitorAction} className="mt-6 grid gap-4 md:grid-cols-2">
    <Field name="name" label="Nome *" required/><Field name="sourceUrl" label="URL oficial HTTPS *" type="url" required/><Field name="institution" label="Instituição *" required/>
    <label className="font-bold">Adaptador<select name="adapterType" className="input mt-2 w-full"><option>CebraspeSourceAdapter</option><option>CesgranrioSourceAdapter</option><option>GenericOfficialPageAdapter</option></select></label>
    <label className="font-bold">Banca<select name="boardId" className="input mt-2 w-full"><option value="">Opcional</option>{banks.map(x=><option key={x.id} value={x.id}>{x.name}</option>)}</select></label>
    <label className="font-bold">Frequência<select name="frequency" className="input mt-2 w-full"><option>DAILY</option><option>WEEKLY</option><option>MANUAL</option></select></label>
    <label className="font-bold">Concurso<select name="contestId" className="input mt-2 w-full"><option value="">Opcional</option>{contests.map(x=><option key={x.id} value={x.id}>{x.orgao} · {x.cargo}</option>)}</select></label>
    <label className="font-bold">Entrada editorial<select name="editorialCatalogEntryId" className="input mt-2 w-full"><option value="">Opcional</option>{entries.map(x=><option key={x.id} value={x.id}>{x.orgao} · {x.title}</option>)}</select></label>
    <label className="md:col-span-2 font-bold">Observações<textarea name="notes" className="input mt-2 min-h-24 w-full"/></label><label><input type="checkbox" name="enabled" defaultChecked/> Ativo</label>
    <div className="md:col-span-2"><button className="rounded-xl bg-emerald-900 px-5 py-3 font-black text-white">Criar monitor</button></div>
  </form></section></main></AdminShell>;
}
function Field(props:React.InputHTMLAttributes<HTMLInputElement>&{label:string}){const {label,...rest}=props;return <label className="font-bold">{label}<input {...rest} className="input mt-2 w-full"/></label>}
