import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { prisma } from "@/lib/prisma";
import { calculateResultMetrics } from "@/lib/resultMetrics";
import { auth } from "@/auth";
import { AppShell } from "@/components/layout/AppShell";

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
    <AppShell isAuthenticated isAdmin={session.user.role === "ADMIN"}>
    <main className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-emerald-800">
              Resultado do simulado
            </p>
            <h1 className="mt-2 text-3xl font-black text-slate-950">
              {attempt.simulatedExam.title}
            </h1>
            {concurso && (
              <p className="mt-2 text-sm text-slate-600">
                {concurso.banca.name} · {concurso.ano}
              </p>
            )}
          </div>
          <div className="rounded-2xl border border-amber-300 bg-amber-50 px-7 py-5 text-center">
            <strong className="block text-4xl text-emerald-900">
              {formatNumber(totalScore)}
            </strong>
            <span className="mt-1 block text-xs font-semibold uppercase tracking-wide text-slate-600">
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

        <p className="mt-6 rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm leading-6 text-slate-600">
          A taxa de acerto considera questões corretas sobre o total. O
          percentual da pontuação máxima compara a nota líquida com o máximo
          ponderado. Penalidades podem reduzir a nota líquida sem alterar a
          taxa de acerto.
        </p>
        <p className="mt-3 text-sm text-slate-500">
          Finalização:{" "}
          {attempt.finishReason === "TIME_EXPIRED"
            ? "tempo esgotado"
            : "manual"}
        </p>

        <div className="mt-7 flex flex-col gap-3 sm:flex-row">
          <Link href="/" className="rounded-xl border border-slate-300 px-5 py-3 text-center text-sm font-bold text-slate-700">
            Voltar ao início
          </Link>
          {concurso && (
            <Link href={`/concursos/${concurso.id}`} className="rounded-xl bg-amber-400 px-5 py-3 text-center text-sm font-bold text-slate-950 hover:bg-amber-300">
              Fazer novo simulado
            </Link>
          )}
        </div>
      </section>

      <section className="mt-8">
        <h2 className="text-2xl font-black text-slate-950">Desempenho por matéria</h2>
        <div className="mt-4 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          {metrics.subjects.map((subject) => (
            <article key={subject.id} className="border-b border-slate-200 p-5 last:border-0">
              <h3 className="font-bold text-emerald-900">{subject.name}</h3>
              <div className="mt-3 grid gap-2 text-sm text-slate-600 sm:grid-cols-4">
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
          <h2 className="text-2xl font-black text-slate-950">Desempenho por bloco</h2>
          <p className="mt-2 text-sm text-slate-600">
            O atendimento destes mínimos não representa aprovação definitiva
            enquanto todas as regras eliminatórias do edital não estiverem
            configuradas.
          </p>
          <div className="mt-4 space-y-4">
            {metrics.blocks.map((block) => (
              <article key={block.id} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <div className="flex flex-col gap-3 sm:flex-row sm:justify-between">
                  <h3 className="font-medium">{block.name}</h3>
                  <span className={
                    !block.hasConfiguredMinimums
                      ? "text-slate-500"
                      : block.meetsConfiguredMinimums
                        ? "rounded-full bg-emerald-50 px-3 py-1 text-emerald-800"
                        : "rounded-full bg-red-50 px-3 py-1 text-red-700"
                  }>
                    {!block.hasConfiguredMinimums
                      ? "Sem mínimos configurados"
                      : block.meetsConfiguredMinimums
                        ? "Mínimos configurados atingidos"
                        : "Mínimo configurado não atingido"}
                  </span>
                </div>
                <div className="mt-3 grid gap-2 text-sm text-slate-600 sm:grid-cols-3">
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
        <h2 className="text-2xl font-black text-slate-950">Correção detalhada</h2>
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
              <article key={question.id} className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                <div className="flex flex-wrap justify-between gap-3">
                  <div>
                    <strong className="text-emerald-800">
                      Questão {question.number ?? index + 1}
                    </strong>
                    <p className="mt-1 text-xs text-slate-500">
                      {question.subject.name}
                      {question.topic ? ` · ${question.topic.name}` : ""}
                      {question.block ? ` · ${question.block.name}` : ""}
                    </p>
                  </div>
                  <span className={`rounded-full px-3 py-1 text-sm font-bold ${
                    status === "Correta"
                      ? "bg-emerald-50 text-emerald-800"
                      : status === "Incorreta"
                        ? "bg-red-50 text-red-700"
                        : "bg-amber-100 text-amber-900"
                  }`}>{status}</span>
                </div>
                <p className="mt-5 whitespace-pre-line leading-7 text-slate-800">
                  {question.statement}
                </p>
                <div className="mt-5 grid gap-3 rounded-xl bg-slate-50 p-4 text-sm sm:grid-cols-4">
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
    </AppShell>
  );
}

function ResultCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
      <strong className="block text-xl text-slate-950">{value}</strong>
      <span className="mt-1 block text-xs text-slate-500">{label}</span>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <span className="block text-xs text-slate-500">{label}</span>
      <strong className="mt-1 block text-slate-950">{value}</strong>
    </div>
  );
}
