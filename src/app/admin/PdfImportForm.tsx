"use client";

import { useActionState } from "react";

import {
  importOfficialPdfs,
  type PdfImportActionState,
} from "./actions";

const initialState: PdfImportActionState = {
  status: "idle",
  message: "",
};

export function PdfImportForm({ aiConfigured }: { aiConfigured: boolean }) {
  const [state, action, pending] = useActionState(
    importOfficialPdfs,
    initialState,
  );

  return (
    <form action={action} className="mt-5 space-y-5">
      <div className="grid gap-4 md:grid-cols-2">
        <Field label="Instituição *">
          <input
            name="agency"
            required
            className="input"
            placeholder="Ex.: Banco do Brasil"
          />
        </Field>
        <Field label="Banca">
          <input name="board" className="input" placeholder="Se confirmada" />
        </Field>
        <Field label="Ano">
          <input
            name="year"
            type="number"
            min="1900"
            max="2200"
            className="input"
          />
        </Field>
        <Field label="Edição">
          <input name="edition" className="input" />
        </Field>
        <Field label="Cargo">
          <input name="position" className="input" />
        </Field>
        <Field label="Especialidade">
          <input name="specialty" className="input" />
        </Field>
        <Field label="Nível">
          <select name="educationLevel" className="input" defaultValue="">
            <option value="">A confirmar</option>
            <option value="FUNDAMENTAL">Fundamental</option>
            <option value="MEDIO">Médio</option>
            <option value="TECNICO">Técnico</option>
            <option value="SUPERIOR">Superior</option>
          </select>
        </Field>
        <Field label="Código do caderno">
          <input name="paperCode" className="input" />
        </Field>
        <Field label="PDF oficial da prova *">
          <input
            name="examPdf"
            type="file"
            accept="application/pdf,.pdf"
            required
            className="block w-full text-sm text-neutral-300"
          />
        </Field>
        <Field label="PDF oficial do gabarito *">
          <input
            name="answerKeyPdf"
            type="file"
            accept="application/pdf,.pdf"
            required
            className="block w-full text-sm text-neutral-300"
          />
        </Field>
      </div>

      <div
        className={`rounded-lg p-4 text-sm ${
          aiConfigured
            ? "bg-emerald-950 text-emerald-200"
            : "bg-amber-950 text-amber-200"
        }`}
      >
        {aiConfigured
          ? "Provider Anthropic configurado. O JSON será validado antes da transação e nada será publicado automaticamente."
          : "Modo de desenvolvimento: os PDFs e o texto intermediário serão salvos localmente, mas nenhuma IA será executada até ANTHROPIC_API_KEY e ANTHROPIC_MODEL serem configurados."}
      </div>

      {state.status !== "idle" && (
        <div
          role={state.status === "error" ? "alert" : "status"}
          className="rounded-lg border border-neutral-700 bg-neutral-900 p-4 text-sm"
        >
          <p>{state.message}</p>
          {state.intermediatePath && (
            <p className="mt-2 font-mono text-xs text-neutral-400">
              Intermediário: {state.intermediatePath}
            </p>
          )}
        </div>
      )}

      <button
        type="submit"
        disabled={pending}
        className="rounded-lg bg-orange-500 px-5 py-3 font-semibold text-neutral-950 disabled:cursor-wait disabled:opacity-60"
      >
        {pending ? "Extraindo documentos..." : "Extrair e preparar importação"}
      </button>
    </form>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="space-y-2 text-sm font-medium text-neutral-200">
      <span>{label}</span>
      {children}
    </label>
  );
}
