import Link from "next/link";
import { DocumentType } from "@prisma/client";
import { notFound } from "next/navigation";
import { AdminShell } from "@/components/layout/AdminShell";
import { requireAdmin } from "@/lib/admin";
import { prisma } from "@/lib/prisma";
import { classifyAndDownloadAction, dryRunAction, extractAction, provideExamJsonAction, retryFailedStageAction, selectDestinationAction, validateExamAction } from "../actions";
import { ImportForReviewButton } from "./ImportForReviewButton";
import { JobPolling } from "./JobPolling";

const steps = ["Origem", "Documentos", "Download", "Extração", "exam.json", "Dry-run", "Destino", "Importação", "Revisão"];
const progress: Record<string, number> = { CREATED: 0, DISCOVERING_DOCUMENTS: 0, WAITING_DOCUMENT_SELECTION: 1, DOWNLOADING: 2, EXTRACTING: 3, GENERATING_EXAM: 4, VALIDATING: 5, DRY_RUN_COMPLETE: 5, WAITING_REVIEW: 6, COMPLETED: 8, FAILED: 0 };

export default async function ImportJobPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ error?: string; notice?: string }> }) {
  await requireAdmin(); const [{ id }, query] = await Promise.all([params, searchParams]);
  const job = await prisma.importJob.findUnique({ where: { id }, include: {
    sourceDocuments: { orderBy: [{ displayOrder: "asc" }, { createdAt: "asc" }] },
    artifacts: { orderBy: { createdAt: "desc" } }, auditEvents: { orderBy: { createdAt: "desc" }, take: 30 },
  } });
  if (!job) notFound();
  const [entries, contests] = await Promise.all([
    prisma.editorialCatalogEntry.findMany({ where: {
      orgao: { equals: job.institution ?? "", mode: "insensitive" },
      ...(job.position ? { cargo: { equals: job.position, mode: "insensitive" } } : {}),
    }, include: { banca: true }, take: 20 }),
    prisma.concurso.findMany({ where: {
      orgao: { equals: job.institution ?? "", mode: "insensitive" },
      ...(job.position ? { cargo: { equals: job.position, mode: "insensitive" } } : {}),
    }, include: { banca: true, _count: { select: { questions: true, papers: true } } }, take: 20 }),
  ]);
  const current = progress[job.stage] ?? 0; const completed = job.stage === "COMPLETED";
  const importResult = job.importResult && typeof job.importResult === "object" && !Array.isArray(job.importResult) ? job.importResult as Record<string, unknown> : undefined;
  const queueReport = job.report && typeof job.report === "object" && !Array.isArray(job.report) ? job.report as Record<string, unknown> : {};
  return <AdminShell><main className="mx-auto max-w-7xl px-4 py-10">
    <div className="flex flex-wrap items-center justify-between gap-3"><div className="flex gap-4"><Link href="/admin/importacoes" className="font-bold text-emerald-800">← Importações</Link><Link href="/admin" className="font-bold text-emerald-800">Painel</Link></div><span className="rounded-full bg-amber-100 px-4 py-2 text-xs font-black text-amber-900">{job.stage}</span></div>
    <h1 className="mt-5 text-3xl font-black text-emerald-950">{job.institution} · {job.position}</h1><p className="mt-2 break-all text-sm text-slate-600">{job.officialUrl}</p>
    <JobPolling active={["WAITING", "RUNNING"].includes(String(queueReport.queueStatus ?? "")) || ["DISCOVERING_DOCUMENTS", "DOWNLOADING", "EXTRACTING", "GENERATING_EXAM", "VALIDATING"].includes(job.stage)} />
    <div className="mt-7 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-9">{steps.map((step, index) => <div key={step} className={`rounded-xl border p-3 text-center text-xs font-black ${index <= current ? "border-emerald-700 bg-emerald-900 text-white" : "border-amber-200 bg-[#fffdf5] text-slate-500"}`}>{index + 1}. {step}</div>)}</div>
    {(query.error || job.errorMessage) && <p className="mt-5 rounded-xl border border-red-200 bg-red-50 p-4 font-semibold text-red-800">{query.error ?? job.errorMessage}</p>}
    {query.notice && <p className="mt-5 rounded-xl border border-amber-200 bg-amber-50 p-4 font-semibold text-amber-900">{query.notice}</p>}
    {Array.isArray(job.warnings) && job.warnings.length > 0 && <div className="mt-5 rounded-xl border border-amber-300 bg-amber-50 p-4"><b>Avisos</b><ul className="mt-2 list-disc pl-5">{job.warnings.map((warning) => <li key={String(warning)}>{String(warning)}</li>)}</ul></div>}
    {job.stage === "FAILED" && <form action={retryFailedStageAction} className="mt-4"><input type="hidden" name="jobId" value={job.id} /><button className="rounded-xl border border-red-300 px-4 py-2 font-black text-red-800">Repetir etapa que falhou</button></form>}

    <section className="mt-7 rounded-2xl border border-amber-200 bg-[#fffdf5] p-5"><h2 className="text-xl font-black text-emerald-950">Documentos</h2>
      <form action={classifyAndDownloadAction} className="mt-4"><input type="hidden" name="jobId" value={job.id} />
        <div className="overflow-x-auto"><table className="min-w-[1150px] w-full text-left text-sm"><thead><tr>{["Selecionar", "Nome", "URL", "Tipo detectado", "Tipo confirmado", "Caderno", "Tamanho / MIME", "Hash", "Data", "Status", "Arquivo"].map((label) => <th key={label} className="border-b px-2 py-2 text-xs uppercase text-slate-500">{label}</th>)}</tr></thead><tbody>{job.sourceDocuments.map((doc) => {
          const metadata = doc.metadata && typeof doc.metadata === "object" && !Array.isArray(doc.metadata) ? doc.metadata as Record<string, unknown> : {};
          return <tr key={doc.id} className="border-b align-top"><td className="px-2 py-3"><input type="hidden" name="allDocumentIds" value={doc.id} /><input type="checkbox" name="documentIds" value={doc.id} defaultChecked={["SELECTED", "VALIDATED"].includes(doc.status)} disabled={doc.status === "VALIDATED"} /></td><td className="px-2 py-3">{doc.description ?? doc.originalFilename ?? "Documento"}</td><td className="max-w-64 break-all px-2 py-3 text-xs">{doc.sourceUrl}</td><td className="px-2 py-3">{String(metadata.detectedType ?? doc.documentType)}</td><td className="px-2 py-3"><select name={`documentType.${doc.id}`} defaultValue={doc.documentType} disabled={doc.status === "VALIDATED"} className="input min-w-52">{Object.values(DocumentType).map((type) => <option key={type}>{type}</option>)}</select></td><td className="px-2 py-3">{doc.paperCode ?? "—"}</td><td className="px-2 py-3">{doc.size ? `${doc.size} bytes` : "—"}<span className="block">{doc.mimeType ?? "—"}</span></td><td className="max-w-48 break-all px-2 py-3 font-mono text-xs">{doc.sha256 ?? "—"}</td><td className="px-2 py-3">{doc.publishedAt?.toLocaleDateString("pt-BR") ?? "—"}</td><td className="px-2 py-3">{doc.status}</td><td className="px-2 py-3">{doc.localPath && <span className="flex gap-2"><a target="_blank" href={`/api/admin/importacoes/${job.id}/documentos/${doc.id}`} className="font-bold text-emerald-800">Ver</a><a href={`/api/admin/importacoes/${job.id}/documentos/${doc.id}?download=1`} className="font-bold text-emerald-800">Baixar</a></span>}</td></tr>;
        })}</tbody></table></div>
        {job.stage === "WAITING_DOCUMENT_SELECTION" && <button className="mt-4 rounded-xl bg-emerald-900 px-5 py-3 font-black text-white">Confirmar classificação e baixar selecionados</button>}
      </form>
    </section>

    <section className="mt-5 grid gap-4 md:grid-cols-3">
      <Action title="Extração local" description="Extrai texto sem IA e preserva artefatos anteriores." action={extractAction} jobId={job.id} enabled={job.stage === "EXTRACTING"} button="Executar extração" />
      <div className="rounded-2xl border border-amber-200 bg-[#fffdf5] p-5"><h2 className="font-black text-emerald-950">exam.json</h2><p className="mt-2 text-sm text-slate-600">Use a saída determinística/revisada. O arquivo nunca é sobrescrito e não dispara importação.</p><form action={provideExamJsonAction} className="mt-4 space-y-3"><input type="hidden" name="jobId" value={job.id} /><input name="examJson" type="file" accept=".json,application/json" required disabled={job.stage !== "GENERATING_EXAM"} className="block w-full text-sm" /><button disabled={job.stage !== "GENERATING_EXAM"} className="rounded-xl bg-amber-400 px-4 py-2 font-black text-emerald-950 disabled:opacity-40">Fornecer e validar exam.json</button></form><form action={validateExamAction} className="mt-2"><input type="hidden" name="jobId" value={job.id} /><button disabled={job.stage !== "GENERATING_EXAM"} className="text-sm font-bold text-emerald-800 disabled:opacity-40">Validar arquivo já existente</button></form></div>
      <Action title="Dry-run" description="Verifica conflitos e não grava dados editoriais." action={dryRunAction} jobId={job.id} enabled={job.stage === "VALIDATING" || job.stage === "DRY_RUN_COMPLETE"} button="Executar dry-run" />
    </section>

    <section className="mt-5 rounded-2xl border border-amber-200 bg-[#fffdf5] p-5"><h2 className="text-xl font-black text-emerald-950">Destino da importação</h2><p className="mt-1 text-sm text-slate-600">Concursos publicados ou arquivados são exibidos apenas como bloqueados.</p>
      <form action={selectDestinationAction} className="mt-4 space-y-3"><input type="hidden" name="jobId" value={job.id} />
        <label className="block rounded-xl border bg-white p-4"><input type="radio" name="destinationType" value="NEW_CONTEST" defaultChecked={job.destinationType === "NEW_CONTEST"} /> <b>Criar novo concurso</b><span className="ml-2 text-sm">{job.institution} · {job.position} · {job.year ?? "ano a confirmar"}</span></label>
        <label className="block rounded-xl border bg-white p-4"><input type="radio" name="destinationType" value="EDITORIAL_ENTRY" defaultChecked={job.destinationType === "EDITORIAL_ENTRY"} /> <b>Associar a uma entrada editorial</b><select name="destinationEditorialEntryId" defaultValue={job.destinationEditorialEntryId ?? ""} className="input mt-2 w-full"><option value="">Selecione</option>{entries.map((entry) => <option key={entry.id} value={entry.id}>{entry.orgao} · {entry.cargo ?? entry.title} · {entry.banca?.name ?? "banca a confirmar"}</option>)}</select></label>
        <label className="block rounded-xl border bg-white p-4"><input type="radio" name="destinationType" value="EXISTING_CONTEST_NEW_PAPER" defaultChecked={job.destinationType === "EXISTING_CONTEST_NEW_PAPER"} /> <b>Adicionar novo caderno a concurso em revisão</b><select name="destinationContestId" defaultValue={job.destinationContestId ?? ""} className="input mt-2 w-full"><option value="">Selecione</option>{contests.map((contest) => <option key={contest.id} value={contest.id} disabled={["PUBLISHED", "ARCHIVED"].includes(contest.status)}>{contest.orgao} · {contest.cargo} · {contest.status} · {contest._count.papers} cadernos · {contest._count.questions} questões</option>)}</select></label>
        <label className="block rounded-xl border border-red-200 bg-red-50 p-4"><input type="radio" name="destinationType" value="CANCELLED" /> <b>Cancelar importação</b></label>
        <button disabled={!["WAITING_REVIEW", "DRY_RUN_COMPLETE"].includes(job.stage)} className="rounded-xl bg-amber-400 px-5 py-3 font-black text-emerald-950 disabled:opacity-40">Confirmar destino</button>
      </form>
    </section>

    <section className="mt-5 rounded-2xl border border-emerald-200 bg-emerald-50 p-5"><h2 className="text-xl font-black text-emerald-950">Importação persistente</h2>
      {completed && importResult ? <div className="mt-3"><p className="font-bold">Concluída: {String(importResult.createdQuestions ?? 0)} questões e {String(importResult.createdVisualAssets ?? 0)} recursos visuais criados como IN_REVIEW.</p><div className="mt-3 flex flex-wrap gap-3"><Link href={`/admin/concursos/${String(importResult.concursoId)}`} className="font-black text-emerald-800">Abrir concurso</Link><Link href="/admin?status=IN_REVIEW" className="font-black text-emerald-800">Abrir fila de revisão</Link><a href="#artifacts" className="font-black text-emerald-800">Ver relatório</a></div></div>
      : <ImportForReviewButton jobId={job.id} enabled={job.stage === "WAITING_REVIEW" && Boolean(job.destinationType) && job.destinationType !== "CANCELLED"} />}
    </section>

    <section id="artifacts" className="mt-5 rounded-2xl border border-stone-200 bg-white p-5"><h2 className="text-xl font-black text-emerald-950">Artefatos</h2><div className="mt-3 overflow-x-auto"><table className="w-full text-sm"><thead><tr><th className="text-left">Tipo</th><th className="text-left">Hash</th><th className="text-left">Data</th><th>Ações</th></tr></thead><tbody>{job.artifacts.map((artifact) => <tr key={artifact.id} className="border-t"><td className="py-3"><b>{artifact.artifactType}</b></td><td><code className="break-all text-xs">{artifact.sha256}</code></td><td>{artifact.createdAt.toLocaleString("pt-BR")}</td><td className="text-right"><a target="_blank" href={`/api/admin/importacoes/${job.id}/artefatos/${artifact.id}`} className="font-bold text-emerald-800">Visualizar</a> · <a href={`/api/admin/importacoes/${job.id}/artefatos/${artifact.id}?download=1`} className="font-bold text-emerald-800">Baixar</a></td></tr>)}</tbody></table></div></section>
    <section className="mt-5 rounded-2xl border border-stone-200 bg-white p-5"><h2 className="text-xl font-black text-emerald-950">Auditoria</h2><ul className="mt-3 space-y-2 text-sm">{job.auditEvents.map((event) => <li key={event.id}><b>{event.action}</b> · {event.createdAt.toLocaleString("pt-BR")}</li>)}</ul></section>
  </main></AdminShell>;
}

function Action({ title, description, action, jobId, enabled, button }: { title: string; description: string; action: (data: FormData) => Promise<void>; jobId: string; enabled: boolean; button: string }) {
  return <div className="rounded-2xl border border-amber-200 bg-[#fffdf5] p-5"><h2 className="font-black text-emerald-950">{title}</h2><p className="mt-2 text-sm text-slate-600">{description}</p><form action={action} className="mt-4"><input type="hidden" name="jobId" value={jobId} /><button disabled={!enabled} className="rounded-xl bg-amber-400 px-4 py-2 font-black text-emerald-950 disabled:cursor-not-allowed disabled:opacity-40">{button}</button></form></div>;
}
