import Link from "next/link";

import { prisma } from "@/lib/prisma";
import { calculateResultMetrics } from "@/lib/resultMetrics";
import { prepareFinishedHistory } from "@/lib/history";
import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/layout/AppShell";

export const dynamic = "force-dynamic";

type HistoryPageProps = {
  searchParams: Promise<{
    concurso?: string;
    banca?: string;
    periodo?: string;
  }>;
};

function formatNumber(value: number) {
  return new Intl.NumberFormat("pt-BR", {
    maximumFractionDigits: 2,
  }).format(value);
}

function formatDuration(startedAt: Date, finishedAt: Date) {
  const minutes = Math.max(
    0,
    Math.floor((finishedAt.getTime() - startedAt.getTime()) / 60_000),
  );
  return `${minutes} ${minutes === 1 ? "minuto" : "minutos"}`;
}

export default async function HistoryPage({
  searchParams,
}: HistoryPageProps) {
  const filters = await searchParams;
  const session = await auth();
  if (!session?.user.id) redirect("/login");
  const periodDays = ["7", "30", "90"].includes(filters.periodo ?? "")
    ? Number(filters.periodo)
    : null;
  const since = periodDays
    ? new Date(Date.now() - periodDays * 86_400_000)
    : undefined;

  const attempts = await prisma.attempt.findMany({
    where: {
      userId: session.user.id,
      finishedAt: since ? { gte: since } : { not: null },
      simulatedExam: {
        concursoId: filters.concurso || undefined,
        concurso: {
          bancaId: filters.banca || undefined,
        },
      },
    },
    orderBy: { finishedAt: "desc" },
    select: {
      id: true,
      startedAt: true,
      finishedAt: true,
      totalScore: true,
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
          concurso: {
            select: {
              id: true,
              orgao: true,
              cargo: true,
              banca: { select: { id: true, name: true } },
              scoringRule: { select: { pointsCorrect: true } },
            },
          },
          questions: {
            select: {
              question: {
                select: {
                  id: true,
                  weight: true,
                  subject: { select: { name: true } },
                },
              },
            },
          },
        },
      },
    },
  });

  const contests = await prisma.concurso.findMany({
    where: { simulatedExams: { some: { attempts: { some: {
      userId: session.user.id,
      finishedAt: { not: null },
    } } } } },
    orderBy: [{ orgao: "asc" }, { cargo: "asc" }],
    select: {
      id: true,
      orgao: true,
      cargo: true,
      banca: { select: { id: true, name: true } },
    },
  });
  const banks = Array.from(
    new Map(contests.map((contest) => [contest.banca.id, contest.banca])).values(),
  ).sort((left, right) => left.name.localeCompare(right.name, "pt-BR"));
  const finishedAttempts = prepareFinishedHistory(attempts);

  return (
    <AppShell isAuthenticated isAdmin={session.user.role === "ADMIN"}>
    <main className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-sm font-bold uppercase tracking-[0.18em] text-emerald-800">Seu desempenho</p>
          <h1 className="mt-2 text-3xl font-black text-slate-950">Histórico de tentativas</h1>
          <p className="mt-2 text-sm text-slate-600">
            Suas tentativas finalizadas.
          </p>
        </div>
        <Link href="/#catalogo" className="text-sm font-bold text-emerald-800">Voltar ao catálogo</Link>
      </div>

      <form className="mt-7 grid gap-3 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:grid-cols-4">
        <select name="concurso" aria-label="Concurso" defaultValue={filters.concurso ?? ""} className="min-h-12 rounded-xl border border-slate-300 bg-white p-3 text-slate-950">
          <option value="">Todos os concursos</option>
          {contests.map((contest) => (
            <option key={contest.id} value={contest.id}>
              {contest.orgao} — {contest.cargo}
            </option>
          ))}
        </select>
        <select name="banca" aria-label="Banca" defaultValue={filters.banca ?? ""} className="min-h-12 rounded-xl border border-slate-300 bg-white p-3 text-slate-950">
          <option value="">Todas as bancas</option>
          {banks.map((bank) => (
            <option key={bank.id} value={bank.id}>{bank.name}</option>
          ))}
        </select>
        <select name="periodo" aria-label="Período" defaultValue={filters.periodo ?? ""} className="min-h-12 rounded-xl border border-slate-300 bg-white p-3 text-slate-950">
          <option value="">Todo o período</option>
          <option value="7">Últimos 7 dias</option>
          <option value="30">Últimos 30 dias</option>
          <option value="90">Últimos 90 dias</option>
        </select>
        <button className="min-h-12 rounded-xl bg-emerald-800 p-3 font-bold text-white transition hover:bg-emerald-700">
          Filtrar
        </button>
      </form>

      {finishedAttempts.length === 0 ? (
        <div className="mt-6 rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center shadow-sm">
          <h2 className="font-bold text-slate-950">Nenhuma tentativa finalizada</h2>
          <p className="mt-2 text-sm text-slate-600">Conclua um simulado para acompanhar sua evolução aqui.</p>
          <Link href="/#catalogo" className="mt-5 inline-flex rounded-xl bg-amber-400 px-5 py-3 text-sm font-bold text-slate-950">Explorar simulados</Link>
        </div>
      ) : (
        <div className="mt-6 space-y-4">
          {finishedAttempts.map((attempt) => {
            const concurso = attempt.simulatedExam.concurso;
            const metrics = calculateResultMetrics(
              attempt.simulatedExam.questions.map(({ question }) => ({
                id: question.id,
                weight: question.weight,
                subject: question.subject.name,
                block: null,
              })),
              attempt.answers,
              concurso?.scoringRule?.pointsCorrect ?? 0,
              attempt.totalScore ?? 0,
            );
            return (
              <article key={attempt.id} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <div className="flex flex-col gap-4 sm:flex-row sm:justify-between">
                  <div>
                    <h2 className="font-bold text-slate-950">{concurso?.orgao ?? "Concurso removido"}</h2>
                    <p className="mt-1 text-sm text-slate-600">
                      {concurso?.banca.name} · {concurso?.cargo}
                    </p>
                    <p className="mt-1 text-xs text-slate-500">
                      {attempt.finishedAt?.toLocaleString("pt-BR")}
                    </p>
                  </div>
                  <Link href={`/resultado/${attempt.id}`} className="inline-flex min-h-11 items-center justify-center rounded-xl bg-amber-400 px-4 py-2 text-sm font-bold text-slate-950">
                    Rever resultado
                  </Link>
                </div>
                <div className="mt-5 grid gap-3 rounded-xl bg-slate-50 p-4 text-sm sm:grid-cols-5">
                  <Metric label="Nota líquida" value={formatNumber(metrics.overall.netScore)} />
                  <Metric label="Máximo" value={formatNumber(metrics.overall.maximumScore)} />
                  <Metric label="Taxa de acerto" value={`${formatNumber(metrics.overall.accuracyRate)}%`} />
                  <Metric label="Questões" value={String(metrics.overall.total)} />
                  <Metric label="Tempo" value={formatDuration(attempt.startedAt, attempt.finishedAt)} />
                </div>
              </article>
            );
          })}
        </div>
      )}
    </main>
    </AppShell>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return <div><span className="block text-xs text-slate-500">{label}</span><strong className="mt-1 block text-slate-950">{value}</strong></div>;
}
