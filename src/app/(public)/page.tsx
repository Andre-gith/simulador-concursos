import { auth } from "@/auth";
import Link from "next/link";
import { CatalogControls } from "@/components/home/CatalogControls";
import {
  AvailableContestCard,
  PreparingContestCard,
} from "@/components/home/ContestCards";
import { EducationalContent } from "@/components/home/EducationalContent";
import { HomeHeader } from "@/components/home/HomeHeader";
import {
  filterCatalog,
  hasSameCatalogIdentity,
  isAvailableContest,
  isPreparingContest,
  parseCatalogFilter,
  type CatalogContest,
} from "@/lib/catalog";
import { prisma } from "@/lib/prisma";

type HomePageProps = {
  searchParams: Promise<{
    q?: string | string[];
    filter?: string | string[];
  }>;
};

function firstQueryValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] ?? "" : value ?? "";
}

export default async function HomePage({ searchParams }: HomePageProps) {
  const [session, params, contestsFromDatabase, editorialEntries] =
    await Promise.all([
    auth(),
    searchParams,
    prisma.concurso.findMany({
      where: {
        status: { in: ["DRAFT", "IN_REVIEW", "PUBLISHED"] },
      },
      select: {
        id: true,
        orgao: true,
        cargo: true,
        especialidade: true,
        edicao: true,
        ano: true,
        nivel: true,
        status: true,
        banca: {
          select: { name: true },
        },
        scoringRule: {
          select: {
            type: true,
            pointsCorrect: true,
            pointsWrong: true,
            floorAtZero: true,
          },
        },
        questions: {
          where: { status: "PUBLISHED" },
          select: {
            subject: {
              select: { name: true },
            },
          },
        },
      },
      orderBy: [{ ano: "desc" }, { createdAt: "desc" }],
      }),
      prisma.editorialCatalogEntry.findMany({
        where: {
          status: { in: ["DRAFT", "IN_REVIEW"] },
        },
        select: {
          id: true,
          orgao: true,
          title: true,
          cargo: true,
          especialidade: true,
          ano: true,
          edicao: true,
          nivel: true,
          status: true,
          trustLevel: true,
          banca: {
            select: { name: true },
          },
        },
        orderBy: [{ orgao: "asc" }, { title: "asc" }],
      }),
    ]);

  const contests: CatalogContest[] = [
    ...contestsFromDatabase.map((contest) => ({
      id: contest.id,
      institution: contest.orgao,
      position: contest.cargo,
      specialty: contest.especialidade,
      board: contest.banca.name,
      edition: contest.edicao,
      year: contest.ano,
      level: contest.nivel,
      status: contest.status,
      hasScoringRule: contest.scoringRule !== null,
      publishedQuestionCount: contest.questions.length,
      subjects: [
        ...new Set(contest.questions.map(({ subject }) => subject.name)),
      ].sort((a, b) => a.localeCompare(b, "pt-BR")),
      scoringType: contest.scoringRule?.type ?? null,
      pointsCorrect: contest.scoringRule?.pointsCorrect ?? null,
      pointsWrong: contest.scoringRule?.pointsWrong ?? null,
      floorAtZero: contest.scoringRule?.floorAtZero ?? null,
      trustLevel: "OFFICIAL_CONFIRMED" as const,
    })),
    ...editorialEntries
      .filter(
        (entry) =>
          !contestsFromDatabase.some(
            (contest) =>
              hasSameCatalogIdentity(
                {
                  institution: contest.orgao,
                  position: contest.cargo,
                  specialty: contest.especialidade,
                },
                {
                  institution: entry.orgao,
                  position: entry.cargo,
                  specialty: entry.especialidade,
                },
              ),
          ),
      )
      .map((entry) => ({
      id: `editorial-${entry.id}`,
      institution: entry.orgao,
      position: entry.cargo ?? entry.title,
      specialty: entry.especialidade,
      board: entry.banca?.name ?? "Banca a confirmar",
      edition: entry.edicao,
      year: entry.ano,
      level: entry.nivel,
      status: entry.status,
      hasScoringRule: false,
      publishedQuestionCount: 0,
      subjects: [],
      trustLevel: entry.trustLevel,
      scoringType: null,
      pointsCorrect: null,
      pointsWrong: null,
      floorAtZero: null,
      })),
  ];

  const query = firstQueryValue(params.q).trim().slice(0, 120);
  const activeFilter = parseCatalogFilter(firstQueryValue(params.filter));
  const filteredContests = filterCatalog(contests, query, activeFilter);
  const available = filteredContests.filter(isAvailableContest);
  const preparing = filteredContests.filter(isPreparingContest);
  const hasResults = available.length > 0 || preparing.length > 0;

  return (
    <div className="min-h-screen bg-[#f6f4ed] text-slate-950">
      <HomeHeader
        isAuthenticated={Boolean(session?.user)}
        isAdmin={session?.user?.role === "ADMIN"}
      />

      <main>
        <section className="overflow-hidden bg-[#07110f] text-white">
          <div className="mx-auto grid max-w-7xl gap-12 px-4 py-20 sm:px-6 lg:grid-cols-[1.15fr_0.85fr] lg:px-8 lg:py-28">
            <div>
              <p className="text-sm font-bold uppercase tracking-[0.22em] text-amber-400">
                Simulados de concursos
              </p>
              <h1 className="mt-5 max-w-3xl text-4xl font-black leading-tight tracking-tight sm:text-6xl">
                Treine com a pontuação real da sua prova.
              </h1>
              <p className="mt-6 max-w-2xl text-lg leading-8 text-slate-300">
                Veja o efeito de cada resposta antes do dia da prova. A Nota de
                Banca respeita penalidades, pesos e regras configuradas para
                cada concurso.
              </p>
              <Link
                href="#catalogo"
                className="mt-8 inline-flex min-h-12 items-center rounded-xl bg-amber-400 px-6 py-3 font-bold text-slate-950 transition hover:bg-amber-300"
              >
                Explorar simulados
              </Link>
            </div>

            <div
              aria-label="Recursos do simulador"
              className="grid gap-3 self-end sm:grid-cols-2"
            >
              {[
                "Penalidade por erro",
                "Pesos diferentes",
                "Questões em branco",
                "Resultado por matéria",
                "Desempenho por bloco",
                "Nota líquida real",
              ].map((feature) => (
                <div
                  key={feature}
                  className="rounded-xl border border-white/10 bg-white/5 px-4 py-4 text-sm font-semibold text-slate-100"
                >
                  <span className="mr-2 text-amber-400" aria-hidden="true">
                    ✓
                  </span>
                  {feature}
                </div>
              ))}
            </div>
          </div>
        </section>

        <section
          id="catalogo"
          aria-labelledby="catalogo-title"
          className="scroll-mt-6 py-16 lg:py-20"
        >
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="max-w-2xl">
              <p className="text-sm font-bold uppercase tracking-[0.2em] text-emerald-800">
                Catálogo
              </p>
              <h2
                id="catalogo-title"
                className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl"
              >
                Encontre a prova certa para treinar
              </h2>
            </div>

            <div className="mt-8">
              <CatalogControls activeFilter={activeFilter} query={query} />
            </div>

            {!hasResults && (
              <div
                role="status"
                className="mt-10 rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center"
              >
                <h3 className="font-bold text-slate-900">
                  Nenhum concurso encontrado
                </h3>
                <p className="mt-2 text-sm text-slate-600">
                  Tente outro termo ou remova os filtros do catálogo.
                </p>
              </div>
            )}

            {available.length > 0 && (
              <section aria-labelledby="disponiveis-title" className="mt-14">
                <div className="flex items-end justify-between gap-4">
                  <div>
                    <h2
                      id="disponiveis-title"
                      className="text-2xl font-bold text-slate-950"
                    >
                      Simulados disponíveis
                    </h2>
                    <p className="mt-2 text-sm text-slate-600">
                      Provas publicadas, com questões revisadas e regra de
                      pontuação configurada.
                    </p>
                  </div>
                  <span className="text-sm font-semibold text-emerald-800">
                    {available.length}{" "}
                    {available.length === 1 ? "prova" : "provas"}
                  </span>
                </div>
                <div className="mt-6 grid gap-6 md:grid-cols-2 xl:grid-cols-3">
                  {available.map((contest) => (
                    <AvailableContestCard
                      key={contest.id}
                      contest={contest}
                    />
                  ))}
                </div>
              </section>
            )}

            {preparing.length > 0 && (
              <section aria-labelledby="preparacao-title" className="mt-16">
                <div>
                  <h2
                    id="preparacao-title"
                    className="text-2xl font-bold text-slate-950"
                  >
                    Em preparação
                  </h2>
                  <p className="mt-2 text-sm text-slate-600">
                    Conteúdo identificado, ainda sem liberação para simulados. Previsões comunitárias podem mudar e não representam confirmação oficial.
                  </p>
                </div>
                <div className="mt-6 grid gap-5 md:grid-cols-2 xl:grid-cols-3">
                  {preparing.map((contest) => (
                    <PreparingContestCard
                      key={contest.id}
                      contest={contest}
                    />
                  ))}
                </div>
              </section>
            )}
          </div>
        </section>

        <EducationalContent />
      </main>

      <footer className="border-t border-white/10 bg-[#07110f] px-4 py-8 text-center text-sm text-slate-400">
        Nota de Banca — simulados com regras de pontuação configuradas por
        concurso.
      </footer>
    </div>
  );
}
