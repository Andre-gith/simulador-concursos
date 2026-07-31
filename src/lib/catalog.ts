export type CatalogStatus =
  | "DRAFT"
  | "IN_REVIEW"
  | "PUBLISHED"
  | "ARCHIVED";

export type CatalogLevel =
  | "FUNDAMENTAL"
  | "MEDIO"
  | "TECNICO"
  | "SUPERIOR"
  | null;

export type CatalogContest = {
  id: string;
  institution: string;
  position: string;
  specialty: string | null;
  board: string;
  edition: string | null;
  year: number | null;
  level: CatalogLevel;
  status: CatalogStatus;
  hasScoringRule: boolean;
  publishedQuestionCount: number;
  subjects: string[];
  scoringType: "CE_PENALTY" | "MC_NO_PENALTY" | "MC_NEGATIVE" | null;
  pointsCorrect: number | null;
  pointsWrong: number | null;
  floorAtZero: boolean | null;
  trustLevel?: "COMMUNITY_UNVERIFIED" | "COMMUNITY_CORROBORATED" | "OFFICIAL_LINK_FOUND" | "OFFICIAL_CONFIRMED" | "ADMIN_CONFIRMED";
};

export type CatalogFilter =
  | "all"
  | "available"
  | "preparing"
  | "cesgranrio"
  | "cebraspe"
  | "fgv"
  | "mid-level"
  | "higher-level";

type CatalogIdentity = {
  institution: string;
  position: string | null;
  specialty: string | null;
};

export function hasSameCatalogIdentity(
  left: CatalogIdentity,
  right: CatalogIdentity,
) {
  const identityPart = (value: string | null) =>
    (value ?? "").normalize("NFC").trim().toLocaleLowerCase("pt-BR");
  const leftPosition = identityPart(left.position);
  const rightPosition = identityPart(right.position);
  const leftSpecialty = identityPart(left.specialty);
  const rightSpecialty = identityPart(right.specialty);

  return (
    identityPart(left.institution) === identityPart(right.institution) &&
    leftSpecialty === rightSpecialty &&
    (leftPosition === rightPosition ||
      (Boolean(leftSpecialty) && (!leftPosition || !rightPosition)))
  );
}

export function isAvailableContest(contest: CatalogContest) {
  return (
    contest.status === "PUBLISHED" &&
    contest.hasScoringRule &&
    contest.publishedQuestionCount > 0
  );
}

export function isPreparingContest(contest: CatalogContest) {
  return contest.status !== "ARCHIVED" && !isAvailableContest(contest);
}

function normalized(value: string | null) {
  return (value ?? "")
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLocaleLowerCase("pt-BR");
}

export function matchesCatalogSearch(
  contest: CatalogContest,
  query: string,
) {
  const search = normalized(query.trim());
  if (!search) return true;

  return [
    contest.institution,
    contest.position,
    contest.specialty,
    contest.board,
    contest.edition,
    contest.year === null ? null : String(contest.year),
  ].some((value) => normalized(value).includes(search));
}

export function matchesCatalogFilter(
  contest: CatalogContest,
  filter: CatalogFilter,
) {
  if (filter === "all") return true;
  if (filter === "available") return isAvailableContest(contest);
  if (filter === "preparing") return isPreparingContest(contest);
  if (filter === "mid-level") {
    return contest.level === "MEDIO" || contest.level === "TECNICO";
  }
  if (filter === "higher-level") return contest.level === "SUPERIOR";

  return normalized(contest.board) === filter;
}

export function filterCatalog(
  contests: CatalogContest[],
  query: string,
  filter: CatalogFilter,
) {
  return contests.filter(
    (contest) =>
      matchesCatalogSearch(contest, query) &&
      matchesCatalogFilter(contest, filter),
  );
}

export function parseCatalogFilter(value: string | undefined): CatalogFilter {
  const filters: CatalogFilter[] = [
    "all",
    "available",
    "preparing",
    "cesgranrio",
    "cebraspe",
    "fgv",
    "mid-level",
    "higher-level",
  ];
  return filters.includes(value as CatalogFilter)
    ? (value as CatalogFilter)
    : "all";
}

export function describeScoringRule(contest: CatalogContest) {
  if (!contest.hasScoringRule) return "Regra em configuração";
  if (contest.scoringType === "CE_PENALTY") {
    return contest.pointsWrong !== null && contest.pointsWrong < 0
      ? "Certo/Errado com penalidade por erro"
      : "Certo/Errado sem penalidade";
  }
  if (contest.scoringType === "MC_NEGATIVE") {
    return "Múltipla escolha com penalidade";
  }
  return "Múltipla escolha sem penalidade";
}

export function describeLevel(level: CatalogLevel) {
  const labels: Record<Exclude<CatalogLevel, null>, string> = {
    FUNDAMENTAL: "Nível fundamental",
    MEDIO: "Nível médio",
    TECNICO: "Nível técnico",
    SUPERIOR: "Nível superior",
  };
  return level ? labels[level] : "Nível não informado";
}
