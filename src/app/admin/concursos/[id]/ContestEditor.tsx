"use client";

import { useActionState } from "react";

import {
  setContestStatus,
  updateContestMetadata,
  type AdminActionState,
} from "../../actions";

const initialState: AdminActionState = { status: "idle", message: "" };

type ContestEditorProps = {
  contest: {
    id: string;
    bancaId: string;
    orgao: string;
    cargo: string;
    especialidade: string | null;
    edicao: string | null;
    ano: number;
    nivel: string | null;
    officialPageUrl: string | null;
    editalUrl: string | null;
    status: string;
  };
  banks: Array<{ id: string; name: string }>;
};

export function ContestEditor({ contest, banks }: ContestEditorProps) {
  const [metadataState, metadataAction, metadataPending] = useActionState(
    updateContestMetadata,
    initialState,
  );
  const [statusState, statusAction, statusPending] = useActionState(
    setContestStatus,
    initialState,
  );

  return (
    <div className="mt-8 grid gap-6 lg:grid-cols-[1fr_360px]">
      <form
        action={metadataAction}
        className="space-y-5 rounded-2xl border border-neutral-800 p-5"
      >
        <input type="hidden" name="id" value={contest.id} />
        <h2 className="text-lg font-semibold">Metadados</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Instituição">
            <input
              name="orgao"
              required
              defaultValue={contest.orgao}
              className="input"
            />
          </Field>
          <Field label="Banca">
            <select
              name="bancaId"
              required
              defaultValue={contest.bancaId}
              className="input"
            >
              {banks.map((bank) => (
                <option key={bank.id} value={bank.id}>
                  {bank.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Cargo">
            <input
              name="cargo"
              required
              defaultValue={contest.cargo}
              className="input"
            />
          </Field>
          <Field label="Especialidade">
            <input
              name="especialidade"
              defaultValue={contest.especialidade ?? ""}
              className="input"
            />
          </Field>
          <Field label="Edição">
            <input
              name="edicao"
              defaultValue={contest.edicao ?? ""}
              className="input"
            />
          </Field>
          <Field label="Ano">
            <input
              name="ano"
              type="number"
              min="1900"
              max="2200"
              required
              defaultValue={contest.ano}
              className="input"
            />
          </Field>
          <Field label="Nível">
            <select
              name="nivel"
              defaultValue={contest.nivel ?? ""}
              className="input"
            >
              <option value="">Não informado</option>
              <option value="FUNDAMENTAL">Fundamental</option>
              <option value="MEDIO">Médio</option>
              <option value="TECNICO">Técnico</option>
              <option value="SUPERIOR">Superior</option>
            </select>
          </Field>
          <div />
          <Field label="Página oficial">
            <input
              name="officialPageUrl"
              type="url"
              defaultValue={contest.officialPageUrl ?? ""}
              className="input"
            />
          </Field>
          <Field label="Edital">
            <input
              name="editalUrl"
              type="url"
              defaultValue={contest.editalUrl ?? ""}
              className="input"
            />
          </Field>
        </div>
        <ActionMessage state={metadataState} />
        <button
          disabled={metadataPending}
          className="rounded-lg bg-orange-500 px-5 py-3 font-semibold text-neutral-950 disabled:opacity-60"
        >
          {metadataPending ? "Salvando..." : "Salvar metadados"}
        </button>
      </form>

      <aside className="h-fit rounded-2xl border border-neutral-800 p-5">
        <h2 className="text-lg font-semibold">Status editorial</h2>
        <p className="mt-2 text-sm text-neutral-500">
          Atual: <strong className="text-neutral-200">{contest.status}</strong>
        </p>
        <div className="mt-5 grid gap-2">
          {["DRAFT", "IN_REVIEW", "PUBLISHED", "ARCHIVED"].map((status) => (
            <form action={statusAction} key={status}>
              <input type="hidden" name="id" value={contest.id} />
              <input type="hidden" name="status" value={status} />
              <button
                disabled={statusPending}
                className="w-full rounded-lg border border-neutral-700 px-4 py-3 text-left transition hover:border-orange-500 disabled:opacity-60"
              >
                {status}
              </button>
            </form>
          ))}
        </div>
        <ActionMessage state={statusState} />
        <p className="mt-5 text-xs leading-5 text-neutral-500">
          A publicação é recusada sem regra de pontuação, questão publicada,
          gabarito válido, peso positivo, fonte e página.
        </p>
      </aside>
    </div>
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
    <label className="space-y-2 text-sm">
      <span className="font-medium text-neutral-300">{label}</span>
      {children}
    </label>
  );
}

function ActionMessage({ state }: { state: AdminActionState }) {
  if (state.status === "idle") return null;
  return (
    <p
      role={state.status === "error" ? "alert" : "status"}
      className={
        state.status === "error"
          ? "mt-4 rounded-lg bg-red-950 p-3 text-sm text-red-200"
          : "mt-4 rounded-lg bg-emerald-950 p-3 text-sm text-emerald-200"
      }
    >
      {state.message}
    </p>
  );
}
