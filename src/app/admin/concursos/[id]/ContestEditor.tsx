"use client";

import { useActionState } from "react";

import {
  setContestStatus,
  updateContestMetadata,
  type AdminActionState,
} from "../../actions";
import { ConfirmButton } from "@/components/admin/ConfirmButton";

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
  publicationIssues: string[];
};

export function ContestEditor({
  contest,
  banks,
  publicationIssues,
}: ContestEditorProps) {
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
          className="rounded-xl bg-amber-400 px-5 py-3 font-bold text-slate-950 hover:bg-amber-300 disabled:opacity-60"
        >
          {metadataPending ? "Salvando..." : "Salvar metadados"}
        </button>
      </form>

      <aside className="h-fit rounded-2xl border border-neutral-800 p-5">
        <h2 className="text-lg font-semibold">Publicação</h2>
        <p className="mt-2 text-sm text-slate-600">
          Atual: <strong className="text-slate-950">{contest.status}</strong>
        </p>
        {publicationIssues.length > 0 ? (
          <ul className="mt-4 list-disc space-y-1 rounded-xl bg-amber-50 p-4 pl-8 text-xs text-amber-900">
            {publicationIssues.map((issue) => (
              <li key={issue}>{issue}</li>
            ))}
          </ul>
        ) : (
          <p className="mt-4 rounded-xl bg-emerald-50 p-3 text-sm font-semibold text-emerald-800">
            Concurso pronto para publicação.
          </p>
        )}
        <div className="mt-5 grid gap-3">
          {contest.status === "IN_REVIEW" && (
            <form action={statusAction}>
              <input type="hidden" name="id" value={contest.id} />
              <input type="hidden" name="status" value="PUBLISHED" />
              <ConfirmButton
                disabled={statusPending || publicationIssues.length > 0}
                message="Você está prestes a disponibilizar este concurso para os usuários. Após a publicação, será possível iniciar simulados."
                className="w-full rounded-xl bg-emerald-700 px-4 py-3 font-semibold text-white disabled:cursor-not-allowed disabled:opacity-40"
              >
                Publicar concurso
              </ConfirmButton>
            </form>
          )}
          {contest.status === "PUBLISHED" && (
            <form action={statusAction}>
              <input type="hidden" name="id" value={contest.id} />
              <input type="hidden" name="status" value="IN_REVIEW" />
              <ConfirmButton
                disabled={statusPending}
                message="Retornar este concurso para revisão? Novas tentativas serão bloqueadas, mas tentativas e resultados existentes serão preservados."
                className="w-full rounded-xl border border-amber-500 bg-white px-4 py-3 font-semibold text-amber-900"
              >
                Retornar concurso para revisão
              </ConfirmButton>
            </form>
          )}
          {contest.status !== "ARCHIVED" && contest.status !== "PUBLISHED" && (
            <form action={statusAction}>
              <input type="hidden" name="id" value={contest.id} />
              <input type="hidden" name="status" value="ARCHIVED" />
              <ConfirmButton
                disabled={statusPending}
                message="Arquivar este concurso sem excluir seus dados?"
                className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 font-semibold text-slate-700"
              >
                Arquivar concurso
              </ConfirmButton>
            </form>
          )}
        </div>
        <ActionMessage state={statusState} />
        <p className="mt-5 rounded-xl bg-amber-50 p-3 text-xs leading-5 text-amber-900">
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
      <span className="font-medium text-slate-700">{label}</span>
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
          ? "mt-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700"
          : "mt-4 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800"
      }
    >
      {state.message}
    </p>
  );
}
