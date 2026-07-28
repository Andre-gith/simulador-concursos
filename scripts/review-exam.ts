import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { createInterface } from "node:readline/promises";

import {
  AnnulmentStatus,
  Prisma,
  PrismaClient,
  PublicationStatus,
} from "@prisma/client";

import {
  examImportSchema,
  type ExamImportDocument,
} from "../src/lib/examImportSchema";
import { PdfParseTextExtractor } from "../src/lib/import/pdf-extractor";
import {
  validateContestForPublication,
  validateQuestionForPublication,
} from "../src/lib/publication";

type ReviewClassification =
  | "VERIFIED_AND_PUBLISHABLE"
  | "ALREADY_PUBLISHED"
  | "ARCHIVED"
  | "VISUAL_REVIEW_REQUIRED"
  | "SOURCE_MISMATCH"
  | "ANSWER_KEY_MISMATCH"
  | "ALTERNATIVES_MISMATCH"
  | "MISSING_SOURCE"
  | "ANNULLED"
  | "MANUAL_REVIEW_REQUIRED";

type ExtractionReview = {
  contestSpecialty: string;
  paperCode: string;
  sourceFile: string;
  requiresVisualReview: Array<{ question: number; page: number; reason: string }>;
  annulledQuestions: number[];
  divergences: Array<{ question?: number; reason: string }>;
  blockingIssues: Array<{ question?: number; reason: string }>;
};

type ReviewConfig = {
  contestId: string;
  specialty: string;
  paperCode: string;
  directory: string;
  examPdf: string;
  answerKeyPdf: string;
};

const CONFIGS: Record<string, ReviewConfig> = {
  cms16omz00002vpvk847qx2re: {
    contestId: "cms16omz00002vpvk847qx2re",
    specialty: "Agente de Tecnologia",
    paperCode: "MICRORREGIAO-158-TI-GABARITO-1",
    directory: "data/imports/banco-do-brasil/agente-tecnologia",
    examPdf:
      "AGENTE DE TECNOLOGIA - Microrregião 158 - TI - GABARITO 1.pdf",
    answerKeyPdf:
      "GABARITO - 23-04-2023 - PROVA - AGENTE DE TECNOLOGIA - MICRORREGIAO 158 - TI.pdf",
  },
  cms15wngw0002vpg0t03yq5tv: {
    contestId: "cms15wngw0002vpg0t03yq5tv",
    specialty: "Agente Comercial",
    paperCode: "PROVA-A-AGENTE-COMERCIAL-GABARITO-1",
    directory: "data/imports/banco-do-brasil/agente-comercial",
    examPdf: "PROVA A - AGENTE COMERCIAL - GABARITO 1.pdf",
    answerKeyPdf:
      "GABARITO - 23-04-2023 - PROVA A - ESCRITURÁRIO - AGENTE COMERCIAL.pdf",
  },
};

const questionInclude = {
  alternatives: { orderBy: { letter: "asc" as const } },
  subject: true,
  block: true,
  paper: true,
  visualAssets: { orderBy: { order: "asc" as const } },
} satisfies Prisma.QuestionInclude;

type DatabaseQuestion = Prisma.QuestionGetPayload<{
  include: typeof questionInclude;
}>;

type AuditItem = {
  id: string;
  number: number | null;
  classification: ReviewClassification;
  reasons: string[];
};

