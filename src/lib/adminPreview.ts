import { Prisma } from "@prisma/client";

export const adminCandidatePreviewSelect =
  Prisma.validator<Prisma.ConcursoSelect>()({
    id: true,
    orgao: true,
    cargo: true,
    especialidade: true,
    status: true,
    banca: { select: { name: true } },
    questions: {
      where: { status: { in: ["DRAFT", "IN_REVIEW"] } },
      orderBy: [{ paper: { code: "asc" } }, { number: "asc" }],
      select: {
        id: true,
        number: true,
        type: true,
        statement: true,
        sourcePage: true,
        requiresVisualReview: true,
        subject: { select: { name: true } },
        topic: { select: { name: true } },
        block: { select: { name: true } },
        paper: { select: { code: true } },
        alternatives: {
          orderBy: { letter: "asc" },
          select: {
            id: true,
            letter: true,
            text: true,
            isVisual: true,
            visualAssetPath: true,
            sourcePage: true,
          },
        },
      },
    },
  });
