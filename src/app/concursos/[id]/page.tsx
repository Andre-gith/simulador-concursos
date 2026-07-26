import Link from "next/link";
import { notFound } from "next/navigation";

import StartSimuladoForm from "./StartSimuladoForm";
import { auth } from "@/auth";
import { HomeHeader } from "@/components/home/HomeHeader";
import {
  isContestAvailable,
  publicContestDetailSelect,
} from "@/lib/contestDetail";
import { prisma } from "@/lib/prisma";

type ConcursoPageProps = {
  params: Promise<{ id: string }>;
};

function formatPoints(value: number) {
  return new Intl.NumberFormat("pt-BR", {
    maximumFractionDigits: 2,
  }).format(value);
}

function levelLabel(level: string | null) {
  const levels: Record<string, string> = {
    FUNDAMENTAL: "Nível fundamental",
    MEDIO: "Nível médio",
    TECNICO: "Nível técnico",
    SUPERIOR: "Nível superior",
  };
  return level ? (levels[level] ?? level) : "Não informado";
}

function scoringTypeLabel(type: string) {
  const labels: Record<string, string> = {
    CE_PENALTY: "Certo/Errado com penalidade",
    MC_NO_PENALTY: "Múltipla escolha sem penalidade",
    MC_NEGATIVE: "Múltipla escolha com penalidade",
  };
  return labels[type] ?? type;
}