function normalize(value: string) {
  return value
    .normalize("NFKD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/[^\p{Letter}\p{Number}]+/gu, "")
    .toLocaleLowerCase("pt-BR");
}

function parsePages(text: string) {
  const pages = new Map<number, string>();
  const matches = [
    ...text.matchAll(/--- PÁGINA (\d+) ---\s*([\s\S]*?)(?=--- PÁGINA \d+ ---|$)/g),
  ];
  for (const match of matches) {
    pages.set(Number(match[1]), match[2]);
  }
  return pages;
}

function officialAnswerKeys(answerKeyText: string) {
  const firstPage = parsePages(answerKeyText).get(1) ?? "";
  const compact = firstPage.replace(/\s+/g, "");
  const keys = new Map<number, string>();
  for (const match of compact.matchAll(/(\d{1,2})-([A-E])/g)) {
    const number = Number(match[1]);
    if (number >= 1 && number <= 70) keys.set(number, match[2]);
  }
  return keys;
}

function hash(buffer: Buffer) {
  return createHash("sha256").update(buffer).digest("hex");
}

function matchingQuestion(
  document: ExamImportDocument,
  number: number | null,
) {
  return document.questions.find((question) => question.number === number);
}

function auditQuestion(input: {
  database: DatabaseQuestion;
  document: ExamImportDocument;
  extractionReview: ExtractionReview;
  examPages: Map<number, string>;
  answerKeys: Map<number, string>;
  expectedPaperCode: string;
}): AuditItem {
  const {
    database,
    document,
    extractionReview,
    examPages,
    answerKeys,
    expectedPaperCode,
  } = input;
  const base = {
    id: database.id,
    number: database.number,
  };
  if (database.status === PublicationStatus.ARCHIVED) {
    return { ...base, classification: "ARCHIVED", reasons: [] };
  }
  if (database.status === PublicationStatus.PUBLISHED) {
    return { ...base, classification: "ALREADY_PUBLISHED", reasons: [] };
  }
  if (
    database.textReviewed ||
    database.alternativesReviewed ||
    database.answerKeyReviewed ||
    database.reviewedAt
  ) {
    return {
      ...base,
      classification: "MANUAL_REVIEW_REQUIRED",
      reasons: [
        "A questão possui revisão manual anterior e não será sobrescrita pelo lote.",
      ],
    };
  }
  const source = matchingQuestion(document, database.number);
  if (!source || database.number === null) {
    return {
      ...base,
      classification: "SOURCE_MISMATCH",
      reasons: ["Número não encontrado no exam.json validado."],
    };
  }
  if (!database.sourceUrl || !database.sourcePage) {
    return {
      ...base,
      classification: "MISSING_SOURCE",
      reasons: ["Fonte ou página ausente no banco."],
    };
  }
  if (
    database.paper?.code !== expectedPaperCode ||
    database.paper?.code !== document.paper.code ||
    database.sourcePage !== source.sourcePage ||
    database.sourceUrl !== source.sourceUrl ||
    database.subject.name !== source.subject ||
    database.block?.name !== source.block ||
    database.weight !== source.weight ||
    database.statement !== source.statement
  ) {
    return {
      ...base,
      classification: "SOURCE_MISMATCH",
      reasons: ["Metadados ou enunciado divergem do arquivo intermediário validado."],
    };
  }
  if (source.type !== "MC" || database.type !== "MC") {
    return {
      ...base,
      classification: "MANUAL_REVIEW_REQUIRED",
      reasons: ["Este lote oficial deveria conter somente questões MC."],
    };
  }
  const sourceAlternatives = [...source.alternatives].sort((a, b) =>
    a.letter.localeCompare(b.letter),
  );
  const alternativesMatch =
    database.alternatives.length === sourceAlternatives.length &&
    database.alternatives.every((alternative, index) => {
      const expected = sourceAlternatives[index];
      return (
        alternative.letter === expected.letter &&
        alternative.text === expected.text &&
        alternative.isCorrect === expected.isCorrect
      );
    });
  if (!alternativesMatch) {
    return {
      ...base,
      classification: "ALTERNATIVES_MISMATCH",
      reasons: ["Texto, ordem ou marcação das alternativas diverge do exam.json."],
    };
  }
  const correct = sourceAlternatives.find((alternative) => alternative.isCorrect);
  if (!correct || answerKeys.get(source.number) !== correct.letter) {
    return {
      ...base,
      classification: "ANSWER_KEY_MISMATCH",
      reasons: ["Gabarito 1 do PDF oficial não corresponde ao exam.json."],
    };
  }
  const visual = extractionReview.requiresVisualReview.find(
    (item) => item.question === source.number,
  );
  if (visual && !database.visualReviewResolved) {
    return {
      ...base,
      classification: "VISUAL_REVIEW_REQUIRED",
      reasons: [`Página ${visual.page}: ${visual.reason}`],
    };
  }
  const pageText = [
    examPages.get(source.sourcePage) ?? "",
    examPages.get(source.sourcePage + 1) ?? "",
  ].join(" ");
  if (!pageText || !normalize(pageText).includes(normalize(source.statement))) {
    return {
      ...base,
      classification: "SOURCE_MISMATCH",
      reasons: [
        `Enunciado não confirmado no PDF entre as páginas ${source.sourcePage} e ${source.sourcePage + 1}.`,
      ],
    };
  }
  const divergence = [
    ...extractionReview.divergences,
    ...extractionReview.blockingIssues,
  ].find((item) => item.question === source.number);
  if (divergence) {
    return {
      ...base,
      classification: "MANUAL_REVIEW_REQUIRED",
      reasons: [divergence.reason],
    };
  }
  if (extractionReview.annulledQuestions.includes(source.number)) {
    return {
      ...base,
      classification: "ANNULLED",
      reasons: ["Questão registrada como anulada na auditoria documental."],
    };
  }
  for (const alternative of sourceAlternatives) {
    if (
      !alternative.isVisual &&
      !normalize(pageText).includes(normalize(alternative.text))
    ) {
      return {
        ...base,
        classification: "ALTERNATIVES_MISMATCH",
        reasons: [
          `Alternativa ${alternative.letter} não confirmada no PDF, página ${source.sourcePage}.`,
        ],
      };
    }
  }
  const hypothetical = {
    ...database,
    textReviewed: true,
    alternativesReviewed: true,
    answerKeyReviewed: true,
    annulmentStatus: AnnulmentStatus.NOT_ANNULLED,
  };
  const publicationIssues = validateQuestionForPublication(hypothetical);
  if (publicationIssues.length > 0) {
    return {
      ...base,
      classification: "MANUAL_REVIEW_REQUIRED",
      reasons: publicationIssues,
    };
  }
  return {
    ...base,
    classification: "VERIFIED_AND_PUBLISHABLE",
    reasons: [],
  };
}

function summarize(items: AuditItem[]) {
  return items.reduce<Record<string, number>>((summary, item) => {
    summary[item.classification] = (summary[item.classification] ?? 0) + 1;
    return summary;
  }, {});
}

async function confirmApply(contestId: string, explicit?: string) {
  if (explicit === contestId) return true;
  if (!process.stdin.isTTY) return false;
  const terminal = createInterface({
    input: process.stdin,
    output: process.stdout,
  });
  const answer = await terminal.question(
    `Digite o ID ${contestId} para aplicar somente as questões verificadas: `,
  );
  terminal.close();
  return answer.trim() === contestId;
}

async function main() {
  const [contestId, mode, confirmationArgument] = process.argv.slice(2);
  const config = CONFIGS[contestId];
  if (!config || !["--dry-run", "--apply"].includes(mode)) {
    throw new Error(
      "Uso: npm run review:exam -- <contestId> --dry-run|--apply [--confirm=<contestId>]",
    );
  }
  const root = resolve(config.directory);
  const [documentRaw, reviewRaw, examPdf, answerKeyPdf] = await Promise.all([
    readFile(resolve(root, "exam.json"), "utf8"),
    readFile(resolve(root, "extraction-review.json"), "utf8"),
    readFile(resolve(root, config.examPdf)),
    readFile(resolve(root, config.answerKeyPdf)),
  ]);
  const document = examImportSchema.parse(JSON.parse(documentRaw) as unknown);
  const extractionReview = JSON.parse(reviewRaw) as ExtractionReview;
  if (
    document.contest.specialty !== config.specialty ||
    document.paper.code !== config.paperCode ||
    extractionReview.contestSpecialty !== config.specialty ||
    extractionReview.paperCode !== config.paperCode
  ) {
    throw new Error("Especialidade ou caderno incompatível com o concurso.");
  }
  const extractor = new PdfParseTextExtractor();
  const [examExtraction, answerKeyExtraction] = await Promise.all([
    extractor.extract(examPdf),
    extractor.extract(answerKeyPdf),
  ]);
  const examPages = parsePages(examExtraction.text);
  const answerKeys = officialAnswerKeys(answerKeyExtraction.text);
  if (answerKeys.size !== 70) {
    throw new Error(
      `O Gabarito 1 oficial deveria conter 70 respostas; foram lidas ${answerKeys.size}.`,
    );
  }

  const prisma = new PrismaClient();
  try {
    const contest = await prisma.concurso.findUnique({
      where: { id: config.contestId },
      include: {
        scoringRule: true,
        questions: { include: questionInclude, orderBy: { number: "asc" } },
      },
    });
    if (!contest) throw new Error("Concurso não encontrado.");
    if (contest.especialidade !== config.specialty) {
      throw new Error("O ID informado pertence a outra especialidade.");
    }
    if (
      config.specialty === "Agente de Tecnologia" &&
      !contest.questions.some(
        (question) =>
          question.id === "cms16on8y00ddvpvkbjcj4y5o" &&
          question.status === PublicationStatus.ARCHIVED,
      )
    ) {
      throw new Error(
        "A questão 67 de Tecnologia não está ARCHIVED. Processo interrompido.",
      );
    }
    const items = contest.questions.map((database) =>
      auditQuestion({
        database,
        document,
        extractionReview,
        examPages,
        answerKeys,
        expectedPaperCode: config.paperCode,
      }),
    );
    const report = {
      mode,
      contest: {
        id: contest.id,
        specialty: contest.especialidade,
        status: contest.status,
      },
      documents: {
        exam: {
          file: config.examPdf,
          pages: examExtraction.pageCount,
          sha256: hash(examPdf),
        },
        answerKey: {
          file: config.answerKeyPdf,
          pages: answerKeyExtraction.pageCount,
          sha256: hash(answerKeyPdf),
          gabarito: 1,
          answers: answerKeys.size,
        },
      },
      summary: summarize(items),
      pending: items.filter(
        (item) =>
          ![
            "VERIFIED_AND_PUBLISHABLE",
            "ALREADY_PUBLISHED",
            "ARCHIVED",
          ].includes(item.classification),
      ),
      items,
    };
    console.log(JSON.stringify(report, null, 2));
    if (mode === "--dry-run") return;

    const explicit = confirmationArgument?.startsWith("--confirm=")
      ? confirmationArgument.slice("--confirm=".length)
      : undefined;
    if (!(await confirmApply(config.contestId, explicit))) {
      throw new Error("Aplicação cancelada: confirmação explícita ausente.");
    }
    const publishableIds = items
      .filter((item) => item.classification === "VERIFIED_AND_PUBLISHABLE")
      .map((item) => item.id);
    const visualPendingIds = items
      .filter((item) => item.classification === "VISUAL_REVIEW_REQUIRED")
      .map((item) => item.id);
    const result = await prisma.$transaction(
      async (transaction) => {
        const current = await transaction.question.findMany({
          where: { concursoId: config.contestId },
          include: questionInclude,
        });
        const currentItems = current.map((database) =>
          auditQuestion({
            database,
            document,
            extractionReview,
            examPages,
            answerKeys,
            expectedPaperCode: config.paperCode,
          }),
        );
        const currentPublishable = currentItems
          .filter(
            (item) => item.classification === "VERIFIED_AND_PUBLISHABLE",
          )
          .map((item) => item.id)
          .sort();
        if (
          JSON.stringify(currentPublishable) !==
          JSON.stringify([...publishableIds].sort())
        ) {
          throw new Error(
            "O estado mudou após o dry-run interno. Transação cancelada.",
          );
        }
        const now = new Date();
        const visualPending = await transaction.question.updateMany({
          where: {
            id: { in: visualPendingIds },
            concursoId: config.contestId,
            status: PublicationStatus.IN_REVIEW,
            requiresVisualReview: false,
          },
          data: {
            requiresVisualReview: true,
            visualReviewResolved: false,
          },
        });
        const updated = await transaction.question.updateMany({
          where: {
            id: { in: currentPublishable },
            concursoId: config.contestId,
            status: PublicationStatus.IN_REVIEW,
          },
          data: {
            textReviewed: true,
            alternativesReviewed: true,
            answerKeyReviewed: true,
            annulmentStatus: AnnulmentStatus.NOT_ANNULLED,
            reviewedAt: now,
            status: PublicationStatus.PUBLISHED,
            publishedAt: now,
          },
        });
        const refreshed = await transaction.concurso.findUniqueOrThrow({
          where: { id: config.contestId },
          include: {
            scoringRule: true,
            questions: { include: { alternatives: true, paper: true } },
          },
        });
        const contestIssues = validateContestForPublication(refreshed);
        let contestPublished = false;
        if (contestIssues.length === 0) {
          await transaction.concurso.update({
            where: {
              id: config.contestId,
              status: PublicationStatus.IN_REVIEW,
            },
            data: { status: PublicationStatus.PUBLISHED },
          });
          contestPublished = true;
        }
        return {
          questionsPublished: updated.count,
          visualPendingMarked: visualPending.count,
          contestPublished,
          contestIssues,
        };
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
    console.log(JSON.stringify({ applied: true, ...result }, null, 2));
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
