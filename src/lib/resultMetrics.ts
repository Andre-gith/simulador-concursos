export type ResultQuestion = {
  id: string;
  weight: number;
  subject: string;
  block: {
    id: string;
    name: string;
    order: number;
    minimumScore: number | null;
    minimumCorrect: number | null;
  } | null;
};

export type ResultAnswer = {
  questionId: string;
  userAnswer: string;
  isCorrect: boolean | null;
  pointsEarned: number;
};

export type ResultSummary = {
  total: number;
  correct: number;
  wrong: number;
  blank: number;
  netScore: number;
  maximumScore: number;
  scorePercentage: number;
  accuracyRate: number;
};

export type GroupSummary = ResultSummary & {
  id: string;
  name: string;
};

export type BlockSummary = GroupSummary & {
  order: number;
  minimumScore: number | null;
  minimumCorrect: number | null;
  meetsMinimumScore: boolean | null;
  meetsMinimumCorrect: boolean | null;
  hasConfiguredMinimums: boolean;
  meetsConfiguredMinimums: boolean;
};

function percentage(value: number, total: number): number {
  return total > 0 ? (value / total) * 100 : 0;
}

function emptySummary(): ResultSummary {
  return {
    total: 0,
    correct: 0,
    wrong: 0,
    blank: 0,
    netScore: 0,
    maximumScore: 0,
    scorePercentage: 0,
    accuracyRate: 0,
  };
}

function finalizeSummary(summary: ResultSummary): ResultSummary {
  return {
    ...summary,
    scorePercentage: percentage(
      summary.netScore,
      summary.maximumScore,
    ),
    accuracyRate: percentage(summary.correct, summary.total),
  };
}

export function calculateResultMetrics(
  questions: ResultQuestion[],
  answers: ResultAnswer[],
  pointsCorrect: number,
  netScore: number,
) {
  const answerMap = new Map(
    answers.map((answer) => [answer.questionId, answer]),
  );
  const overall = emptySummary();
  overall.netScore = netScore;

  const subjects = new Map<string, GroupSummary>();
  const blocks = new Map<string, BlockSummary>();

  for (const question of questions) {
    const answer = answerMap.get(question.id);
    const maximumPoints = question.weight * pointsCorrect;
    const isBlank = !answer || answer.userAnswer === "";
    const isCorrect = !isBlank && answer.isCorrect === true;

    overall.total += 1;
    overall.maximumScore += maximumPoints;
    overall.correct += isCorrect ? 1 : 0;
    overall.wrong += !isBlank && !isCorrect ? 1 : 0;
    overall.blank += isBlank ? 1 : 0;

    const subject = subjects.get(question.subject) ?? {
      ...emptySummary(),
      id: question.subject,
      name: question.subject,
    };
    subject.total += 1;
    subject.maximumScore += maximumPoints;
    subject.netScore += answer?.pointsEarned ?? 0;
    subject.correct += isCorrect ? 1 : 0;
    subject.wrong += !isBlank && !isCorrect ? 1 : 0;
    subject.blank += isBlank ? 1 : 0;
    subjects.set(question.subject, subject);

    if (question.block) {
      const block = blocks.get(question.block.id) ?? {
        ...emptySummary(),
        id: question.block.id,
        name: question.block.name,
        order: question.block.order,
        minimumScore: question.block.minimumScore,
        minimumCorrect: question.block.minimumCorrect,
        meetsMinimumScore: null,
        meetsMinimumCorrect: null,
        hasConfiguredMinimums:
          question.block.minimumScore !== null ||
          question.block.minimumCorrect !== null,
        meetsConfiguredMinimums: true,
      };
      block.total += 1;
      block.maximumScore += maximumPoints;
      block.netScore += answer?.pointsEarned ?? 0;
      block.correct += isCorrect ? 1 : 0;
      block.wrong += !isBlank && !isCorrect ? 1 : 0;
      block.blank += isBlank ? 1 : 0;
      blocks.set(question.block.id, block);
    }
  }

  const subjectSummaries = Array.from(subjects.values())
    .map((summary) => ({
      ...summary,
      ...finalizeSummary(summary),
    }))
    .sort((left, right) => left.name.localeCompare(right.name, "pt-BR"));

  const blockSummaries = Array.from(blocks.values())
    .map((block) => {
      const finalized = finalizeSummary(block);
      const meetsMinimumScore =
        block.minimumScore === null
          ? null
          : block.netScore >= block.minimumScore;
      const meetsMinimumCorrect =
        block.minimumCorrect === null
          ? null
          : block.correct >= block.minimumCorrect;

      return {
        ...block,
        ...finalized,
        meetsMinimumScore,
        meetsMinimumCorrect,
        hasConfiguredMinimums:
          block.minimumScore !== null || block.minimumCorrect !== null,
        meetsConfiguredMinimums:
          meetsMinimumScore !== false && meetsMinimumCorrect !== false,
      };
    })
    .sort((left, right) => left.order - right.order);

  return {
    overall: finalizeSummary(overall),
    subjects: subjectSummaries,
    blocks: blockSummaries,
  };
}