export default async function ConcursoPage({ params }: ConcursoPageProps) {
  const [{ id }, session] = await Promise.all([params, auth()]);
  const concurso = await prisma.concurso.findFirst({
    where: { id, status: { not: "ARCHIVED" } },
    select: publicContestDetailSelect,
  });
  if (!concurso) notFound();

  const publishedQuestions = concurso.questions.filter(
    ({ status }) => status === "PUBLISHED",
  );
  const reviewQuestions = concurso.questions.filter(
    ({ status }) => status === "IN_REVIEW",
  );
  const isAvailable = isContestAvailable({
    status: concurso.status,
    hasScoringRule: concurso.scoringRule !== null,
    publishedQuestionCount: publishedQuestions.length,
  });
  const visibleQuestions = isAvailable ? publishedQuestions : reviewQuestions;

  const subjectMap = new Map<
    string,
    { id: string; name: string; questionCount: number }
  >();
  const blockMap = new Map<
    string,
    { id: string; name: string; order: number; questionCount: number }
  >();
  for (const question of visibleQuestions) {
    const existingSubject = subjectMap.get(question.subject.id);
    if (existingSubject) {
      existingSubject.questionCount += 1;
    } else {
      subjectMap.set(question.subject.id, {
        ...question.subject,
        questionCount: 1,
      });
    }
    if (question.block) {
      const existingBlock = blockMap.get(question.block.id);
      if (existingBlock) {
        existingBlock.questionCount += 1;
      } else {
        blockMap.set(question.block.id, {
          ...question.block,
          questionCount: 1,
        });
      }
    }
  }

  const subjects = [...subjectMap.values()].sort((a, b) =>
    a.name.localeCompare(b.name, "pt-BR"),
  );
  const blocks = [...blockMap.values()].sort(
    (a, b) => a.order - b.order || a.name.localeCompare(b.name, "pt-BR"),
  );
  const weights = [
    ...new Set(visibleQuestions.map(({ weight }) => weight)),
  ].sort((a, b) => a - b);

  return (
    <div className="min-h-screen bg-[#f6f4ed] text-slate-950">
      <HomeHeader
        isAuthenticated={Boolean(session?.user)}
        isAdmin={session?.user?.role === "ADMIN"}
      />

      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 sm:py-12 lg:px-8">
        <Link
          href="/#catalogo"
          className="inline-flex min-h-11 items-center text-sm font-semibold text-emerald-900 transition hover:text-emerald-700"
        >
          ← Voltar ao catálogo
        </Link>

        <section className="mt-5 overflow-hidden rounded-3xl border border-emerald-950/10 bg-[#07110f] text-white shadow-sm">
          <div className="grid gap-8 p-6 sm:p-9 lg:grid-cols-[1.25fr_0.75fr] lg:p-12">
            <div>
              <div className="flex flex-wrap items-center gap-3">
                <p className="text-sm font-bold uppercase tracking-[0.18em] text-amber-400">
                  {concurso.orgao}
                </p>
                <StatusBadge available={isAvailable} />
              </div>
              <h1 className="mt-5 text-3xl font-black tracking-tight sm:text-5xl">
                {concurso.cargo}
              </h1>
              {concurso.especialidade && (
                <p className="mt-3 text-xl font-medium text-slate-200">
                  {concurso.especialidade}
                </p>
              )}
              <p className="mt-6 max-w-2xl leading-7 text-slate-300">
                Simulado organizado conforme a estrutura e a regra de pontuação
                registradas para esta prova.
              </p>
            </div>

            <dl className="grid grid-cols-2 gap-3">
              <HeroMetadata label="Banca" value={concurso.banca.name} />
              <HeroMetadata
                label="Edição"
                value={concurso.edicao ?? "Não informada"}
              />
              <HeroMetadata label="Ano" value={String(concurso.ano)} />
              <HeroMetadata label="Nível" value={levelLabel(concurso.nivel)} />
            </dl>
          </div>
        </section>

        <section
          aria-label="Resumo do concurso"
          className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4"
        >
          <SummaryCard
            label={isAvailable ? "Questões publicadas" : "Questões em revisão"}
            value={String(
              isAvailable
                ? publishedQuestions.length
                : reviewQuestions.length,
            )}
          />
          <SummaryCard label="Matérias" value={String(subjects.length)} />
          <SummaryCard label="Blocos" value={String(blocks.length)} />
          <SummaryCard
            label="Duração"
            value={isAvailable ? "Configurável ao iniciar" : "A confirmar"}
          />
        </section>

        <div className="mt-5 flex flex-wrap gap-5 text-sm">
          {concurso.officialPageUrl && (
            <SourceLink href={concurso.officialPageUrl}>
              Página oficial
            </SourceLink>
          )}
          {concurso.editalUrl && (
            <SourceLink href={concurso.editalUrl}>Consultar edital</SourceLink>
          )}
        </div>

        {!isAvailable && (
          <section className="mt-8 rounded-2xl border border-amber-200 bg-amber-50 p-6 shadow-sm sm:p-8">
            <div className="flex flex-wrap items-center gap-3">
              <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-bold text-amber-900">
                Em preparação
              </span>
              <span className="text-sm font-semibold text-amber-900">
                {reviewQuestions.length}{" "}
                {reviewQuestions.length === 1
                  ? "questão em revisão"
                  : "questões em revisão"}
              </span>
            </div>
            <h2 className="mt-5 text-xl font-bold text-slate-950">
              Esta prova e seu gabarito estão em revisão editorial.
            </h2>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-600">
              A revisão humana precisa confirmar fontes, textos, alternativas,
              gabaritos e regras antes que este concurso possa receber
              tentativas.
            </p>
            <Link
              href="/#catalogo"
              className="mt-6 inline-flex min-h-11 items-center justify-center rounded-xl border border-emerald-900 px-5 py-3 text-sm font-bold text-emerald-950 transition hover:bg-emerald-50"
            >
              Retornar ao catálogo
            </Link>
            {session?.user?.role === "ADMIN" && (
              <div className="mt-4 flex flex-wrap gap-3 border-t border-amber-200 pt-4">
                <Link
                  href={`/admin/concursos/${concurso.id}`}
                  className="inline-flex min-h-11 items-center justify-center rounded-xl bg-emerald-800 px-5 py-3 text-sm font-bold text-white hover:bg-emerald-700"
                >
                  Editar concurso
                </Link>
                <Link
                  href={`/admin?institution=${encodeURIComponent(concurso.orgao)}&specialty=${encodeURIComponent(concurso.especialidade ?? "")}&status=IN_REVIEW`}
                  className="inline-flex min-h-11 items-center justify-center rounded-xl border border-emerald-800 px-5 py-3 text-sm font-bold text-emerald-900 hover:bg-emerald-50"
                >
                  Ver questões em revisão
                </Link>
                <Link
                  href={`/admin/concursos/${concurso.id}/preview`}
                  className="inline-flex min-h-11 items-center justify-center rounded-xl border border-slate-300 bg-white px-5 py-3 text-sm font-bold text-slate-700 hover:border-emerald-600"
                >
                  Pré-visualizar como candidato
                </Link>
              </div>
            )}
          </section>
        )}

        {concurso.scoringRule && (
          <section className="mt-8 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
            <div>
              <p className="text-sm font-bold uppercase tracking-[0.16em] text-emerald-800">
                Como sua nota é calculada
              </p>
              <h2 className="mt-2 text-2xl font-black text-slate-950">
                Regra de pontuação
              </h2>
            </div>
            <dl className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
              <RuleMetric
                label="Tipo"
                value={scoringTypeLabel(concurso.scoringRule.type)}
              />
              <RuleMetric
                label="Por acerto"
                value={`${formatPoints(concurso.scoringRule.pointsCorrect)} ponto(s)`}
              />
              <RuleMetric
                label="Por erro"
                value={
                  concurso.scoringRule.pointsWrong === 0
                    ? "Sem penalidade"
                    : `${formatPoints(concurso.scoringRule.pointsWrong)} ponto(s)`
                }
              />
              <RuleMetric
                label="Em branco"
                value={`${formatPoints(concurso.scoringRule.pointsBlank)} ponto(s)`}
              />
              <RuleMetric
                label="Nota mínima"
                value={
                  concurso.scoringRule.floorAtZero
                    ? "Limitada a zero"
                    : "Pode ser negativa"
                }
              />
            </dl>
            <p className="mt-5 text-sm text-slate-600">
              <strong className="text-slate-900">Pesos das questões: </strong>
              {weights.length > 0
                ? weights.map(formatPoints).join(", ")
                : "Aguardando questões revisadas."}
            </p>
          </section>
        )}

        <section className="mt-8 grid gap-5 lg:grid-cols-2">
          <ListSection
            title="Matérias"
            emptyMessage="As matérias ainda não foram configuradas."
            items={subjects.map(
              (subject) =>
                `${subject.name} · ${subject.questionCount} ${
                  subject.questionCount === 1 ? "questão" : "questões"
                }`,
            )}
          />
          <ListSection
            title="Blocos"
            emptyMessage="Esta prova não possui blocos configurados."
            items={blocks.map(
              (block) =>
                `${block.name} · ${block.questionCount} ${
                  block.questionCount === 1 ? "questão" : "questões"
                }`,
            )}
          />
        </section>

        {isAvailable && concurso.scoringRule && (
          <section className="mt-8">
            <StartSimuladoForm
              concursoId={concurso.id}
              totalQuestions={publishedQuestions.length}
              subjects={subjects}
            />
          </section>
        )}
      </main>
    </div>
  );
}

