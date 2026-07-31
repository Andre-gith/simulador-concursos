"use client";

import { useState } from "react";
import { analyzeSourceAction, createManualImportAction } from "../actions";

const types = [
  ["NOTICE", "EDITAL"], ["EXAM", "PROVA"], ["ANSWER_KEY_PRELIMINARY", "GABARITO_PRELIMINAR"],
  ["ANSWER_KEY_FINAL", "GABARITO_DEFINITIVO"], ["RECTIFICATION", "RETIFICAÇÃO"],
  ["ANNULMENT_NOTICE", "ANULAÇÃO"], ["RESULT", "RESULTADO"], ["OTHER", "OUTRO"],
] as const;

type Row = { key: number; url: string; type: string; description: string; paperCode: string; publishedAt: string };

type Defaults = { editorialCatalogEntryId?: string; institution?: string; board?: string; position?: string; specialty?: string; year?: number; edition?: string };

export function OfficialImportForm({ defaults = {} }: { defaults?: Defaults }) {
  const [mode, setMode] = useState<"page" | "direct">("page");
  const [sequence, setSequence] = useState(2);
  const [rows, setRows] = useState<Row[]>([
    { key: 0, url: "", type: "EXAM", description: "Prova", paperCode: "", publishedAt: "" },
    { key: 1, url: "", type: "ANSWER_KEY_FINAL", description: "Gabarito", paperCode: "", publishedAt: "" },
  ]);
  const move = (index: number, delta: number) => {
    const target = index + delta;
    if (target < 0 || target >= rows.length) return;
    const next = [...rows]; [next[index], next[target]] = [next[target], next[index]]; setRows(next);
  };
  return <form action={mode === "page" ? analyzeSourceAction : createManualImportAction} className="mt-7">
    <div className="grid gap-3 sm:grid-cols-2">
      <button type="button" onClick={() => setMode("page")} className={`rounded-xl border p-4 text-left ${mode === "page" ? "border-emerald-800 bg-emerald-50" : "border-stone-200 bg-white"}`}><b>A. Página oficial</b><span className="mt-1 block text-sm">Descoberta automática de documentos.</span></button>
      <button type="button" onClick={() => setMode("direct")} className={`rounded-xl border p-4 text-left ${mode === "direct" ? "border-emerald-800 bg-emerald-50" : "border-stone-200 bg-white"}`}><b>B. URLs diretas</b><span className="mt-1 block text-sm">Classificação manual de PDFs oficiais.</span></button>
    </div>
    <input type="hidden" name="mode" value={mode} />
    {defaults.editorialCatalogEntryId && <input type="hidden" name="editorialCatalogEntryId" value={defaults.editorialCatalogEntryId} />}
    <div className="mt-5 grid gap-4 md:grid-cols-2">
      {mode === "page" && <Field label="URL oficial *" name="officialUrl" type="url" required wide placeholder="https://dominio-oficial.gov.br/concurso" />}
      <Field label="Banca" name="board" placeholder="Opcional" defaultValue={defaults.board} />
      <Field label="Instituição *" name="institution" required defaultValue={defaults.institution} />
      <Field label="Cargo *" name="position" required defaultValue={defaults.position} />
      <Field label="Especialidade" name="specialty" defaultValue={defaults.specialty} />
      <Field label="Ano" name="year" type="number" min="1900" max="2200" defaultValue={defaults.year} />
      <Field label="Edição" name="edition" defaultValue={defaults.edition} />
      <Field label="Caderno" name="paperCode" />
      <label className="md:col-span-2 text-sm font-bold text-emerald-950">Observações administrativas<textarea name="adminNotes" maxLength={4000} className="input mt-2 min-h-24 w-full" /></label>
    </div>
    {mode === "direct" && <div className="mt-6 space-y-4">
      <input type="hidden" name="documentCount" value={rows.length} />
      {rows.map((row, index) => <div key={row.key} className="rounded-2xl border border-stone-200 bg-white p-4">
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-6">
          <Field label={`URL ${index + 1} *`} name={`documentUrl.${index}`} type="url" required wide placeholder="https://dominio-oficial.gov.br/documento.pdf" />
          <label className="text-sm font-bold text-emerald-950">Tipo *<select name={`documentType.${index}`} defaultValue={row.type} className="input mt-2 w-full">{types.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
          <Field label="Descrição" name={`documentDescription.${index}`} defaultValue={row.description} />
          <Field label="Caderno" name={`documentPaper.${index}`} />
          <Field label="Data" name={`documentDate.${index}`} type="date" />
          <div className="flex items-end gap-2"><button type="button" aria-label="Mover para cima" onClick={() => move(index, -1)} className="rounded-lg border px-3 py-2">↑</button><button type="button" aria-label="Mover para baixo" onClick={() => move(index, 1)} className="rounded-lg border px-3 py-2">↓</button><button type="button" onClick={() => setRows(rows.filter((_, rowIndex) => rowIndex !== index))} disabled={rows.length === 1} className="rounded-lg border border-red-200 px-3 py-2 text-red-700 disabled:opacity-40">Remover</button></div>
        </div>
      </div>)}
      <button type="button" onClick={() => { setRows([...rows, { key: sequence, url: "", type: "OTHER", description: "", paperCode: "", publishedAt: "" }]); setSequence(sequence + 1); }} disabled={rows.length >= 12} className="rounded-xl border border-emerald-800 px-4 py-2 font-bold text-emerald-900">+ Adicionar URL</button>
    </div>}
    <div className="mt-6 flex justify-end"><button className="rounded-xl bg-emerald-900 px-6 py-3 font-black text-white">{mode === "page" ? "Analisar URL" : "Validar todas as URLs"}</button></div>
  </form>;
}

function Field({ label, wide, ...props }: React.InputHTMLAttributes<HTMLInputElement> & { label: string; wide?: boolean }) {
  return <label className={`${wide ? "lg:col-span-3 md:col-span-2 " : ""}text-sm font-bold text-emerald-950`}>{label}<input {...props} className="input mt-2 w-full" /></label>;
}
