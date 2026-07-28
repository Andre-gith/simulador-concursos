import Link from "next/link";

import { VisualReviewForm } from "@/components/admin/VisualReviewForm";
import { AdminShell } from "@/components/layout/AdminShell";
import { requireAdmin } from "@/lib/admin";
import { prisma } from "@/lib/prisma";
import { validateQuestionForPublication } from "@/lib/publication";

const contestIds = [
  "cms16omz00002vpvk847qx2re",
  "cms15wngw0002vpg0t03yq5tv",
];

export default async function BancoDoBrasilVisualReviewPage() {
  await requireAdmin();
  const questions = await prisma.question.findMany({
    where: {
      concursoId: { in: contestIds },
      status: "IN_REVIEW",
      requiresVisualReview: true,
      id: { not: "cms16on8y00ddvpvkbjcj4y5o" },
    },
    include: {
      concurso: true,
      subject: true,
      block: true,
      paper: true,
      topic: true,
      alternatives: { orderBy: { letter: "asc" } },
      visualAssets: { orderBy: [{ order: "asc" }, { sourcePage: "asc" }] },
    },
    orderBy: [{ concursoId: "asc" }, { number: "asc" }],
  });

  return (
    <AdminShell>
      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-sm font-bold uppercase tracking-widest text-emerald-800">
              Nota de Banca
            </p>
            <h1 className="mt-2 text-3xl font-black text-slate-950">
              Revisão visual — Banco do Brasil
            </h1>
            <p className="mt-2 text-slate-600">
              A abertura desta página não aprova nem publica conteúdo.
            </p>
          </div>
          <div className="flex gap-3">
            <Link href="/admin" className="rounded-xl border border-slate-300 px-4 py-2 font-bold">
              Voltar
            </Link>
            <Link
              href="/admin/revisao-visual/banco-do-brasil/preview"
              className="rounded-xl bg-emerald-800 px-4 py-2 font-bold text-white"
            >
              Pré-visualizar como candidato
            </Link>
          </div>
        </div>

        <div className="mt-8">
          <VisualReviewForm questionIds={questions.map((question) => question.id)}>
            <div className="space-y-6">
              {questions.map((question) => {
                const candidate = {
                  ...question,
                  textReviewed: true,
                  alternativesReviewed: true,
                  answerKeyReviewed: true,
                  visualReviewResolved: true,
                  annulmentStatus: "NOT_ANNULLED" as const,
                };
                const issues = validateQuestionForPublication(candidate);
                return (
                  <article key={question.id} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                    <div className="flex flex-wrap justify-between gap-3">
                      <div>
                        <label className="flex items-center gap-2 text-lg font-black text-slate-950">
                          <input
                            type="checkbox"
                            name="questionIds"
                            value={question.id}
                            data-visual-question="true"
                          />
                          Questão {question.number}
                        </label>
                        <p className="mt-1 text-sm text-slate-600">
                          {question.concurso.especialidade} · {question.subject.name} · {question.block?.name ?? "Sem bloco"}
                        </p>
                      </div>
                      <span className="h-fit rounded-full bg-amber-100 px-3 py-1 text-xs font-bold text-amber-900">
                        Revisão visual pendente
                      </span>
                    </div>
                    <p className="mt-5 whitespace-pre-line leading-7 text-slate-800">
                      {question.statement}
                    </p>
                    <div className="mt-5 grid gap-4 lg:grid-cols-2">
                      {question.visualAssets.map((asset) => (
                        <figure key={asset.id} className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={`/api/visual-assets/${asset.id}`}
                            alt={`Recurso visual da questão ${question.number}, página ${asset.sourcePage}`}
                            className="h-auto w-full rounded-lg"
                          />
                          <figcaption className="mt-2 text-xs text-slate-500">
                            Página {asset.sourcePage} · {asset.placement}
                          </figcaption>
                        </figure>
                      ))}
                    </div>
                    <ol className="mt-5 space-y-2">
                      {question.alternatives.map((alternative) => (
                        <li key={alternative.id} className="rounded-lg bg-slate-50 p-3 text-slate-700">
                          <strong>{alternative.letter}.</strong> {alternative.text}
                        </li>
                      ))}
                    </ol>
                    <div className="mt-5 rounded-xl border border-emerald-200 bg-emerald-50 p-4">
                      <p className="font-bold text-emerald-900">
                        Gabarito administrativo:{" "}
                        {question.alternatives.find((alternative) => alternative.isCorrect)?.letter ?? "ausente"}
                      </p>
                      <p className="mt-1 text-sm text-emerald-800">
                        Fonte: {question.sourceUrl ?? question.paper?.provaUrl ?? "ausente"} · página {question.sourcePage ?? "ausente"}
                      </p>
                    </div>
                    {issues.length > 0 && (
                      <ul className="mt-4 rounded-xl bg-red-50 p-4 text-sm text-red-700">
                        {issues.map((issue) => <li key={issue}>{issue}</li>)}
                      </ul>
                    )}
                    <div className="mt-4 flex gap-4 text-sm font-bold">
                      <Link href={`/admin/questoes/${question.id}`} className="text-emerald-800">
                        Abrir questão
                      </Link>
                      <span className="text-slate-500">Manter pendente: não selecione</span>
                      <Link href={`/admin/questoes/${question.id}`} className="text-red-700">
                        Arquivar na revisão individual
                      </Link>
                    </div>
                  </article>
                );
              })}
              {questions.length === 0 && (
                <div className="rounded-2xl bg-white p-8 text-center text-slate-600">
                  Nenhuma questão visual ativa aguarda revisão.
                </div>
              )}
            </div>
          </VisualReviewForm>
        </div>
      </main>
    </AdminShell>
  );
}
