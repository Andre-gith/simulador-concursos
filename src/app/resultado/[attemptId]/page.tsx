import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { prisma } from "@/lib/prisma";
import { calculateResultMetrics } from "@/lib/resultMetrics";
import { auth } from "@/auth";

export const dynamic = "force-dynamic";

type ResultadoPageProps = {
  params: Promise<{ attemptId: string }>;
};

function formatNumber(value: number) {
  return new Intl.NumberFormat("pt-BR", {
    maximumFractionDigits: 2,
  }).format(value);
}

function formatPercentage(value: number) {
  return `${formatNumber(value)}%`;
}

function pluralize(value: number, singular: string, plural: string) {
  return `${formatNumber(value)} ${value === 1 ? singular : plural}`;
}

function formatDuration(startedAt: Date, finishedAt: Date) {
  const totalMinutes = Math.max(
    0,
    Math.floor((finishedAt.getTime() - startedAt.getTime()) / 60_000),
  );
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  if (hours === 0) {
    return pluralize(minutes, "minuto", "minutos");
  }

  const hoursLabel = pluralize(hours, "hora", "horas");
  return minutes === 0
    ? hoursLabel
    : `${hoursLabel} e ${pluralize(minutes, "minuto", "minutos")}`;
}

export default async function ResultadoPage({
  params,
}: ResultadoPageProps) {
  const { attemptId } = await params;
  const session = await auth();
  if (!session?.user.id) redirect("/login");
  const attempt = await prisma.attempt.findUnique({
    where: { id: attemptId },
    select: {
      id: true,
      userId: true,
      startedAt: true,
      finishedAt: true,
      totalScore: true,
      finishReason: true,
      answers: {
        select: {
          questionId: true,
          userAnswer: true,
          isCorrect: true,
          pointsEarned: true,
        },
      },
      simulatedExam: {
        select: {
          title: true,
          concurso: {
            select: {
              id: true,
              ano: true,
              banca: { select: { name: true } },
              scoringRule: {
                select: {
                  type: true,
                  pointsCorrect: true,
                },
              },
            },
          },
          questions: {
            orderBy: { order: "asc" },
            select: {
              order: true,
              question: {
                select: {
                  id: true,
                  number: true,
                  type: true,
                  statement: true,
                  ceAnswer: true,
                  weight: true,
                  subject: { select: { name: true } },
                  topic: { select: { name: true } },
                  block: {
                    select: {
                      id: true,
                      name: true,
                      order: true,
                      minimumScore: true,
                      minimumCorrect: true,
                    },
                  },
                  alternatives: {
                    orderBy: { letter: "asc" },
                    select: {
                      letter: true,
                      text: true,
                      isCorrect: true,
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
  });

  if (!attempt) notFound();
  if (attempt.userId !== session.user.id) notFound();
  if (!attempt.finishedAt) redirect(`/simulado/${attempt.id}`);

  const concurso = attempt.simulatedExam.concurso;
  const pointsCorrect = concurso?.scoringRule?.pointsCorrect ?? 0;
  const totalScore = attempt.totalScore ?? 0;
  const metrics = calculateResultMetrics(
    attempt.simulatedExam.questions.map(({ question }) => ({
      id: question.id,
      weight: question.weight,
      subject: question.subject.name,
      block: question.block,
    })),
    attempt.answers,
    pointsCorrect,
    totalScore,
  );
  const answerMap = new Map(
    attempt.answers.map((answer) => [answer.questionId, answer]),
  );

  return (
    <main className="mx-auto min-h-screen max-w-5xl px-4 py-10">
      <section className="rounded-2xl border border-neutral-800 bg-neutral-950 p-6 sm:p-8">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-orange-400">
              Resultado do simulado
            </p>
            <h1 className="mt-2 text-2xl font-semibold text-neutral-100">
              {attempt.simulatedExam.title}
            </h1>
            {concurso && (
              <p className="mt-2 text-sm text-neutral-400">
                {concurso.banca.name} · {concurso.ano}
              </p>
            )}
          </div>
          <div className="rounded-2xl border border-orange-500/30 bg-orange-500/10 px-7 py-5 text-center">
            <strong className="block text-4xl text-orange-400">
              {formatNumber(totalScore)}
            </strong>
            <span className="mt-1 block text-xs uppercase tracking-wide text-neutral-400">
              Nota líquida
            </span>
          </div>
        </div>

        <div className="mt-7 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <ResultCard
            label="Pontuação máxima"
            value={pluralize(
              metrics.overall.maximumScore,
              "ponto",
              "pontos",
            )}
          />
          <ResultCard
            label="% da pontuação máxima"
            value={formatPercentage(metrics.overall.scorePercentage)}
          />
          <ResultCard
            label="Taxa de acerto"
            value={formatPercentage(metrics.overall.accuracyRate)}
          />
          <ResultCard
            label="Acertos"
            value={pluralize(metrics.overall.correct, "acerto", "acertos")}
          />
          <ResultCard
            label="Erros"
            value={pluralize(metrics.overall.wrong, "erro", "erros")}
          />
          <ResultCard
            label="Em branco"
            value={pluralize(
              metrics.overall.blank,
              "questão",
              "questões",
            )}
          />
          <ResultCard
            label="Total"
            value={pluralize(
              metrics.overall.total,
              "questão",
              "questões",
            )}
          />
          <ResultCard
            label="Tempo"
            value={formatDuration(attempt.startedAt, attempt.finishedAt)}
          />
        </div>

        <p className="mt-6 rounded-xl border border-neutral-800 bg-neutral-900/60 p-4 text-sm leading-6 text-neutral-400">
          A taxa de acerto considera questões corretas sobre o total. O
          percentual da pontuação máxima compara a nota líquida com o máximo
          ponderado. Penalidades podem reduzir a nota líquida sem alterar a
          taxa de acerto.
        </p>
        <p className="mt-3 text-sm text-neutral-500">
          Finalização:{" "}
          {attempt.finishReason === "TIME_EXPIRED"
            ? "tempo esgotado"
            : "manual"}
        </p>

        <div className="mt-7 flex flex-col gap-3 sm:flex-row">
          <Link href="/" className="rounded-xl border border-neutral-700 px-5 py-3 text-center text-sm text-neutral-300">
            Voltar ao início
          </Link>
          {concurso && (
            <Link href={`/concursos/${concurso.id}`} className="rounded-xl bg-orange-500 px-5 py-3 text-center text-sm font-semibold text-neutral-950">
              Fazer novo simulado
            </Link>
          )}
        </div>
      </section>

      <section className="mt-8">
        <h2 className="text-xl font-semibold">Desempenho por matéria</h2>
        <div className="mt-4 overflow-hidden rounded-2xl border border-neutral-800">
          {metrics.subjects.map((subject) => (
            <article key={subject.id} className="border-b border-neutral-800 bg-neutral-950 p-5 last:border-0">
              <h3 className="font-medium">{subject.name}</h3>
              <div className="mt-3 grid gap-2 text-sm text-neutral-400 sm:grid-cols-4">
                <Metric label="Questões" value={formatNumber(subject.total)} />
                <Metric label="Acertos" value={formatNumber(subject.correct)} />
                <Metric label="Erros" value={formatNumber(subject.wrong)} />
                <Metric label="Em branco" value={formatNumber(subject.blank)} />
                <Metric label="Pontos líquidos" value={formatNumber(subject.netScore)} />
                <Metric label="Pontuação máxima" value={formatNumber(subject.maximumScore)} />
                <Metric label="Taxa de acerto" value={formatPercentage(subject.accuracyRate)} />
              </div>
            </article>
          ))}
        </div>
      </section>

      {metrics.blocks.length > 0 && (
        <section className="mt-8">
          <h2 className="text-xl font-semibold">Desempenho por bloco</h2>
          <p className="mt-2 text-sm text-neutral-500">
            O atendimento destes mínimos não representa aprovação definitiva
            enquanto todas as regras eliminatórias do edital não estiverem
            configuradas.
          </p>
          <div className="mt-4 space-y-4">
            {metrics.blocks.map((block) => (
              <article key={block.id} className="rounded-2xl border border-neutral-800 bg-neutral-950 p-5">
                <div className="flex flex-col gap-3 sm:flex-row sm:justify-between">
                  <h3 className="font-medium">{block.name}</h3>
                  <span className={
                    !block.hasConfiguredMinimums
                      ? "text-neutral-500"
                      : block.meetsConfiguredMinimums
                        ? "text-green-400"
                        : "text-red-400"
                  }>
                    {!block.hasConfiguredMinimums
                      ? "Sem mínimos configurados"
                      : block.meetsConfiguredMinimums
                        ? "Mínimos configurados atingidos"
                        : "Mínimo configurado não atingido"}
                  </span>
                </div>
                <div className="mt-3 grid gap-2 text-sm text-neutral-400 sm:grid-cols-3">
                  <Metric label="Questões" value={formatNumber(block.total)} />
                  <Metric label="Nota obtida" value={formatNumber(block.netScore)} />
                  <Metric label="Nota máxima" value={formatNumber(block.maximumScore)} />
                  <Metric label="Mínimo exigido" value={block.minimumScore === null ? "Não configurado" : formatNumber(block.minimumScore)} />
                  <Metric label="Mínimo de acertos" value={block.minimumCorrect === null ? "Não configurado" : pluralize(block.minimumCorrect, "acerto", "acertos")} />
                </div>
              </article>
            ))}
          </div>
        </section>
      )}

      <section className="mt-8">
        <h2 className="text-xl font-semibold">Correção detalhada</h2>
        <div className="mt-4 space-y-4">
          {attempt.simulatedExam.questions.map((item, index) => {
            const question = item.question;
            const answer = answerMap.get(question.id);
            const userAnswer = answer?.userAnswer ?? "";
            const correctAlternative = question.alternatives.find(
              (alternative) => alternative.isCorrect,
            );
            const correctAnswer =
              question.type === "CE"
                ? question.ceAnswer
                  ? "Certo"
                  : "Errado"
                : correctAlternative
                  ? `${correctAlternative.letter} — ${correctAlternative.text}`
                  : "Gabarito não encontrado";
            const status =
              userAnswer === ""
                ? "Em branco"
                : answer?.isCorrect
                  ? "Correta"
                  : "Incorreta";

            return (
              <article key={question.id} className="rounded-2xl border border-neutral-800 bg-neutral-950 p-6">
                <div className="flex flex-wrap justify-between gap-3">
                  <div>
                    <strong className="text-orange-400">
                      Questão {question.number ?? index + 1}
                    </strong>
                    <p className="mt-1 text-xs text-neutral-500">
                      {question.subject.name}
                      {question.topic ? ` · ${question.topic.name}` : ""}
                      {question.block ? ` · ${question.block.name}` : ""}
                    </p>
                  </div>
                  <span className="text-sm font-semibold">{status}</span>
                </div>
                <p className="mt-5 whitespace-pre-line leading-7 text-neutral-200">
                  {question.statement}
                </p>
                <div className="mt-5 grid gap-3 rounded-xl bg-neutral-900 p-4 text-sm sm:grid-cols-4">
                  <Metric label="Sua resposta" value={userAnswer === "" ? "Em branco" : question.type === "CE" ? userAnswer === "C" ? "Certo" : "Errado" : userAnswer} />
                  <Metric label="Gabarito" value={correctAnswer} />
                  <Metric label="Peso" value={formatNumber(question.weight)} />
                  <Metric label="Pontos obtidos" value={formatNumber(answer?.pointsEarned ?? 0)} />
                </div>
              </article>
            );
          })}
        </div>
      </section>
    </main>
  );
}

function ResultCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-neutral-800 bg-neutral-900 p-4">
      <strong className="block text-xl">{value}</strong>
      <span className="mt-1 block text-xs text-neutral-500">{label}</span>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <span className="block text-xs text-neutral-500">{label}</span>
      <strong className="mt-1 block text-neutral-200">{value}</strong>
    </div>
  );
}
