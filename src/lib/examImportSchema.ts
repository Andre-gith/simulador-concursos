import { z } from "zod";

const nonEmpty = z.string().trim().min(1);
const optionalUrl = z.string().url().optional();
const optionalNonNegative = z.number().finite().nonnegative().optional();
const optionalPositiveInteger = z.number().int().positive().optional();

const alternativeSchema = z
  .object({
    letter: nonEmpty,
    text: nonEmpty,
    isCorrect: z.boolean(),
    isVisual: z.boolean().default(false),
    visualAssetPath: nonEmpty.optional(),
    visualDescription: nonEmpty.optional(),
    sourcePage: z.number().int().positive().optional(),
  })
  .strict()
  .superRefine((alternative, context) => {
    if (alternative.isVisual) {
      if (!alternative.visualAssetPath) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["visualAssetPath"],
          message: "Alternativas visuais devem referenciar o recurso oficial.",
        });
      }
      if (!alternative.sourcePage) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["sourcePage"],
          message: "Alternativas visuais devem registrar a página da fonte.",
        });
      }
    } else if (
      alternative.visualAssetPath ||
      alternative.visualDescription ||
      alternative.sourcePage
    ) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["isVisual"],
        message:
          "Referências visuais só são permitidas em alternativas marcadas como visuais.",
      });
    }
  });

const questionBase = {
  number: z.number().int().positive(),
  subject: nonEmpty,
  topic: nonEmpty.optional(),
  block: nonEmpty.optional(),
  weight: z.number().finite().positive(),
  statement: nonEmpty,
  sourcePage: z.number().int().positive().optional(),
  sourceUrl: optionalUrl,
  requiresVisualReview: z.boolean().default(false),
};

const ceQuestionSchema = z
  .object({
    ...questionBase,
    type: z.literal("CE"),
    ceAnswer: z.boolean(),
  })
  .strict();

const mcQuestionSchema = z
  .object({
    ...questionBase,
    type: z.literal("MC"),
    alternatives: z.array(alternativeSchema).min(2),
  })
  .strict()
  .superRefine((question, context) => {
    const normalizedLetters = question.alternatives.map((alternative) =>
      alternative.letter.toUpperCase(),
    );

    if (new Set(normalizedLetters).size !== normalizedLetters.length) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["alternatives"],
        message: "As letras das alternativas não podem se repetir.",
      });
    }

    if (
      question.alternatives.filter((alternative) => alternative.isCorrect)
        .length !== 1
    ) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["alternatives"],
        message: "Questões MC devem possuir exatamente uma alternativa correta.",
      });
    }

    if (
      question.alternatives.some((alternative) => alternative.isVisual) &&
      !question.requiresVisualReview
    ) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["requiresVisualReview"],
        message:
          "Questões com alternativas visuais devem exigir revisão visual.",
      });
    }
  });

export const examImportSchema = z
  .object({
    schemaVersion: z.literal(1),
    contentNotice: nonEmpty,
    reviewStatus: z.literal("IN_REVIEW"),
    contest: z
      .object({
        board: nonEmpty,
        agency: nonEmpty,
        edition: nonEmpty.optional(),
        year: z.number().int().min(1900).max(2200),
        position: nonEmpty,
        specialty: nonEmpty.optional(),
        educationLevel: z
          .enum(["FUNDAMENTAL", "MEDIO", "TECNICO", "SUPERIOR"])
          .optional(),
        officialPageUrl: optionalUrl,
        noticeUrl: optionalUrl,
      })
      .strict(),
    paper: z
      .object({
        code: nonEmpty,
        examUrl: optionalUrl,
        answerKeyUrl: optionalUrl,
        appliedAt: z.string().datetime({ offset: true }).optional(),
      })
      .strict(),
    scoringRule: z
      .object({
        type: z.enum(["CE_PENALTY", "MC_NO_PENALTY", "MC_NEGATIVE"]),
        pointsCorrect: z.number().finite(),
        pointsWrong: z.number().finite(),
        pointsBlank: z.number().finite(),
        floorAtZero: z.boolean(),
        minimumTotalScore: optionalNonNegative,
        minimumCorrect: optionalPositiveInteger,
      })
      .strict(),
    blocks: z
      .array(
        z
          .object({
            name: nonEmpty,
            order: z.number().int().nonnegative(),
            minimumScore: optionalNonNegative,
            minimumCorrect: optionalPositiveInteger,
          })
          .strict(),
      )
      .default([]),
    subjects: z
      .array(
        z
          .object({
            name: nonEmpty,
            topics: z.array(nonEmpty).default([]),
          })
          .strict(),
      )
      .min(1),
    questions: z
      .array(z.union([ceQuestionSchema, mcQuestionSchema]))
      .min(1),
  })
  .strict()
  .superRefine((document, context) => {
    const questionNumbers = document.questions.map(
      (question) => question.number,
    );
    if (new Set(questionNumbers).size !== questionNumbers.length) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["questions"],
        message: "Há números de questão duplicados no mesmo caderno.",
      });
    }

    const blockNames = document.blocks.map((block) => block.name);
    if (new Set(blockNames).size !== blockNames.length) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["blocks"],
        message: "Os nomes dos blocos não podem se repetir.",
      });
    }

    const subjectNames = document.subjects.map((subject) => subject.name);
    if (new Set(subjectNames).size !== subjectNames.length) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["subjects"],
        message: "Os nomes das matérias não podem se repetir.",
      });
    }

    const blocks = new Set(blockNames);
    const subjects = new Map(
      document.subjects.map((subject) => [
        subject.name,
        new Set(subject.topics),
      ]),
    );

    document.subjects.forEach((subject, subjectIndex) => {
      if (new Set(subject.topics).size !== subject.topics.length) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["subjects", subjectIndex, "topics"],
          message: "Os assuntos de uma matéria não podem se repetir.",
        });
      }
    });

    document.questions.forEach((question, questionIndex) => {
      const topics = subjects.get(question.subject);
      if (!topics) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["questions", questionIndex, "subject"],
          message: `A matéria "${question.subject}" não foi declarada.`,
        });
      } else if (question.topic && !topics.has(question.topic)) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["questions", questionIndex, "topic"],
          message: `O assunto "${question.topic}" não foi declarado na matéria "${question.subject}".`,
        });
      }

      if (question.block && !blocks.has(question.block)) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["questions", questionIndex, "block"],
          message: `O bloco "${question.block}" não foi declarado.`,
        });
      }
    });
  });

export type ExamImportDocument = z.infer<typeof examImportSchema>;

export function formatImportValidationErrors(error: z.ZodError): string[] {
  return error.issues.map((issue) => {
    const path = issue.path.length > 0 ? issue.path.join(".") : "document";
    return `${path}: ${issue.message}`;
  });
}

export function summarizeExamImport(document: ExamImportDocument) {
  return {
    board: document.contest.board,
    contest: `${document.contest.agency} — ${document.contest.position} (${document.contest.year})`,
    paper: document.paper.code,
    blocks: document.blocks.length,
    subjects: document.subjects.length,
    topics: document.subjects.reduce(
      (total, subject) => total + subject.topics.length,
      0,
    ),
    questions: document.questions.length,
    ceQuestions: document.questions.filter(
      (question) => question.type === "CE",
    ).length,
    mcQuestions: document.questions.filter(
      (question) => question.type === "MC",
    ).length,
    visualQuestions: document.questions.filter(
      (question) =>
        question.type === "MC" &&
        question.alternatives.some((alternative) => alternative.isVisual),
    ).length,
    reviewStatus: document.reviewStatus,
  };
}
