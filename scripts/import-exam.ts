import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

import { Prisma, PrismaClient } from "@prisma/client";

import {
  examImportSchema,
  formatImportValidationErrors,
  type ExamImportDocument,
} from "../src/lib/import/exam-schema";
import { executeExamImport } from "../src/lib/import/exam-import-runner";

function printUsage() {
  console.log(
    "Uso: npm run import:exam -- <arquivo.json> [--dry-run]",
  );
}

async function readDocument(filePath: string): Promise<unknown> {
  let contents: string;

  try {
    contents = await readFile(filePath, "utf8");
  } catch (error) {
    throw new Error(
      `Não foi possível ler o arquivo "${filePath}": ${
        error instanceof Error ? error.message : "erro desconhecido"
      }`,
    );
  }

  try {
    return JSON.parse(contents) as unknown;
  } catch (error) {
    throw new Error(
      `O arquivo não contém JSON válido: ${
        error instanceof Error ? error.message : "erro desconhecido"
      }`,
    );
  }
}

async function importDocument(
  prisma: PrismaClient,
  document: ExamImportDocument,
) {
  return prisma.$transaction(async (transaction) => {
    const banca = await transaction.banca.upsert({
      where: { name: document.contest.board },
      update: {},
      create: { name: document.contest.board },
    });

    const existingConcurso = await transaction.concurso.findFirst({
      where: {
        bancaId: banca.id,
        orgao: document.contest.agency,
        cargo: document.contest.position,
        ano: document.contest.year,
        edicao: document.contest.edition ?? null,
        especialidade: document.contest.specialty ?? null,
      },
    });

    if (
      existingConcurso?.status === "PUBLISHED" ||
      existingConcurso?.status === "ARCHIVED"
    ) {
      throw new Error(
        `O concurso existente está ${existingConcurso.status} e não pode ser sobrescrito pelo importador.`,
      );
    }

    const concursoData = {
      bancaId: banca.id,
      orgao: document.contest.agency,
      cargo: document.contest.position,
      ano: document.contest.year,
      edicao: document.contest.edition ?? null,
      especialidade: document.contest.specialty ?? null,
      nivel: document.contest.educationLevel ?? null,
      dataProva: document.paper.appliedAt
        ? new Date(document.paper.appliedAt)
        : null,
      editalUrl: document.contest.noticeUrl ?? null,
      officialPageUrl: document.contest.officialPageUrl ?? null,
      status: "IN_REVIEW" as const,
    };

    const concurso = existingConcurso
      ? await transaction.concurso.update({
          where: { id: existingConcurso.id },
          data: concursoData,
        })
      : await transaction.concurso.create({ data: concursoData });

    await transaction.scoringRule.upsert({
      where: { concursoId: concurso.id },
      update: document.scoringRule,
      create: {
        concursoId: concurso.id,
        ...document.scoringRule,
      },
    });

    const paper = await transaction.examPaper.upsert({
      where: {
        concursoId_code: {
          concursoId: concurso.id,
          code: document.paper.code,
        },
      },
      update: {
        title: document.contest.edition ?? document.paper.code,
        appliedAt: document.paper.appliedAt
          ? new Date(document.paper.appliedAt)
          : null,
        provaUrl: document.paper.examUrl ?? null,
        gabaritoUrl: document.paper.answerKeyUrl ?? null,
      },
      create: {
        concursoId: concurso.id,
        code: document.paper.code,
        title: document.contest.edition ?? document.paper.code,
        appliedAt: document.paper.appliedAt
          ? new Date(document.paper.appliedAt)
          : null,
        provaUrl: document.paper.examUrl ?? null,
        gabaritoUrl: document.paper.answerKeyUrl ?? null,
      },
    });

    const blockIds = new Map<string, string>();
    for (const block of document.blocks) {
      const savedBlock = await transaction.examBlock.upsert({
        where: {
          concursoId_name: {
            concursoId: concurso.id,
            name: block.name,
          },
        },
        update: {
          order: block.order,
          minimumScore: block.minimumScore ?? null,
          minimumCorrect: block.minimumCorrect ?? null,
        },
        create: {
          concursoId: concurso.id,
          name: block.name,
          order: block.order,
          minimumScore: block.minimumScore ?? null,
          minimumCorrect: block.minimumCorrect ?? null,
        },
      });
      blockIds.set(block.name, savedBlock.id);
    }

    const subjectIds = new Map<string, string>();
    const topicIds = new Map<string, string>();
    for (const subject of document.subjects) {
      const savedSubject = await transaction.subject.upsert({
        where: { name: subject.name },
        update: {},
        create: { name: subject.name },
      });
      subjectIds.set(subject.name, savedSubject.id);

      for (const topic of subject.topics) {
        const savedTopic = await transaction.topic.upsert({
          where: {
            subjectId_name: {
              subjectId: savedSubject.id,
              name: topic,
            },
          },
          update: {},
          create: {
            subjectId: savedSubject.id,
            name: topic,
          },
        });
        topicIds.set(`${subject.name}\u0000${topic}`, savedTopic.id);
      }
    }

    let createdQuestions = 0;
    let updatedQuestions = 0;
    let unchangedQuestions = 0;
    let preservedReviewedQuestions = 0;

    for (const question of document.questions) {
      const subjectId = subjectIds.get(question.subject);
      if (!subjectId) {
        throw new Error(`Matéria não resolvida: ${question.subject}.`);
      }

      const topicId = question.topic
        ? topicIds.get(`${question.subject}\u0000${question.topic}`)
        : undefined;
      const blockId = question.block
        ? blockIds.get(question.block)
        : undefined;
      const alternatives =
        question.type === "MC"
          ? question.alternatives.map((alternative) => ({
              letter: alternative.letter.toUpperCase(),
              text: alternative.text,
              isCorrect: alternative.isCorrect,
              isVisual: alternative.isVisual,
              visualAssetPath: alternative.visualAssetPath ?? null,
              visualDescription: alternative.visualDescription ?? null,
              sourcePage: alternative.sourcePage ?? null,
            }))
          : [];

      const questionData = {
        concursoId: concurso.id,
        paperId: paper.id,
        blockId: blockId ?? null,
        subjectId,
        topicId: topicId ?? null,
        number: question.number,
        type: question.type,
        statement: question.statement,
        ceAnswer: question.type === "CE" ? question.ceAnswer : null,
        weight: question.weight,
        sourceUrl: question.sourceUrl ?? null,
        sourcePage: question.sourcePage ?? null,
        requiresVisualReview: question.requiresVisualReview,
        visualReviewResolved: false,
        textReviewed: false,
        alternativesReviewed: false,
        answerKeyReviewed: false,
        annulmentStatus: "PENDING" as const,
        status: "IN_REVIEW" as const,
      };

      const existingQuestion = await transaction.question.findFirst({
        where: {
          paperId: paper.id,
          number: question.number,
        },
        include: {
          alternatives: { orderBy: { letter: "asc" } },
        },
      });

      if (existingQuestion) {
        const hasEditorialProgress =
          existingQuestion.status !== "IN_REVIEW" ||
          existingQuestion.textReviewed ||
          existingQuestion.alternativesReviewed ||
          existingQuestion.answerKeyReviewed ||
          existingQuestion.visualReviewResolved ||
          existingQuestion.annulmentStatus !== "PENDING" ||
          existingQuestion.reviewedAt !== null;

        const sortedAlternatives = [...alternatives].sort((left, right) =>
          left.letter.localeCompare(right.letter),
        );
        const isUnchanged =
          existingQuestion.concursoId === questionData.concursoId &&
          existingQuestion.paperId === questionData.paperId &&
          existingQuestion.blockId === questionData.blockId &&
          existingQuestion.subjectId === questionData.subjectId &&
          existingQuestion.topicId === questionData.topicId &&
          existingQuestion.number === questionData.number &&
          existingQuestion.type === questionData.type &&
          existingQuestion.statement === questionData.statement &&
          existingQuestion.ceAnswer === questionData.ceAnswer &&
          existingQuestion.weight === questionData.weight &&
          existingQuestion.sourceUrl === questionData.sourceUrl &&
          existingQuestion.sourcePage === questionData.sourcePage &&
          existingQuestion.requiresVisualReview ===
            questionData.requiresVisualReview &&
          existingQuestion.alternatives.length === sortedAlternatives.length &&
          existingQuestion.alternatives.every((current, index) => {
            const expected = sortedAlternatives[index];
            return (
              expected !== undefined &&
              current.letter === expected.letter &&
              current.text === expected.text &&
              current.isCorrect === expected.isCorrect &&
              current.isVisual === expected.isVisual &&
              current.visualAssetPath === expected.visualAssetPath &&
              current.visualDescription === expected.visualDescription &&
              current.sourcePage === expected.sourcePage
            );
          });

        if (isUnchanged) {
          unchangedQuestions += 1;
          continue;
        }

        if (hasEditorialProgress) {
          preservedReviewedQuestions += 1;
          console.warn(
            `Questão ${question.number} preservada: há revisão editorial ou status posterior à importação.`,
          );
          continue;
        }

        await transaction.alternative.deleteMany({
          where: { questionId: existingQuestion.id },
        });
        await transaction.question.update({
          where: { id: existingQuestion.id },
          data: {
            ...questionData,
            alternatives:
              alternatives.length > 0
                ? { create: alternatives }
                : undefined,
          },
        });
        updatedQuestions += 1;
      } else {
        await transaction.question.create({
          data: {
            ...questionData,
            alternatives:
              alternatives.length > 0
                ? { create: alternatives }
                : undefined,
          },
        });
        createdQuestions += 1;
      }
    }

    return {
      concursoId: concurso.id,
      paperId: paper.id,
      createdQuestions,
      updatedQuestions,
      unchangedQuestions,
      preservedReviewedQuestions,
    };
  }, {
    isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
  });
}

