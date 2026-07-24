import Link from "next/link";
import { notFound } from "next/navigation";

import { ContestEditor } from "./ContestEditor";
import { requireAdmin } from "@/lib/admin";
import { prisma } from "@/lib/prisma";

type ContestAdminPageProps = {
  params: Promise<{ id: string }>;
};

export default async function ContestAdminPage({
  params,
}: ContestAdminPageProps) {
  await requireAdmin();
  const { id } = await params;
  const [contest, banks] = await Promise.all([
    prisma.concurso.findUnique({
      where: { id },
      include: {
        banca: true,
        scoringRule: true,
        questions: { select: { status: true } },
      },
    }),
    prisma.banca.findMany({ orderBy: { name: "asc" } }),
  ]);
  if (!contest) notFound();

  const inReview = contest.questions.filter(
    (question) => question.status === "IN_REVIEW",
  ).length;
  const published = contest.questions.filter(
    (question) => question.status === "PUBLISHED",
  ).length;

  return (
    <main className="mx-auto max-w-6xl px-4 py-10">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-sm text-orange-400">{contest.banca.name}</p>
          <h1 className="mt-1 text-2xl font-semibold">{contest.orgao}</h1>
          <p className="mt-1 text-sm text-neutral-500">
            {contest.cargo}
            {contest.especialidade ? ` · ${contest.especialidade}` : ""}
          </p>
        </div>
        <Link href="/admin" className="text-orange-400">
          Voltar ao painel
        </Link>
      </div>

      <section className="mt-6 grid gap-3 sm:grid-cols-4">
        <Metric label="Questões totais" value={contest.questions.length} />
        <Metric label="Em revisão" value={inReview} />
        <Metric label="Publicadas" value={published} />
        <Metric
          label="Regra de pontuação"
          value={contest.scoringRule ? "Configurada" : "Ausente"}
        />
      </section>

      <ContestEditor
        contest={{
          id: contest.id,
          bancaId: contest.bancaId,
          orgao: contest.orgao,
          cargo: contest.cargo,
          especialidade: contest.especialidade,
          edicao: contest.edicao,
          ano: contest.ano,
          nivel: contest.nivel,
          officialPageUrl: contest.officialPageUrl,
          editalUrl: contest.editalUrl,
          status: contest.status,
        }}
        banks={banks}
      />
    </main>
  );
}

function Metric({
  label,
  value,
}: {
  label: string;
  value: string | number;
}) {
  return (
    <div className="rounded-xl bg-neutral-900 p-4">
      <strong className="text-xl">{value}</strong>
      <span className="mt-1 block text-xs text-neutral-500">{label}</span>
    </div>
  );
}
