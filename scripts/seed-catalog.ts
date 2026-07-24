import {
  EducationLevel,
  Prisma,
  PrismaClient,
  PublicationStatus,
} from "@prisma/client";

const prisma = new PrismaClient();

type CatalogSeed = {
  catalogKey: string;
  orgao: string;
  title: string;
  cargo?: string;
  especialidade?: string;
  banca?: string;
  nivel?: EducationLevel;
};

type Summary = {
  created: number;
  updated: number;
  ignored: number;
  banksCreated: number;
};

const transpetroMidLevel = [
  "Ambiental",
  "Dutos e Terminais",
  "Faixa de Dutos",
  "Informática",
  "Inspeção de equipamentos e instalações",
  "Manutenção | Elétrica",
  "Manutenção | Eletrônica",
  "Manutenção | Instrumentação",
  "Manutenção | Mecânica",
  "Projetos, Construção e Montagem | Edificações",
  "Projetos, Construção e Montagem | Mecânica",
  "Química de Petróleo",
  "Segurança",
] as const;

const transpetroHigherLevel = [
  "Administração",
  "Advocacia",
  "Análise Ambiental",
  "Análise de Sistemas | Infraestrutura",
  "Análise de Sistemas | Segurança Cibernética e da Informação",
  "Análise de Sistemas | Processos de Negócio",
  "Análise de Sistemas | SAP – Finanças e Contabilidade",
  "Comercialização e Logística | Comércio e Suprimentos",
  "Comercialização e Logística | Transporte Marítimo",
  "Comunicação Social | Jornalismo",
  "Comunicação Social | Publicidade e Propaganda",
  "Comunicação Social | Relações Públicas",
  "Contabilidade",
  "Enfermagem do Trabalho",
  "Engenharia Ambiental",
  "Engenharia Civil",
  "Engenharia de Automação",
  "Engenharia de Inspeção",
  "Engenharia de Produção",
  "Engenharia de Segurança",
  "Engenharia de Telecomunicações",
  "Engenharia Elétrica",
  "Engenharia Geotécnica",
  "Engenharia Mecânica",
  "Engenharia Naval",
  "Engenharia Química",
  "Pedagogia",
  "Serviço Social",
] as const;

function keyPart(value: string) {
  return value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

const catalog: CatalogSeed[] = [
  {
    catalogKey: "banco-do-brasil-escriturario-agente-tecnologia",
    orgao: "Banco do Brasil",
    title: "Escriturário — Agente de Tecnologia",
    cargo: "Escriturário",
    especialidade: "Agente de Tecnologia",
    banca: "CESGRANRIO",
    nivel: EducationLevel.MEDIO,
  },
  {
    catalogKey: "caixa-tecnico-bancario-novo-ti",
    orgao: "Caixa Econômica Federal",
    title: "Técnico Bancário Novo — Tecnologia da Informação",
    cargo: "Técnico Bancário Novo",
    especialidade: "Tecnologia da Informação",
    banca: "CESGRANRIO",
    nivel: EducationLevel.MEDIO,
  },
  {
    catalogKey: "dataprev-desenvolvimento-software",
    orgao: "Dataprev",
    title: "Desenvolvimento de Software",
    cargo: "Desenvolvimento de Software",
  },
  ...transpetroMidLevel.map(
    (especialidade): CatalogSeed => ({
      catalogKey: `transpetro-medio-${keyPart(especialidade)}`,
      orgao: "Transpetro",
      title: especialidade,
      especialidade,
      nivel: EducationLevel.MEDIO,
    }),
  ),
  ...transpetroHigherLevel.map(
    (especialidade): CatalogSeed => ({
      catalogKey: `transpetro-superior-${keyPart(especialidade)}`,
      orgao: "Transpetro",
      title: especialidade,
      especialidade,
      nivel: EducationLevel.SUPERIOR,
    }),
  ),
  {
    catalogKey: "petrobras-catalogo-em-preparacao",
    orgao: "Petrobras",
    title: "Catálogo Petrobras em preparação",
  },
];

function sameValue(
  current: {
    bancaId: string | null;
    orgao: string;
    title: string;
    cargo: string | null;
    especialidade: string | null;
    ano: number | null;
    edicao: string | null;
    nivel: EducationLevel | null;
  },
  expected: Prisma.EditorialCatalogEntryUncheckedCreateInput,
) {
  return (
    current.bancaId === (expected.bancaId ?? null) &&
    current.orgao === expected.orgao &&
    current.title === expected.title &&
    current.cargo === (expected.cargo ?? null) &&
    current.especialidade === (expected.especialidade ?? null) &&
    current.ano === (expected.ano ?? null) &&
    current.edicao === (expected.edicao ?? null) &&
    current.nivel === (expected.nivel ?? null)
  );
}

async function seedCatalog() {
  const summary: Summary = {
    created: 0,
    updated: 0,
    ignored: 0,
    banksCreated: 0,
  };

  await prisma.$transaction(async (tx) => {
    const requiredBanks = [
      ...new Set(
        catalog
          .map((entry) => entry.banca)
          .filter((name): name is string => Boolean(name)),
      ),
    ];
    const banks = new Map<string, string>();

    for (const name of requiredBanks) {
      const existing = await tx.banca.findUnique({ where: { name } });
      if (existing) {
        banks.set(name, existing.id);
        continue;
      }
      const created = await tx.banca.create({ data: { name } });
      banks.set(name, created.id);
      summary.banksCreated += 1;
    }

    for (const entry of catalog) {
      const data: Prisma.EditorialCatalogEntryUncheckedCreateInput = {
        catalogKey: entry.catalogKey,
        bancaId: entry.banca ? banks.get(entry.banca) : null,
        orgao: entry.orgao,
        title: entry.title,
        cargo: entry.cargo ?? null,
        especialidade: entry.especialidade ?? null,
        ano: null,
        edicao: null,
        nivel: entry.nivel ?? null,
        status: PublicationStatus.IN_REVIEW,
      };
      const existing = await tx.editorialCatalogEntry.findUnique({
        where: { catalogKey: entry.catalogKey },
      });

      if (!existing) {
        await tx.editorialCatalogEntry.create({ data });
        summary.created += 1;
        continue;
      }

      if (sameValue(existing, data)) {
        summary.ignored += 1;
        continue;
      }

      if (
        existing.status === PublicationStatus.PUBLISHED ||
        existing.status === PublicationStatus.ARCHIVED
      ) {
        console.warn(
          `Ignorado para preservar status ${existing.status}: ${entry.catalogKey}`,
        );
        summary.ignored += 1;
        continue;
      }

      await tx.editorialCatalogEntry.update({
        where: { catalogKey: entry.catalogKey },
        data: {
          bancaId: data.bancaId,
          orgao: data.orgao,
          title: data.title,
          cargo: data.cargo,
          especialidade: data.especialidade,
          ano: data.ano,
          edicao: data.edicao,
          nivel: data.nivel,
        },
      });
      summary.updated += 1;
    }
  });

  console.log("Catálogo editorial processado sem criar questões.");
  console.table({
    entradas: catalog.length,
    criados: summary.created,
    atualizados: summary.updated,
    ignorados: summary.ignored,
    bancasCriadas: summary.banksCreated,
  });
}

seedCatalog()
  .catch((error: unknown) => {
    console.error(
      "Falha ao cadastrar o catálogo editorial:",
      error instanceof Error ? error.message : String(error),
    );
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
