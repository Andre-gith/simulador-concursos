import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";

import { AdminShell } from "@/components/layout/AdminShell";
import { requireAdmin } from "@/lib/admin";
import { prisma } from "@/lib/prisma";
import { loadImportVisualAsset } from "@/lib/visualAssets";
import { adminCandidatePreviewSelect } from "@/lib/adminPreview";

export const dynamic = "force-dynamic";

export default async function ContestCandidatePreviewPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireAdmin();
  const { id } = await params;
  const contest = await prisma.concurso.findUnique({
    where: { id },
    select: adminCandidatePreviewSelect,
  });
  if (!contest) notFound();

  const visualAssets = new Map<string, string | null>(
    await Promise.all(
      contest.questions.flatMap((question) =>
        question.alternatives.map(
          async (alternative) =>
            [
              alternative.id,
              await loadImportVisualAsset(alternative.visualAssetPath),
            ] as const,
        ),
      ),
    ),
  );

  return (
    <AdminShell>
      <main className="mx-auto max-w-6xl px-4 py-10 sm:px-6 lg:px-8">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-sm font-bold uppercase tracking-[0.18em] text-emerald-800">
              Prévia administrativa
            </p>
            <h1 className="mt-2 text-3xl font-black text-slate-950">
              {contest.cargo}
              {contest.especialidade ? ` — ${contest.especialidade}` : ""}
            </h1>
            <p className="mt-2 text-sm text-slate-600">
              {contest.orgao} · {contest.banca.name}
            </p>
          </div>
          <Link
            href={`/concursos/${contest.id}`}
            className="rounded-xl border border-emerald-800 px-4 py-3 text-sm font-bold text-emerald-900"
          >
            Voltar ao concurso
          </Link>
        </div>

        <section
          role="alert"
          className="mt-6 rounded-2xl border border-amber-300 bg-amber-50 p-5"
        >
          <strong className="text-amber-950">
            Conteúdo não publicado — visualização exclusiva de ADMIN.
          </strong>
          <p className="mt-2 text-sm leading-6 text-amber-900">
            Esta prévia não cria tentativa, não salva respostas, não altera
            histórico e não mostra o gabarito. Status atual: {contest.status}.
          </p>
        </section>

        <div className="mt-8 space-y-6">
          {contest.questions.map((question, index) => (
            <article
              key={question.id}
              className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="font-bold text-emerald-800">
                    Questão {question.number ?? index + 1}
                  </p>
                  <p className="mt-1 text-xs text-slate-500">
                    {question.subject.name}
                    {question.topic ? ` · ${question.topic.name}` : ""}
                    {question.block ? ` · ${question.block.name}` : ""}
                  </p>
                </div>
                <div className="text-right text-xs text-slate-500">
                  <p>{question.paper?.code ?? "Sem caderno"}</p>
                  <p>Página {question.sourcePage ?? "não informada"}</p>
                </div>
              </div>

              {question.requiresVisualReview && (
                <span className="mt-4 inline-flex rounded-full bg-amber-100 px-3 py-1 text-xs font-bold text-amber-900">
                  Revisão visual pendente
                </span>
              )}

              <p className="mt-6 whitespace-pre-line leading-7 text-slate-800">
                {question.statement}
              </p>

              <div className="mt-6 space-y-3">
                {question.type === "CE" ? (
                  <>
                    <PreviewAlternative letter="C" text="Certo" />
                    <PreviewAlternative letter="E" text="Errado" />
                  </>
                ) : (
                  question.alternatives.map((alternative) => (
                    <div
                      key={alternative.id}
                      className="rounded-xl border border-slate-200 bg-slate-50 p-4"
                    >
                      <div className="flex items-start gap-3">
                        <span className="inline-flex min-w-8 justify-center rounded-md border border-slate-300 bg-white px-2 py-1 text-xs font-bold text-slate-700">
                          {alternative.letter}
                        </span>
                        <span className="leading-6 text-slate-700">
                          {alternative.text}
                        </span>
                      </div>
                      {alternative.isVisual && (
                        <div className="mt-4">
                          <p className="mb-2 text-xs font-semibold text-amber-900">
                            Recurso visual · página{" "}
                            {alternative.sourcePage ?? "não informada"}
                          </p>
                          {visualAssets.get(alternative.id) ? (
                            <Image
                              src={visualAssets.get(alternative.id) ?? ""}
                              alt={`Alternativa visual ${alternative.letter}`}
                              width={900}
                              height={500}
                              unoptimized
                              className="h-auto max-h-[32rem] w-auto max-w-full rounded bg-white object-contain"
                            />
                          ) : (
                            <p className="text-sm text-red-700">
                              Recurso visual indisponível.
                            </p>
                          )}
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>
            </article>
          ))}
        </div>
      </main>
    </AdminShell>
  );
}

function PreviewAlternative({
  letter,
  text,
}: {
  letter: string;
  text: string;
}) {
  return (
    <div className="flex items-start gap-3 rounded-xl border border-slate-200 bg-slate-50 p-4">
      <span className="inline-flex min-w-8 justify-center rounded-md border border-slate-300 bg-white px-2 py-1 text-xs font-bold text-slate-700">
        {letter}
      </span>
      <span className="leading-6 text-slate-700">{text}</span>
    </div>
  );
}
