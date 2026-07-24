import { z } from "zod";

import {
  examImportSchema,
  formatImportValidationErrors,
  summarizeExamImport,
  type ExamImportDocument,
} from "../examImportSchema";

export {
  examImportSchema,
  formatImportValidationErrors,
  summarizeExamImport,
  type ExamImportDocument,
};

/**
 * Contrato mais estrito usado no fluxo de documentos oficiais.
 * O importador JSON legado continua aceitando fontes opcionais para preservar
 * compatibilidade com seus arquivos demonstrativos.
 */
export const officialExamImportSchema = examImportSchema.superRefine(
  (document, context) => {
    if (!document.paper.answerKeyUrl) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["paper", "answerKeyUrl"],
        message: "O PDF oficial do gabarito é obrigatório.",
      });
    }

    document.questions.forEach((question, questionIndex) => {
      if (!question.sourceUrl) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["questions", questionIndex, "sourceUrl"],
          message: "Toda questão deve indicar a fonte oficial.",
        });
      }
      if (!question.sourcePage) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["questions", questionIndex, "sourcePage"],
          message: "Toda questão deve indicar a página do PDF oficial.",
        });
      }
    });
  },
);

export type OfficialExamImportDocument = z.infer<
  typeof officialExamImportSchema
>;
