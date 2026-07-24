import {
  ImportStatus,
  Prisma,
  PrismaClient,
  PublicationStatus,
} from "@prisma/client";

import {
  formatImportValidationErrors,
  officialExamImportSchema,
  type OfficialExamImportDocument,
} from "./exam-schema";

export type OfficialSourceReferences = {
  exam: string;
  answerKey: string;
};

export type ImportResult = {
  concursoId: string;
  paperId: string;
  importJobId: string;
  createdQuestions: number;
  updatedQuestions: number;
};

export interface ExamImportPersistence {
  save(document: OfficialExamImportDocument): Promise<ImportResult>;
}

export class ExamDocumentValidationError extends Error {
  readonly issues: string[];

  constructor(issues: string[]) {
    super(`Documento estruturado inválido: ${issues.join(" | ")}`);
    this.name = "ExamDocumentValidationError";
    this.issues = issues;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * Referências de origem e status são controlados pelo servidor, não pelo
 * provider de IA.
 */
export function secureAiDocument(
  rawDocument: unknown,
  sources: OfficialSourceReferences,
): unknown {
  if (!isRecord(rawDocument)) return rawDocument;

  const rawPaper = isRecord(rawDocument.paper) ? rawDocument.paper : {};
  const rawQuestions = Array.isArray(rawDocument.questions)
    ? rawDocument.questions
    : rawDocument.questions;

  return {
    ...rawDocument,
    reviewStatus: PublicationStatus.IN_REVIEW,
    paper: {
      ...rawPaper,
      examUrl: sources.exam,
      answerKeyUrl: sources.answerKey,
    },
    questions: Array.isArray(rawQuestions)
      ? rawQuestions.map((question) =>
          isRecord(question)
            ? { ...question, sourceUrl: sources.exam }
            : question,
        )
      : rawQuestions,
  };
}

export class ExamImportService {
  constructor(private readonly persistence: ExamImportPersistence) {}

  async importAiDocument(
    rawDocument: unknown,
    sources: OfficialSourceReferences,
  ) {
    const securedDocument = secureAiDocument(rawDocument, sources);
    const validation = officialExamImportSchema.safeParse(securedDocument);

    if (!validation.success) {
      throw new ExamDocumentValidationError(
        formatImportValidationErrors(validation.error),
      );
    }

    return this.persistence.save(validation.data);
  }
}

export class PrismaExamImportPersistence implements ExamImportPersistence {
  constructor(private readonly prisma: PrismaClient) {}

  async save(document: OfficialExamImportDocument): Promise<ImportResult> {
    return this.prisma.$transaction(
      async (transaction) => persistDocument(transaction, document),
      {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
      },
    );
  }
}

async function persistDocument(
  transaction: Prisma.TransactionClient,
  document: OfficialExamImportDocument,
): Promise<ImportResult> {
  const examUrl = document.paper.examUrl;
  const answerKeyUrl = document.paper.answerKeyUrl;
  if (!examUrl || !answerKeyUrl) {
    throw new Error(
      "As referências oficiais da prova e do gabarito são obrigatórias.",
    );
  }

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
    status: PublicationStatus.IN_REVIEW,
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
    create: { concursoId: concurso.id, ...document.scoringRule },
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
      provaUrl: examUrl,
      gabaritoUrl: answerKeyUrl,
    },
    create: {
      concursoId: concurso.id,
      code: document.paper.code,
      title: document.contest.edition ?? document.paper.code,
      appliedAt: document.paper.appliedAt
        ? new Date(document.paper.appliedAt)
        : null,
      provaUrl: examUrl,
      gabaritoUrl: answerKeyUrl,
    },
  });

  const blockIds = new Map<string, string>();
  for (const block of document.blocks) {
    const saved = await transaction.examBlock.upsert({
      where: {
        concursoId_name: { concursoId: concurso.id, name: block.name },
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
    blockIds.set(block.name, saved.id);
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
          subjectId_name: { subjectId: savedSubject.id, name: topic },
        },
        update: {},
        create: { subjectId: savedSubject.id, name: topic },
      });
      topicIds.set(`${subject.name}\u0000${topic}`, savedTopic.id);
    }
  }

  let createdQuestions = 0;
  let updatedQuestions = 0;
  for (const question of document.questions) {
    const subjectId = subjectIds.get(question.subject);
    if (!subjectId) {
      throw new Error(`Matéria não resolvida: ${question.subject}.`);
    }
    const alternatives =
      question.type === "MC"
        ? question.alternatives.map((alternative) => ({
            letter: alternative.letter.toUpperCase(),
            text: alternative.text,
            isCorrect: alternative.isCorrect,
          }))
        : [];
    const questionData = {
      concursoId: concurso.id,
      paperId: paper.id,
      blockId: question.block
        ? (blockIds.get(question.block) ?? null)
        : null,
      subjectId,
      topicId: question.topic
        ? (topicIds.get(`${question.subject}\u0000${question.topic}`) ?? null)
        : null,
      number: question.number,
      type: question.type,
      statement: question.statement,
      ceAnswer: question.type === "CE" ? question.ceAnswer : null,
      weight: question.weight,
      sourceUrl: question.sourceUrl,
      sourcePage: question.sourcePage,
      status: PublicationStatus.IN_REVIEW,
    };
    const existing = await transaction.question.findFirst({
      where: { paperId: paper.id, number: question.number },
      select: { id: true },
    });

    if (existing) {
      await transaction.alternative.deleteMany({
        where: { questionId: existing.id },
      });
      await transaction.question.update({
        where: { id: existing.id },
        data: {
          ...questionData,
          alternatives:
            alternatives.length > 0 ? { create: alternatives } : undefined,
        },
      });
      updatedQuestions += 1;
    } else {
      await transaction.question.create({
        data: {
          ...questionData,
          alternatives:
            alternatives.length > 0 ? { create: alternatives } : undefined,
        },
      });
      createdQuestions += 1;
    }
  }

  const importJob = await transaction.importJob.create({
    data: {
      concursoId: concurso.id,
      pdfUrl: examUrl,
      gabaritoUrl: answerKeyUrl,
      status: ImportStatus.EXTRACTED,
      rawExtracted: document as Prisma.InputJsonValue,
    },
  });
  return {
    concursoId: concurso.id,
    paperId: paper.id,
    importJobId: importJob.id,
    createdQuestions,
    updatedQuestions,
  };
}