function StatusBadge({ available }: { available: boolean }) {
  return (
    <span
      className={
        available
          ? "rounded-full bg-emerald-100 px-3 py-1 text-xs font-bold text-emerald-900"
          : "rounded-full bg-amber-100 px-3 py-1 text-xs font-bold text-amber-900"
      }
    >
      {available ? "Disponível" : "Em preparação"}
    </span>
  );
}

function HeroMetadata({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/5 p-4">
      <dt className="text-xs font-semibold uppercase tracking-wide text-slate-400">
        {label}
      </dt>
      <dd className="mt-1 font-bold text-white">{value}</dd>
    </div>
  );
}

function SummaryCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <dt className="text-sm text-slate-500">{label}</dt>
      <dd className="mt-2 text-xl font-black text-slate-950">{value}</dd>
    </div>
  );
}

function RuleMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-[#f6f4ed] p-4">
      <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">
        {label}
      </dt>
      <dd className="mt-2 text-sm font-bold text-slate-950">{value}</dd>
    </div>
  );
}

function ListSection({
  title,
  items,
  emptyMessage,
}: {
  title: string;
  items: string[];
  emptyMessage: string;
}) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
      <h2 className="text-xl font-black text-slate-950">{title}</h2>
      {items.length > 0 ? (
        <ul className="mt-5 space-y-3 text-sm text-slate-700">
          {items.map((item) => (
            <li
              key={item}
              className="rounded-xl border border-slate-100 bg-slate-50 px-4 py-3"
            >
              {item}
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-4 text-sm text-slate-600">{emptyMessage}</p>
      )}
    </section>
  );
}

function SourceLink({
  href,
  children,
}: {
  href: string;
  children: React.ReactNode;
}) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className="font-semibold text-emerald-900 underline decoration-amber-400 decoration-2 underline-offset-4"
    >
      {children}
    </a>
  );
}
