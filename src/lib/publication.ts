export type PublicationQuestion = {
  id?: string;
  number?: number | null;
  status: "DRAFT" | "IN_REVIEW" | "PUBLISHED" | "ARCHIVED";
  type: "CE" | "MC";
  ceAnswer: boolean | null;
  weight: number;
  sourceUrl: string | null;
  sourcePage: number | null;
  paper?: { provaUrl: string | null } | null;
  alternatives: Array<{ isCorrect: boolean }>;
};

function questionLabel(question: PublicationQuestion) {
  return question.number ? `Questão ${question.number}` : "Questão sem número";
}

export function validateQuestionForPublication(
  question: PublicationQuestion,
): string[] {
  const issues: string[] = [];
  const label = questionLabel(question);

  if (!Number.isFinite(question.weight) || question.weight <= 0) {
    issues.push(`${label}: o peso deve ser maior que zero.`);
  }
  if (!question.sourcePage || question.sourcePage <= 0) {
    issues.push(`${label}: a página da fonte não está registrada.`);
  }
  if (!(question.sourceUrl?.trim() || question.paper?.provaUrl?.trim())) {
    issues.push(`${label}: a fonte oficial não está registrada.`);
  }
  if (question.type === "CE" && question.ceAnswer === null) {
    issues.push(`${label}: o gabarito Certo/Errado está ausente.`);
  }
  if (question.type === "MC") {
    if (question.alternatives.length < 2) {
      issues.push(`${label}: a questão MC precisa de alternativas.`);
    }
    if (
      question.alternatives.filter((alternative) => alternative.isCorrect)
        .length !== 1
    ) {
      issues.push(
        `${label}: a questão MC deve ter exatamente uma alternativa correta.`,
      );
    }
  }

  return issues;
}

export function validateContestForPublication(contest: {
  scoringRule: object | null;
  questions: PublicationQuestion[];
}): string[] {
  const issues: string[] = [];
  if (!contest.scoringRule) {
    issues.push("O concurso não possui regra de pontuação.");
  }

  const publishedQuestions = contest.questions.filter(
    (question) => question.status === "PUBLISHED",
  );
  if (publishedQuestions.length === 0) {
    issues.push("O concurso precisa de pelo menos uma questão publicada.");
  }
  for (const question of publishedQuestions) {
    issues.push(...validateQuestionForPublication(question));
  }
  return issues;
}
