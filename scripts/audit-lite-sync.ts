import { PrismaClient, type UserRole } from "@prisma/client";

type EnvironmentAudit = {
  users: Array<{ id: string; name: string | null; email: string; role: UserRole }>;
  contests: Array<{
    key: string;
    orgao: string;
    cargo: string;
    ano: number;
    edicao: string | null;
    especialidade: string | null;
    banca: string | null;
    papers: number;
    questions: number;
  }>;
  counts: Record<"admins" | "users" | "contests" | "papers" | "questions" | "alternatives" | "assets" | "editorialEntries" | "importJobs", number>;
};

const officialOrganizations = ["Banco do Brasil", "Caixa Econômica Federal", "Dataprev", "Transpetro"];

function required(name: "LOCAL_DATABASE_URL" | "RENDER_DATABASE_URL") {
  const value = process.env[name];
  if (!value) throw new Error(`${name} é obrigatória.`);
  return value;
}

function client(url: string) {
  return new PrismaClient({ datasources: { db: { url } } });
}

function contestKey(contest: { banca: { name: string } | null; orgao: string; cargo: string; ano: number; edicao: string | null; especialidade: string | null }) {
  return [contest.banca?.name ?? "", contest.orgao, contest.cargo, contest.ano, contest.edicao ?? "", contest.especialidade ?? ""].join("|");
}

async function audit(prisma: PrismaClient): Promise<EnvironmentAudit> {
  const [users, contests, admins, regularUsers, papers, questions, alternatives, assets, editorialEntries, importJobs] = await Promise.all([
    prisma.user.findMany({ select: { id: true, name: true, email: true, role: true }, orderBy: { email: "asc" } }),
    prisma.concurso.findMany({
      include: { banca: { select: { name: true } }, _count: { select: { papers: true, questions: true } } },
      orderBy: [{ orgao: "asc" }, { cargo: "asc" }, { ano: "asc" }],
    }),
    prisma.user.count({ where: { role: "ADMIN" } }),
    prisma.user.count({ where: { role: "USER" } }),
    prisma.examPaper.count(),
    prisma.question.count(),
    prisma.alternative.count(),
    prisma.questionVisualAsset.count(),
    prisma.editorialCatalogEntry.count(),
    prisma.importJob.count(),
  ]);

  return {
    users,
    contests: contests.map((contest) => ({
      key: contestKey(contest),
      orgao: contest.orgao,
      cargo: contest.cargo,
      ano: contest.ano,
      edicao: contest.edicao,
      especialidade: contest.especialidade,
      banca: contest.banca?.name ?? null,
      papers: contest._count.papers,
      questions: contest._count.questions,
    })),
    counts: { admins, users: regularUsers, contests: contests.length, papers, questions, alternatives, assets, editorialEntries, importJobs },
  };
}

function printAudit(label: string, audit: EnvironmentAudit) {
  console.log(`\n${label}`);
  console.table(audit.counts);
  console.log("Usuários (sem senha):");
  console.table(audit.users);
  console.log("Concursos:");
  console.table(audit.contests.map(({ key: _key, ...contest }) => contest));
}

function compare(local: EnvironmentAudit, render: EnvironmentAudit) {
  const renderKeys = new Set(render.contests.map((contest) => contest.key));
  const missingOfficialContests = local.contests.filter((contest) =>
    officialOrganizations.includes(contest.orgao) && !renderKeys.has(contest.key),
  );
  const countComparison = Object.fromEntries(
    Object.keys(local.counts).map((key) => [key, { local: local.counts[key as keyof EnvironmentAudit["counts"]], render: render.counts[key as keyof EnvironmentAudit["counts"]] }]),
  );
  const identical = Object.values(countComparison).every(({ local: left, render: right }) => left === right)
    && local.contests.length === render.contests.length
    && local.contests.every((contest) => renderKeys.has(contest.key));

  console.log("\nComparação de contagens:");
  console.table(countComparison);
  console.log("\nConcursos oficiais ausentes no Render:");
  console.table(missingOfficialContests.map(({ key: _key, ...contest }) => contest));
  console.log(`\nAmbientes idênticos: ${identical ? "SIM" : "NÃO"}`);
  return { missingOfficialContests, identical };
}

async function main() {
  const local = client(required("LOCAL_DATABASE_URL"));
  const render = client(required("RENDER_DATABASE_URL"));
  try {
    const [localAudit, renderAudit] = await Promise.all([audit(local), audit(render)]);
    printAudit("LOCAL", localAudit);
    printAudit("RENDER", renderAudit);
    compare(localAudit, renderAudit);
  } finally {
    await Promise.all([local.$disconnect(), render.$disconnect()]);
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
