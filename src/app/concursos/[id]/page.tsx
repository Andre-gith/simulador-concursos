import Link from "next/link";
import { notFound } from "next/navigation";

import StartSimuladoForm from "./StartSimuladoForm";
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

export default async function ConcursoPage({ params }: ConcursoPageProps) {
  const { id } = await params;
  const concurso = await prisma.concurso.findFirst({
    where: { id, status: { not: "ARCHIVED" } },
    select: {
      id: true,
      orgao: true,
      cargo: true,
      especialidade: true,
      ano: true,
      edicao: true,
      nivel: true,
      status: true,
      editalUrl: true,
      officialPageUrl: true,
      banca: { select: { name: true } },
      scoringRule: {
        select: {
          type: true,
          pointsCorrect: true,
          pointsWrong: true,
          pointsBlank: true,
          floorAtZero: true,
        },
      },
      questions: {
        where: { status: "PUBLISHED" },
        select: {
          subject: { select: { id: true, name: true } },
          block: { select: { id: true, name: true, order: true } },
        },
      },
    },
  });
  if (!concurso) notFound();

  const subjectMap = new Map<
    string,
    { id: string; name: string; questionCount: number }
  >();
  const blockMap = new Map<
    string,
    { id: string; name: string; order: number; questionCount: number }
  >();
  for (const question of concurso.questions) {
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
  const totalQuestions = concurso.questions.length;
  const isAvailable =
    concurso.status === "PUBLISHED" &&
    concurso.scoringRule !== null &&
    totalQuestions > 0;
  const scoringDescription =
    concurso.scoringRule?.type === "CE_PENALTY"
      ? `Certo/Errado: ${formatPoints(concurso.scoringRule.pointsCorrect)} por acerto e ${formatPoints(concurso.scoringRule.pointsWrong)} por erro.`
      : concurso.scoringRule?.type === "MC_NEGATIVE"
        ? `Múltipla escolha com ${formatPoints(concurso.scoringRule.pointsCorrect)} por acerto e ${formatPoints(concurso.scoringRule.pointsWrong)} por erro.`
        : concurso.scoringRule
          ? `Múltipla escolha sem penalidade: ${formatPoints(concurso.scoringRule.pointsCorrect)} por acerto.`
          : "Regra de pontuação em configuração.";

  return (
    <main className="mx-auto min-h-screen max-w-5xl px-4 py-10">
      <Link
        href="/#catalogo"
        className="mb-8 inline-flex text-sm text-neutral-400 transition hover:text-orange-400"
      >
        ← Voltar ao catálogo
      </Link>

      <section className="rounded-2xl border border-neutral-800 bg-neutral-950 p-6 sm:p-8">
        <div className="flex flex-wrap items-start justify-between gap-5">
          <div>
            <p className="text-sm font-semibold uppercase tracking-wider text-orange-400">
              {concurso.orgao}
            </p>
            <h1 className="mt-3 text-2xl font-semibold sm:text-3xl">
              {concurso.cargo}
            </h1>
            {concurso.especialidade && (
              <p className="mt-2 text-lg text-neutral-300">
                {concurso.especialidade}
              </p>
            )}
          </div>
          <span
            className={`rounded-full px-3 py-1 text-xs font-bold ${
              isAvailable
                ? "bg-emerald-950 text-emerald-300"
                : "bg-amber-950 text-amber-300"
            }`}
          >
            {isAvailable ? "DISPONÍVEL" : concurso.status}
          </span>
        </div>

        <dl className="mt-7 grid gap-4 border-y border-neutral-800 py-6 sm:grid-cols-2 lg:grid-cols-4">
          <Metadata label="Instituição" value={concurso.orgao} />
          <Metadata label="Banca" value={concurso.banca.name} />
          <Metadata
            label="Edição"
            value={
              concurso.edicao
                ? `${concurso.edicao} · ${concurso.ano}`
                : String(concurso.ano)
            }
          />
          <Metadata label="Nível" value={levelLabel(concurso.nivel)} />
          <Metadata
            label="Questões"
            value={isAvailable ? String(totalQuestions) : "Em revisão"}
          />
          <Metadata
            label="Matérias"
            value={isAvailable ? String(subjects.length) : "Em revisão"}
          />
          <Metadata
            label="Blocos"
            value={isAvailable ? String(blocks.length) : "Em revisão"}
          />
          <Metadata
            label="Duração"
            value={isAvailable ? "Configurável ao iniciar" : "A confirmar"}
          />
        </dl>

        <div className="mt-6 flex flex-wrap gap-4 text-sm">
          {concurso.officialPageUrl && (
            <a
              href={concurso.officialPageUrl}
              target="_blank"
              rel="noreferrer"
              className="text-orange-400"
            >
              Página oficial
            </a>
          )}
          {concurso.editalUrl && (
            <a
              href={concurso.editalUrl}
              target="_blank"
              rel="noreferrer"
              className="text-orange-400"
            >
              Consultar edital
            </a>
          )}
        </div>
      </section>

      {!isAvailable || !concurso.scoringRule ? (
        <section className="mt-8 rounded-2xl border border-amber-900 bg-amber-950/30 p-6">
          <h2 className="text-lg font-semibold text-amber-200">
            Prova e gabarito em revisão
          </h2>
          <p className="mt-2 text-sm leading-6 text-amber-100/70">
            Este concurso ainda está em preparação. A regra de pontuação, as
            fontes e as questões precisam concluir a revisão humana antes que
            um simulado possa ser iniciado.
          </p>
          <Link
            href="/#catalogo"
            className="mt-5 inline-flex rounded-lg border border-amber-800 px-4 py-2 text-sm font-semibold text-amber-200"
          >
            Retornar ao catálogo
          </Link>
        </section>
      ) : (
        <>
          <section className="mt-8 grid gap-5 lg:grid-cols-2">
            <div className="rounded-2xl border border-neutral-800 bg-neutral-950 p-6">
              <h2 className="font-semibold">Regra de pontuação</h2>
              <p className="mt-3 text-sm leading-6 text-neutral-400">
                {scoringDescription} Questões em branco valem{" "}
                {formatPoints(concurso.scoringRule.pointsBlank)} ponto.
                {concurso.scoringRule.floorAtZero
                  ? " A nota líquida não fica abaixo de zero."
                  : " A nota líquida pode ficar abaixo de zero."}
              </p>
            </div>
            <div className="rounded-2xl border border-neutral-800 bg-neutral-950 p-6">
              <h2 className="font-semibold">Duração</h2>
              <p className="mt-3 text-sm leading-6 text-neutral-400">
                Escolha ao iniciar: sem limite, 15, 30, 60 ou 120 minutos. O
                servidor controla o tempo a partir do início da tentativa.
              </p>
            </div>
          </section>

          <section className="mt-8 grid gap-5 lg:grid-cols-2">
            <ListSection
              title="Matérias"
              items={subjects.map(
                (subject) =>
                  `${subject.name} · ${subject.questionCount} ${
                    subject.questionCount === 1 ? "questão" : "questões"
                  }`,
              )}
            />
            <ListSection
              title="Blocos"
              items={
                blocks.length > 0
                  ? blocks.map(
                      (block) =>
                        `${block.name} · ${block.questionCount} ${
                          block.questionCount === 1 ? "questão" : "questões"
                        }`,
                    )
                  : ["Esta prova não possui blocos configurados."]
              }
            />
          </section>

          <section className="mt-8">
            <StartSimuladoForm
              concursoId={concurso.id}
              totalQuestions={totalQuestions}
              subjects={subjects}
            />
          </section>
        </>
      )}
    </main>
  );
}

function Metadata({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs uppercase tracking-wide text-neutral-500">
        {label}
      </dt>
      <dd className="mt-1 font-medium text-neutral-200">{value}</dd>
    </div>
  );
}

function ListSection({ title, items }: { title: string; items: string[] }) {
  return (
    <section className="rounded-2xl border border-neutral-800 bg-neutral-950 p-6">
      <h2 className="font-semibold">{title}</h2>
      <ul className="mt-4 space-y-2 text-sm text-neutral-400">
        {items.map((item) => (
          <li key={item} className="rounded-lg bg-neutral-900 px-4 py-3">
            {item}
          </li>
        ))}
      </ul>
    </section>
  );
}
