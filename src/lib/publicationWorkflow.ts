import {
  validateQuestionForPublication,
  type PublicationQuestion,
} from "./publication";

export type BulkReviewOperation =
  | "TEXT_REVIEWED"
  | "ALTERNATIVES_REVIEWED"
  | "ANSWER_KEY_REVIEWED"
  | "NOT_ANNULLED"
  | "PUBLISH_READY";

export type BulkPublicationQuestion = PublicationQuestion & {
  extractionNotes?: string | null;
};

function structuralIssues(question: BulkPublicationQuestion): string[] {
  const allIssues = validateQuestionForPublication({
    ...question,
    textReviewed: true,
    alternativesReviewed: true,
    answerKeyReviewed: true,
    annulmentStatus:
      question.annulmentStatus === "PENDING"
        ? "NOT_ANNULLED"
        : question.annulmentStatus,
  });
  return allIssues;
}

export function validateBulkQuestionSelection(
  questions: BulkPublicationQuestion[],
  operation: BulkReviewOperation,
): string[] {
  const issues: string[] = [];
  for (const question of questions) {
    const label = `Questão ${question.number ?? "sem número"}`;
    if (question.status === "ARCHIVED") {
      issues.push(`${label}: está arquivada.`);
    }
    if (question.status === "PUBLISHED" && operation !== "PUBLISH_READY") {
      issues.push(`${label}: uma revisão individual publicada não será sobrescrita.`);
    }
    if (
      operation === "PUBLISH_READY" &&
      question.status !== "IN_REVIEW"
    ) {
      issues.push(`${label}: somente questões em revisão podem ser publicadas.`);
    }
    if (
      question.requiresVisualReview &&
      !question.visualReviewResolved &&
      !question.publicationOverride
    ) {
      issues.push(`${label}: possui revisão visual pendente.`);
    }
    if (
      question.extractionNotes &&
      /\b(diverg|conflit|incompat)/i.test(question.extractionNotes)
    ) {
      issues.push(`${label}: possui divergência registrada.`);
    }
    issues.push(...structuralIssues(question));
    if (operation === "PUBLISH_READY") {
      issues.push(...validateQuestionForPublication(question));
    }
  }
  return [...new Set(issues)];
}
