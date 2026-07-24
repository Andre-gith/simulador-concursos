import { NextResponse } from "next/server";
import { z } from "zod";

import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";

const startAttemptSchema = z
  .object({
    concursoId: z.string().trim().min(1),
    questionCount: z.number().int().positive(),
    subjectIds: z.array(z.string().trim().min(1)).min(1),
    durationMinutes: z.number().int().positive().nullable().optional(),
  })
  .strict();

function shuffle<T>(items: T[]): T[] {
  const shuffledItems = [...items];

  for (let index = shuffledItems.length - 1; index > 0; index -= 1) {
    const randomIndex = Math.floor(Math.random() * (index + 1));
    [shuffledItems[index], shuffledItems[randomIndex]] = [
      shuffledItems[randomIndex],
      shuffledItems[index],
    ];
  }

  return shuffledItems;
}

export async function POST(request: Request) {
  try {
    const session = await auth();
    if (!session?.user.id) {
      return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
    }
    let requestBody: unknown;

    try {
      requestBody = await request.json();
    } catch {
      return NextResponse.json(
        { error: "O corpo da requisição deve conter JSON válido." },
        { status: 400 },
      );
    }

    const parsedBody = startAttemptSchema.safeParse(requestBody);

    if (!parsedBody.success) {
      return NextResponse.json(
        { error: "Os dados para iniciar o simulado são inválidos." },
        { status: 400 },
      );
    }

    const { concursoId, questionCount, subjectIds, durationMinutes } =
      parsedBody.data;
    const uniqueSubjectIds = new Set(subjectIds);

    if (uniqueSubjectIds.size !== subjectIds.length) {
      return NextResponse.json(
        { error: "A lista de matérias contém IDs duplicados." },
        { status: 400 },
      );
    }

    const concurso = await prisma.concurso.findFirst({
      where: {
        id: concursoId,
        status: "PUBLISHED",
      },
      select: {
        id: true,
        orgao: true,
        cargo: true,
        scoringRule: {
          select: {
            id: true,
          },
        },
        questions: {
          where: {
            status: "PUBLISHED",
            subjectId: {
              in: subjectIds,
            },
          },
          select: {
            id: true,
            subjectId: true,
          },
        },
      },
    });

    if (!concurso) {
      return NextResponse.json(
        { error: "Concurso publicado não encontrado." },
        { status: 404 },
      );
    }

    if (!concurso.scoringRule) {
      return NextResponse.json(
        {
          error:
            "A regra de pontuação do concurso ainda não foi configurada.",
        },
        { status: 400 },
      );
    }

    const availableSubjectIds = new Set(
      concurso.questions.map((question) => question.subjectId),
    );
    const hasInvalidSubject = subjectIds.some(
      (subjectId) => !availableSubjectIds.has(subjectId),
    );

    if (hasInvalidSubject) {
      return NextResponse.json(
        {
          error:
            "Uma ou mais matérias não pertencem ao concurso ou não possuem questões publicadas.",
        },
        { status: 400 },
      );
    }

    if (questionCount > concurso.questions.length) {
      return NextResponse.json(
        {
          error: `Existem apenas ${concurso.questions.length} questões disponíveis para as matérias selecionadas.`,
        },
        { status: 400 },
      );
    }

    const selectedQuestions = shuffle(concurso.questions).slice(
      0,
      questionCount,
    );

    const attempt = await prisma.$transaction(async (transaction) => {
      const simulatedExam = await transaction.simulatedExam.create({
        data: {
          title: `${concurso.orgao} — ${concurso.cargo}`,
          concursoId: concurso.id,
          durationMinutes: durationMinutes ?? null,
          questions: {
            create: selectedQuestions.map((question, index) => ({
              questionId: question.id,
              order: index + 1,
            })),
          },
        },
        select: {
          id: true,
        },
      });

      return transaction.attempt.create({
        data: {
          userId: session.user.id,
          simulatedExamId: simulatedExam.id,
        },
        select: {
          id: true,
        },
      });
    });

    return NextResponse.json(
      {
        attemptId: attempt.id,
      },
      {
        status: 201,
      },
    );
  } catch (error) {
    console.error("Erro ao iniciar simulado:", error);

    return NextResponse.json(
      {
        error: "Não foi possível iniciar o simulado.",
      },
      {
        status: 500,
      },
    );
  }
}
