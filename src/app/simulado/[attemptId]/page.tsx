import { notFound, redirect } from "next/navigation";

import { prisma } from "@/lib/prisma";
import { getAttemptTiming } from "@/lib/attemptTiming";
import { auth } from "@/auth";
import { AppShell } from "@/components/layout/AppShell";
import SimuladoClient, {
  type SimuladoQuestion,
} from "./SimuladoClient";

export const dynamic = "force-dynamic";

type SimuladoPageProps = {
  params: Promise<{
    attemptId: string;
  }>;
};

export default async function SimuladoPage({
  params,
}: SimuladoPageProps) {
  const { attemptId } = await params;
  const session = await auth();
  if (!session?.user.id) redirect("/login");

  const attempt = await prisma.attempt.findUnique({
    where: {
      id: attemptId,
    },
    select: {
      id: true,
      userId: true,
      startedAt: true,
      finishedAt: true,
      simulatedExam: {
        select: {
          title: true,
          durationMinutes: true,
          questions: {
            orderBy: {
              order: "asc",
            },
            select: {
              order: true,
              question: {
                select: {
                  id: true,
                  type: true,
                  statement: true,
                  subject: {
                    select: {
                      name: true,
                    },
                  },
                  topic: {
                    select: {
                      name: true,
                    },
                  },
                  alternatives: {
                    orderBy: {
                      letter: "asc",
                    },
                    select: {
                      id: true,
                      letter: true,
                      text: true,
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
    notFound();
  }
  if (attempt.userId !== session.user.id) notFound();

  if (attempt.finishedAt) {
    redirect(`/resultado/${attempt.id}`);
  }

  const questions: SimuladoQuestion[] =
    attempt.simulatedExam.questions.map((item) => ({
      id: item.question.id,
      order: item.order,
      type: item.question.type,
      statement: item.question.statement,
      subject: item.question.subject.name,
      topic: item.question.topic?.name ?? null,
      alternatives: item.question.alternatives.map((alternative) => ({
        id: alternative.id,
        letter: alternative.letter,
        text: alternative.text,
      })),
    }));
  const serverNow = new Date();
  const timing = getAttemptTiming(
    attempt.startedAt,
    attempt.simulatedExam.durationMinutes,
    serverNow,
  );

  return (
    <AppShell
      isAuthenticated
      isAdmin={session.user.role === "ADMIN"}
    >
    <SimuladoClient
      attemptId={attempt.id}
      title={attempt.simulatedExam.title}
      questions={questions}
      serverNow={serverNow.toISOString()}
      expiresAt={timing.expiresAt?.toISOString() ?? null}
    />
    </AppShell>
  );
}
