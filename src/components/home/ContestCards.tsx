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
    <article className="flex h-full flex-col rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition hover:-translate-y-0.5 hover:border-emerald-700 hover:shadow-md">
      <div className="mb-5 flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-semibold uppercase tracking-wide text-emerald-800">
            {contest.institution}
          </p>
          <h3 className="mt-2 text-xl font-bold leading-snug text-slate-950">
            {contestTitle(contest)}
          </h3>
        </div>
        <span className="shrink-0 rounded-full bg-emerald-50 px-3 py-1 text-xs font-bold uppercase tracking-wide text-emerald-800">
          Disponível
        </span>
      </div>

      <dl className="grid grid-cols-2 gap-x-4 gap-y-4 border-y border-slate-100 py-5 text-sm">
        <div>
          <dt className="text-slate-500">Banca</dt>
          <dd className="mt-1 font-semibold text-slate-900">{contest.board}</dd>
        </div>
        <div>
          <dt className="text-slate-500">Edição</dt>
          <dd className="mt-1 font-semibold text-slate-900">
            {editionLabel(contest)}
          </dd>
        </div>
        <div>
          <dt className="text-slate-500">Nível</dt>
          <dd className="mt-1 font-semibold text-slate-900">
            {describeLevel(contest.level)}
          </dd>
        </div>
        <div>
          <dt className="text-slate-500">Questões publicadas</dt>
          <dd className="mt-1 font-semibold text-slate-900">
            {contest.publishedQuestionCount}
          </dd>
        </div>
        <div className="col-span-2">
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
    <article className="h-full rounded-2xl border border-slate-200 bg-slate-50 p-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-semibold uppercase tracking-wide text-slate-600">
            {contest.institution}
          </p>
          <h3 className="mt-2 text-lg font-bold leading-snug text-slate-900">
            {contestTitle(contest)}
          </h3>
        </div>
        <span className="shrink-0 rounded-full bg-amber-100 px-3 py-1 text-xs font-bold text-amber-900">
          Em preparação
        </span>
      </div>
      <p className="mt-4 text-sm text-slate-600">
        {[contest.board, editionLabel(contest)].filter(Boolean).join(" · ")}
      </p>
      <p className="mt-5 border-t border-slate-200 pt-5 text-sm font-medium text-slate-700">
        Prova e gabarito em revisão
      </p>
    </article>
  );
}
