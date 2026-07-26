import { Prisma } from "@prisma/client";

export const publicContestDetailSelect =
  Prisma.validator<Prisma.ConcursoSelect>()({
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
      where: { status: { in: ["PUBLISHED", "IN_REVIEW"] } },
      select: {
        status: true,
        weight: true,
        subject: { select: { id: true, name: true } },
        block: { select: { id: true, name: true, order: true } },
      },
    },
  });

export function isContestAvailable(input: {
  status: "DRAFT" | "IN_REVIEW" | "PUBLISHED" | "ARCHIVED";
  hasScoringRule: boolean;
  publishedQuestionCount: number;
}) {
  return (
    input.status === "PUBLISHED" &&
    input.hasScoringRule &&
    input.publishedQuestionCount > 0
  );
}
