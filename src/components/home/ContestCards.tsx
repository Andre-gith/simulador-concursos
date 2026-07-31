import Link from "next/link";

import {
  describeLevel,
  describeScoringRule,
  type CatalogContest,
} from "@/lib/catalog";

function contestTitle(contest: CatalogContest) {
  return contest.specialty
    ? `${contest.position} — ${contest.specialty}`
    : contest.position;
}

function editionLabel(contest: CatalogContest) {
  if (contest.edition && contest.year) {
    return `${contest.edition} · ${contest.year}`;
  }
  return contest.edition ?? (contest.year ? String(contest.year) : null);
}

export function AvailableContestCard({
  contest,
}: {
  contest: CatalogContest;
}) {
  return (
    <article className="flex h-full min-w-0 max-w-full flex-col rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition hover:-translate-y-0.5 hover:border-emerald-700 hover:shadow-md">
      <div className="mb-5 flex min-w-0 items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="break-words text-sm font-semibold uppercase tracking-wide text-emerald-800 [overflow-wrap:anywhere]">
            {contest.institution}
          </p>
          <h3 className="mt-2 break-words text-xl font-bold leading-snug text-slate-950 [overflow-wrap:anywhere]">
            {contestTitle(contest)}
          </h3>
        </div>
        <span className="shrink-0 rounded-full bg-emerald-50 px-3 py-1 text-xs font-bold uppercase tracking-wide text-emerald-800">
          Disponível
        </span>
      </div>

      <dl className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)] gap-x-4 gap-y-4 border-y border-slate-100 py-5 text-sm">
        <div className="min-w-0">
          <dt className="text-slate-500">Banca</dt>
          <dd className="mt-1 break-words font-semibold text-slate-900 [overflow-wrap:anywhere]">{contest.board}</dd>
        </div>
        <div className="min-w-0">
          <dt className="text-slate-500">Edição</dt>
          <dd className="mt-1 break-words font-semibold text-slate-900 [overflow-wrap:anywhere]">
            {editionLabel(contest)}
          </dd>
        </div>
        <div className="min-w-0">
          <dt className="text-slate-500">Nível</dt>
          <dd className="mt-1 font-semibold text-slate-900">
            {describeLevel(contest.level)}
          </dd>
        </div>
        <div className="min-w-0">
          <dt className="text-slate-500">Questões publicadas</dt>
          <dd className="mt-1 font-semibold text-slate-900">
            {contest.publishedQuestionCount}
          </dd>
        </div>
        <div className="col-span-2 min-w-0">
          <dt className="text-slate-500">Duração</dt>
          <dd className="mt-1 font-semibold text-slate-900">
            Configurável ao iniciar
          </dd>
        </div>
      </dl>

      <div className="mt-5 space-y-3 text-sm">
        <p>
          <span className="font-semibold text-slate-900">Regra: </span>
          <span className="text-slate-600">
            {describeScoringRule(contest)}
          </span>
        </p>
        <p>
          <span className="font-semibold text-slate-900">Matérias: </span>
          <span className="text-slate-600">
            {contest.subjects.join(", ")}
          </span>
        </p>
      </div>

      <Link
        href={`/concursos/${contest.id}`}
        className="mt-6 inline-flex min-h-11 items-center justify-center rounded-xl bg-amber-400 px-5 py-3 font-bold text-slate-950 transition hover:bg-amber-300 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-800"
      >
        Abrir concurso
      </Link>
    </article>
  );
}

export function PreparingContestCard({
  contest,
}: {
  contest: CatalogContest;
}) {
  return (
    <article className="h-full min-w-0 max-w-full rounded-2xl border border-slate-200 bg-slate-50 p-6">
      <div className="flex min-w-0 items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="break-words text-sm font-semibold uppercase tracking-wide text-slate-600 [overflow-wrap:anywhere]">
            {contest.institution}
          </p>
          <h3 className="mt-2 break-words text-lg font-bold leading-snug text-slate-900 [overflow-wrap:anywhere]">
            {contestTitle(contest)}
          </h3>
        </div>
        <span className="shrink-0 rounded-full bg-amber-100 px-3 py-1 text-xs font-bold text-amber-900">
          Em preparação
        </span>
      </div>
      <p className="mt-4 break-words text-sm text-slate-600 [overflow-wrap:anywhere]">
        {[contest.board, editionLabel(contest)].filter(Boolean).join(" · ")}
      </p>
      <p className="mt-5 border-t border-slate-200 pt-5 text-sm font-medium text-slate-700">
        {contest.trustLevel?.startsWith("COMMUNITY")
          ? "Informação comunitária não confirmada oficialmente. Não há simulado disponível."
          : "Prova e gabarito em revisão"}
      </p>
    </article>
  );
}
