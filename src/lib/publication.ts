export type PublicationQuestion = {
  id?: string;
  number?: number | null;
  status: "DRAFT" | "IN_REVIEW" | "PUBLISHED" | "ARCHIVED";
  type: "CE" | "MC";
  statement: string;
  ceAnswer: boolean | null;
  weight: number;
  subjectId: string;
  blockId: string | null;
  sourceUrl: string | null;
  sourcePage: number | null;
  textReviewed: boolean;
  alternativesReviewed: boolean;
  answerKeyReviewed: boolean;
  requiresVisualReview: boolean;
  visualReviewResolved: boolean;
  publicationOverride?: boolean;
  publicationOverrideReason?: string | null;
  publicationOverrideAt?: Date | null;
  annulmentStatus: "PENDING" | "NOT_ANNULLED" | "ANNULLED";
  paper?: { provaUrl: string | null } | null;
  visualAssets?: Array<{ assetPath: string; sourcePage: number }>;
  alternatives: Array<{
    text: string;
    isCorrect: boolean;
    isVisual: boolean;
    visualAssetPath: string | null;
    sourcePage: number | null;
  }>;
};

function questionLabel(question: PublicationQuestion) {
  return question.number ? `Questão ${question.number}` : "Questão sem número";
}

export function validateQuestionForPublication(
  question: PublicationQuestion,
): string[] {
  const issues: string[] = [];
  const label = questionLabel(question);

  if (!question.statement.trim()) {
    issues.push(`${label}: o enunciado está vazio.`);
  }
  if (!question.textReviewed) {
    issues.push(`${label}: o texto ainda não foi conferido.`);
  }
  if (!question.alternativesReviewed) {
    issues.push(`${label}: as alternativas ainda não foram conferidas.`);
  }
  if (!question.answerKeyReviewed) {
    issues.push(`${label}: o gabarito ainda não foi confirmado.`);
  }
  if (!question.subjectId) {
    issues.push(`${label}: a matéria não está vinculada.`);
  }
  if (!question.blockId) {
    issues.push(`${label}: o bloco não está vinculado.`);
  }
  if (question.annulmentStatus === "PENDING") {
    issues.push(`${label}: a situação de anulação ainda não foi definida.`);
  }
  if (question.annulmentStatus === "ANNULLED") {
    issues.push(`${label}: questões anuladas não podem ser publicadas.`);
  }
  if (
    question.requiresVisualReview &&
    !question.visualReviewResolved &&
    !question.publicationOverride
  ) {
    issues.push(`${label}: a pendência visual ainda não foi resolvida.`);
  }
  if (
    question.publicationOverride &&
    (!question.publicationOverrideReason?.trim() ||
      !question.publicationOverrideAt)
  ) {
    issues.push(
      `${label}: o override administrativo não possui justificativa e data.`,
    );
  }
  if (
    question.requiresVisualReview &&
    (question.visualAssets?.length ?? 0) === 0 &&
    !question.alternatives.some((alternative) => alternative.isVisual)
  ) {
    issues.push(`${label}: o recurso visual oficial não está registrado.`);
  }
  if (
    question.visualAssets?.some(
      (asset) => !asset.assetPath.trim() || asset.sourcePage <= 0,
    )
  ) {
    issues.push(`${label}: há recurso visual sem caminho ou página válida.`);
  }
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
      question.alternatives.some(
        (alternative) => !alternative.text.trim(),
      )
    ) {
      issues.push(`${label}: todas as alternativas precisam de texto.`);
    }
    if (
      question.alternatives.some(
        (alternative) =>
          alternative.isVisual &&
          (!alternative.visualAssetPath?.trim() || !alternative.sourcePage),
      )
    ) {
      issues.push(
        `${label}: toda alternativa visual precisa do recurso e da página oficial.`,
      );
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
  status?: "DRAFT" | "IN_REVIEW" | "PUBLISHED" | "ARCHIVED";
  scoringRule: {
    pointsCorrect?: number;
    pointsWrong?: number;
    pointsBlank?: number;
  } | null;
  questions: PublicationQuestion[];
}): string[] {
  const issues: string[] = [];
  if (contest.status && contest.status !== "IN_REVIEW") {
    issues.push("Somente concursos em revisão podem ser publicados.");
  }
  if (!contest.scoringRule) {
    issues.push("O concurso não possui regra de pontuação.");
  } else if (
    Object.values(contest.scoringRule).some(
      (value) => typeof value === "number" && !Number.isFinite(value),
    )
  ) {
    issues.push("A regra de pontuação possui valores inválidos.");
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
  const activeUnpublished = contest.questions.filter(
    (question) =>
      question.status !== "PUBLISHED" && question.status !== "ARCHIVED",
  );
  if (activeUnpublished.length > 0) {
    issues.push(
      `${activeUnpublished.length} questão(ões) ativa(s) ainda não foram publicadas.`,
    );
  }
  return issues;
}

export function isQuestionReadyForPublication(
  question: PublicationQuestion,
): boolean {
  return validateQuestionForPublication(question).length === 0;
}
