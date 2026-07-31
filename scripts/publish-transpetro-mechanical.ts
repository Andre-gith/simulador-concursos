import { readFile } from "node:fs/promises";

import {
  AnnulmentStatus,
  Prisma,
  PrismaClient,
  PublicationStatus,
} from "@prisma/client";

import { examImportSchema } from "../src/lib/examImportSchema";
import {
  validateContestForPublication,
  validateQuestionForPublication,
} from "../src/lib/publication";

const prisma = new PrismaClient();
const specialty = "Manutenção | Mecânica";
const paperCode = "PROVA-9-MANUTENCAO-MECANICA";

async function main() {
  const apply = process.argv.includes("--apply");
  const document = examImportSchema.parse(
    JSON.parse(
      await readFile(
        "data/imports/transpetro/manutencao-mecanica/exam.json",
        "utf8",
      ),
    ),
  );
  const contest = await prisma.concurso.findFirstOrThrow({
    where: {
      orgao: "Transpetro",
      especialidade: specialty,
      ano: 2023,
    },
    include: {
      scoringRule: true,
      papers: true,
      questions: {
        orderBy: { number: "asc" },
        include: {
          alternatives: { orderBy: { letter: "asc" } },
          visualAssets: { orderBy: { order: "asc" } },
          paper: { select: { provaUrl: true, code: true } },
        },
      },
    },
  });
  if (
    contest.questions.length !== 60 ||
    contest.papers.length !== 1 ||
    contest.papers[0]?.code !== paperCode
  ) {
    throw new Error("Concurso, caderno ou quantidade de questões incompatível.");
  }
  const mismatches: string[] = [];
  for (const question of contest.questions) {
    const source = document.questions.find(
      (candidate) => candidate.number === question.number,
    );
    if (
      !source ||
      source.type !== "MC" ||
      question.type !== "MC" ||
      question.statement !== source.statement ||
      question.sourcePage !== source.sourcePage ||
      question.sourceUrl !== source.sourceUrl ||
      question.weight !== source.weight ||
      question.paper?.code !== paperCode ||
      question.alternatives.length !== source.alternatives.length ||
      question.alternatives.some((alternative, index) => {
        const expected = source.alternatives[index];
        return (
          alternative.letter !== expected?.letter ||
          alternative.text !== expected.text ||
          alternative.isCorrect !== expected.isCorrect
        );
      }) ||
      question.visualAssets.length !== source.visualAssets.length
    ) {
      mismatches.push(`Questão ${question.number}: divergência documental.`);
    }
  }
  const report = {
    contestId: contest.id,
    mode: apply ? "apply" : "dry-run",
    questions: contest.questions.length,
    visualQuestions: contest.questions
      .filter(({ requiresVisualReview }) => requiresVisualReview)
      .map(({ number }) => number),
    mismatches,
  };
  console.log(JSON.stringify(report, null, 2));
  if (mismatches.length > 0) {
    throw new Error("A auditoria encontrou divergências.");
  }
  if (!apply) return;

  const result = await prisma.$transaction(
    async (transaction) => {
      const now = new Date();
      await transaction.question.updateMany({
        where: {
          concursoId: contest.id,
          status: PublicationStatus.IN_REVIEW,
        },
        data: {
          textReviewed: true,
          alternativesReviewed: true,
          answerKeyReviewed: true,
          annulmentStatus: AnnulmentStatus.NOT_ANNULLED,
          visualReviewResolved: true,
          reviewedAt: now,
          status: PublicationStatus.PUBLISHED,
          publishedAt: now,
        },
      });
      const refreshed = await transaction.concurso.findUniqueOrThrow({
        where: { id: contest.id },
        include: {
          scoringRule: true,
          questions: {
            include: {
              alternatives: true,
              visualAssets: true,
              paper: { select: { provaUrl: true } },
            },
          },
        },
      });
      const questionIssues = refreshed.questions.flatMap((question) =>
        validateQuestionForPublication(question),
      );
      const contestIssues = validateContestForPublication(refreshed);
      if (questionIssues.length > 0 || contestIssues.length > 0) {
        throw new Error(
          JSON.stringify({ questionIssues, contestIssues }, null, 2),
        );
      }
      await transaction.concurso.update({
        where: {
          id: contest.id,
          status: PublicationStatus.IN_REVIEW,
        },
        data: { status: PublicationStatus.PUBLISHED },
      });
      return {
        contestId: contest.id,
        questionsPublished: refreshed.questions.length,
        status: PublicationStatus.PUBLISHED,
      };
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
  );
  console.log(JSON.stringify(result, null, 2));
}

main()
  .catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