async function main() {
  const argumentsList = process.argv.slice(2);
  const dryRun = argumentsList.includes("--dry-run");
  const positionalArguments = argumentsList.filter(
    (argument) => argument !== "--dry-run",
  );

  if (positionalArguments.length !== 1) {
    printUsage();
    process.exitCode = 1;
    return;
  }

  const filePath = resolve(positionalArguments[0]);
  if (filePath.toLowerCase().endsWith(".template.json")) {
    throw new Error(
      "Arquivos .template.json não podem ser importados. Copie o template, preencha todos os campos confirmados pelos documentos oficiais e remova o sufixo .template antes de validar.",
    );
  }
  const rawDocument = await readDocument(filePath);
  const validation = examImportSchema.safeParse(rawDocument);

  if (!validation.success) {
    console.error("Importação cancelada. Corrija os seguintes erros:");
    for (const error of formatImportValidationErrors(validation.error)) {
      console.error(`- ${error}`);
    }
    process.exitCode = 1;
    return;
  }

  const execution = await executeExamImport(validation.data, {
    dryRun,
    async persist(document) {
      const prisma = new PrismaClient();
      try {
        return await importDocument(prisma, document);
      } finally {
        await prisma.$disconnect();
      }
    },
  });

  console.log(dryRun ? "Resumo do dry-run:" : "Resumo validado:");
  console.table(execution.summary);

  if (execution.kind === "dry-run") {
    console.log("Dry-run concluído. Nenhum dado foi gravado.");
    return;
  }

  console.log("Importação concluída em uma transação.");
  console.table(execution.result);
}

main().catch((error) => {
  console.error(
    `Importação cancelada sem gravações parciais: ${
      error instanceof Error ? error.message : "erro desconhecido"
    }`,
  );
  process.exitCode = 1;
});
