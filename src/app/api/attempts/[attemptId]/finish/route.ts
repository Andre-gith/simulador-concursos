import { Prisma } from "@prisma/client";
import { NextResponse } from "next/server";
import { z } from "zod";

import { prisma } from "@/lib/prisma";
import { getAttemptTiming } from "@/lib/attemptTiming";
import { auth } from "@/auth";
import {
  scoreAttempt,
  type AttemptAnswerInput,
  type ScoringRule as EngineScoringRule,
} from "@/lib/scoring";

const finishAttemptSchema = z
  .object({
    answers: z.array(
      z
        .object({
          questionId: z.string().trim().min(1),
          userAnswer: z.string(),
        })
        .strict(),
    ),
  })
  .strict();

type FinishRouteContext = {
  params: Promise<{
    attemptId: string;
  }>;
};

class RequestError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

class TransactionConflictError extends Error {}

function isTransactionConflict(error: unknown): boolean {
  return (
    error instanceof TransactionConflictError ||
    (error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2034")
  );
}

async function finishAttemptTransaction(
  attemptId: string,
  userId: string,
  submittedAnswers: Array<{
    questionId: string;
    userAnswer: string;
  }>,
) {
  return prisma.$transaction(
    async (transaction) => {
      const attempt = await transaction.attempt.findUnique({
        where: {
          id: attemptId,
        },
        select: {
          id: true,
          userId: true,
          finishedAt: true,
          finishReason: true,
          startedAt: true,
          totalScore: true,
          simulatedExam: {
            select: {
              durationMinutes: true,
              concurso: {
                select: {
                  scoringRule: true,
                },
              },
              questions: {
                orderBy: {
                  order: "asc",
                },
                select: {
                  question: {
                    select: {
                      id: true,
                      type: true,
                      ceAnswer: true,
                      weight: true,
                      alternatives: {
                        select: {
                          letter: true,
                          isCorrect: true,
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      });

      if (!attempt) {
        throw new RequestError("Tentativa não encontrada.", 404);
      }
      if (attempt.userId !== userId) {
        throw new RequestError("Você não pode acessar esta tentativa.", 403);
      }

      if (attempt.finishedAt) {
        return {
          attemptId: attempt.id,
          totalScore: attempt.totalScore ?? 0,
          alreadyFinished: true,
          finishReason: attempt.finishReason ?? "MANUAL",
        };
      }

      const databaseRule = attempt.simulatedExam.concurso?.scoringRule;

      if (!databaseRule) {
        throw new RequestError(
          "A regra de pontuação do concurso não foi encontrada.",
          400,
        );
      }

      if (
        submittedAnswers.length !==
        attempt.simulatedExam.questions.length
      ) {
        throw new RequestError(
          "Envie exatamente uma resposta para cada questão da tentativa.",
          400,
        );
      }

      const answerMap = new Map<string, string>();

      for (const answer of submittedAnswers) {
        if (answerMap.has(answer.questionId)) {
          throw new RequestError(
            "Existem respostas duplicadas para a mesma questão.",
            400,
          );
        }

        answerMap.set(
          answer.questionId,
          answer.userAnswer.trim().toUpperCase(),
        );
      }

      const attemptQuestionIds = new Set(
        attempt.simulatedExam.questions.map(
          ({ question }) => question.id,
        ),
      );

      for (const questionId of answerMap.keys()) {
        if (!attemptQuestionIds.has(questionId)) {
          throw new RequestError(
            "Uma das questões não pertence a esta tentativa.",
            400,
          );
        }
      }

      const engineRule: EngineScoringRule = {
        type: databaseRule.type,
        pointsCorrect: databaseRule.pointsCorrect,
        pointsWrong: databaseRule.pointsWrong,
        pointsBlank: databaseRule.pointsBlank,
        floorAtZero: databaseRule.floorAtZero,
      };

      const preparedAnswers: Array<{
        questionId: string;
        userAnswer: string;
        isCorrect: boolean | null;
        scoreInput: AttemptAnswerInput;
      }> = [];

      for (const { question } of attempt.simulatedExam.questions) {
        const userAnswer = answerMap.get(question.id);

        if (userAnswer === undefined) {
          throw new RequestError(
            "Falta a resposta de uma questão da tentativa.",
            400,
          );
        }

        if (!Number.isFinite(question.weight) || question.weight <= 0) {
          throw new RequestError(
            `A questão ${question.id} possui peso inválido.`,
            422,
          );
        }

        if (question.type === "CE") {
          if (question.ceAnswer === null) {
            throw new RequestError(
              `A questão ${question.id} não possui gabarito Certo/Errado.`,
              422,
            );
          }

          if (!["", "C", "E"].includes(userAnswer)) {
            throw new RequestError(
              "Uma resposta de Certo ou Errado possui valor inválido.",
              400,
            );
          }

          preparedAnswers.push({
            questionId: question.id,
            userAnswer,
            isCorrect:
              userAnswer === ""
                ? null
                : (userAnswer === "C") === question.ceAnswer,
            scoreInput: {
              userAnswer,
              weight: question.weight,
              question: {
                type: "CE",
                correctAnswer: question.ceAnswer,
              },
            },
          });

          continue;
        }

        const normalizedAlternatives = question.alternatives.map(
          (alternative) => ({
            ...alternative,
            letter: alternative.letter.trim().toUpperCase(),
          }),
        );
        const correctAlternatives = normalizedAlternatives.filter(
          (alternative) => alternative.isCorrect,
        );

        if (correctAlternatives.length !== 1) {
          throw new RequestError(
            `A questão ${question.id} deve possuir exatamente uma alternativa correta.`,
            422,
          );
        }

        const allowedAnswers = new Set([
          "",
          ...normalizedAlternatives.map(
            (alternative) => alternative.letter,
          ),
        ]);

        if (!allowedAnswers.has(userAnswer)) {
          throw new RequestError(
            "Uma resposta de múltipla escolha possui valor inválido.",
            400,
          );
        }

        const correctLetter = correctAlternatives[0].letter;

        preparedAnswers.push({
          questionId: question.id,
          userAnswer,
          isCorrect:
            userAnswer === "" ? null : userAnswer === correctLetter,
          scoreInput: {
            userAnswer,
            weight: question.weight,
            question: {
              type: "MC",
              correctLetter,
            },
          },
        });
      }

      const scoreResult = scoreAttempt(
        preparedAnswers.map((answer) => answer.scoreInput),
        engineRule,
      );
      const timing = getAttemptTiming(
        attempt.startedAt,
        attempt.simulatedExam.durationMinutes,
      );
      const finishReason = timing.isExpired
        ? "TIME_EXPIRED"
        : "MANUAL";

      const answerRows = preparedAnswers.map((answer, index) => {
        const breakdownItem = scoreResult.breakdown[index];

        if (!breakdownItem) {
          throw new Error(
            "O motor não retornou a pontuação de uma questão.",
          );
        }

        return {
          attemptId: attempt.id,
          questionId: answer.questionId,
          userAnswer: answer.userAnswer,
          isCorrect: answer.isCorrect,
          pointsEarned: breakdownItem.points,
        };
      });

      await transaction.attemptAnswer.createMany({
        data: answerRows,
      });

      const finalizedAttempt = await transaction.attempt.updateMany({
        where: {
          id: attempt.id,
          finishedAt: null,
        },
        data: {
          finishedAt: new Date(),
          totalScore: scoreResult.total,
          finishReason,
        },
      });

      if (finalizedAttempt.count !== 1) {
        throw new TransactionConflictError(
          "A tentativa foi finalizada por outra requisição.",
        );
      }

      return {
        attemptId: attempt.id,
        totalScore: scoreResult.total,
        alreadyFinished: false,
        finishReason,
      };
    },
    {
      isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
    },
  );
}

export async function POST(
  request: Request,
  context: FinishRouteContext,
) {
  const session = await auth();
  if (!session?.user.id) {
    return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  }
  const { attemptId: rawAttemptId } = await context.params;
  const attemptId = rawAttemptId.trim();

  if (!attemptId) {
    return NextResponse.json(
      { error: "O ID da tentativa é inválido." },
      { status: 400 },
    );
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

  const parsedBody = finishAttemptSchema.safeParse(requestBody);

  if (!parsedBody.success) {
    return NextResponse.json(
      { error: "As respostas enviadas são inválidas." },
      { status: 400 },
    );
  }

  try {
    const maximumAttempts = 3;

    for (let attemptNumber = 1; attemptNumber <= maximumAttempts; attemptNumber += 1) {
      try {
        const result = await finishAttemptTransaction(
          attemptId,
          session.user.id,
          parsedBody.data.answers,
        );

        return NextResponse.json(result);
      } catch (error) {
        if (
          !isTransactionConflict(error) ||
          attemptNumber === maximumAttempts
        ) {
          throw error;
        }

        console.warn("Conflito ao finalizar tentativa; repetindo transação.", {
          attemptId,
          attemptNumber,
        });
      }
    }

    throw new Error("A finalização não produziu resultado.");
  } catch (error) {
    if (error instanceof RequestError) {
      console.warn("Finalização de tentativa rejeitada.", {
        attemptId,
        status: error.status,
        reason: error.message,
      });

      return NextResponse.json(
        { error: error.message },
        { status: error.status },
      );
    }

    console.error("Erro inesperado ao finalizar tentativa.", {
      attemptId,
      error,
    });

    return NextResponse.json(
      { error: "Não foi possível finalizar o simulado." },
      { status: 500 },
    );
  }
}
