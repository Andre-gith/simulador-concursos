import Link from "next/link";
import { notFound } from "next/navigation";

import { prisma } from "@/lib/prisma";
import StartSimuladoForm from "./StartSimuladoForm";

type ConcursoPageProps = {
  params: Promise<{
    id: string;
  }>;
};

function formatPoints(value: number) {
  return new Intl.NumberFormat("pt-BR", {
    maximumFractionDigits: 2,
  }).format(value);
}

export default async function ConcursoPage({
  params,
}: ConcursoPageProps) {
  const { id } = await params;

  const concurso = await prisma.concurso.findFirst({
    where: {
      id,
      status: "PUBLISHED",
    },
    select: {
      id: true,
      orgao: true,
      cargo: true,
      ano: true,
      editalUrl: true,
      banca: {
        select: {
          name: true,
        },
      },
      scoringRule: {
        select: {
          type: true,
          pointsCorrect: true,
          pointsWrong: true,
          pointsBlank: true,
        },
      },
      questions: {
        where: {
          status: "PUBLISHED",
        },
        select: {
          subject: {
            select: {
              id: true,
              name: true,
            },
          },
        },
      },
    },
  });

  if (!concurso) {
    notFound();
  }

  const subjectMap = new Map<
    string,
    {
      id: string;
      name: string;
      questionCount: number;
    }
  >();

  for (const question of concurso.questions) {
    const subject = question.subject;
    const existingSubject = subjectMap.get(subject.id);

    if (existingSubject) {
      existingSubject.questionCount += 1;
      continue;
    }

    subjectMap.set(subject.id, {
      id: subject.id,
      name: subject.name,
      questionCount: 1,
    });
  }

  const subjects = Array.from(subjectMap.values()).sort((a, b) =>
    a.name.localeCompare(b.name, "pt-BR"),
  );

  const totalQuestions = concurso.questions.length;

  const scoringDescription =
    concurso.scoringRule?.type === "CE_PENALTY"
      ? `Cada acerto vale ${formatPoints(
          concurso.scoringRule.pointsCorrect,
        )} ponto. Cada erro vale ${formatPoints(
          concurso.scoringRule.pointsWrong,
        )} ponto. Questões em branco não descontam.`
      : concurso.scoringRule?.type === "MC_NEGATIVE"
        ? `Questões erradas possuem penalidade de ${formatPoints(
            concurso.scoringRule.pointsWrong,
          )} ponto.`
        : concurso.scoringRule
          ? `Cada acerto vale ${formatPoints(
              concurso.scoringRule.pointsCorrect,
            )} ponto. Questões erradas ou em branco não pontuam.`
          : "A regra de pontuação deste concurso ainda não foi configurada.";

  return (
    <main className="mx-auto min-h-screen max-w-4xl px-4 py-10">
      <Link
        href="/"
        className="mb-8 inline-flex text-sm text-neutral-400 transition-colors hover:text-orange-400"
      >
        ← Voltar para os concursos
      </Link>

      <section className="rounded-2xl border border-neutral-800 bg-neutral-950 p-6 sm:p-8">
        <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <span className="mb-3 inline-flex rounded-full border border-orange-500/30 bg-orange-500/10 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-orange-400">
              {concurso.banca.name}
            </span>

            <h1 className="text-2xl font-semibold text-neutral-100 sm:text-3xl">
              {concurso.orgao}
            </h1>

            <p className="mt-2 text-lg text-neutral-300">
              {concurso.cargo}
            </p>

            <p className="mt-1 text-sm text-neutral-500">
              Concurso de {concurso.ano}
            </p>
          </div>

          <div className="rounded-xl border border-neutral-800 bg-neutral-900 px-5 py-4 text-center">
            <strong className="block text-2xl text-neutral-100">
              {totalQuestions}
            </strong>
            <span className="text-xs uppercase tracking-wide text-neutral-500">
              questões disponíveis
            </span>
          </div>
        </div>

        <div className="rounded-xl border border-neutral-800 bg-neutral-900/60 p-4">
          <h2 className="font-medium text-neutral-200">
            Regra de pontuação
          </h2>

          <p className="mt-2 text-sm leading-6 text-neutral-400">
            {scoringDescription}
          </p>
        </div>

        {concurso.editalUrl && (
          <a
            href={concurso.editalUrl}
            target="_blank"
            rel="noreferrer"
            className="mt-4 inline-flex text-sm text-orange-400 hover:text-orange-300"
          >
            Consultar edital oficial
          </a>
        )}
      </section>

      <section className="mt-8">
        {!concurso.scoringRule ? (
          <div className="rounded-xl border border-red-900 bg-red-950/40 p-5 text-sm text-red-300">
            Este concurso não pode gerar simulados porque ainda não possui
            regra de pontuação.
          </div>
        ) : totalQuestions === 0 ? (
          <div className="rounded-xl border border-neutral-800 bg-neutral-950 p-5 text-sm text-neutral-400">
            Este concurso ainda não possui questões publicadas.
          </div>
        ) : (
          <StartSimuladoForm
            concursoId={concurso.id}
            totalQuestions={totalQuestions}
            subjects={subjects}
          />
        )}
      </section>
    </main>
  );
}
