export type ScoringType =
  | "CE_PENALTY"
  | "MC_NO_PENALTY"
  | "MC_NEGATIVE";

export interface ScoringRule {
  type: ScoringType;
  pointsCorrect: number;
  pointsWrong: number;
  pointsBlank: number;

  /**
   * Quando true, impede que a nota final fique negativa.
   * Se não for informado, o padrão será true para CE_PENALTY.
   */
  floorAtZero?: boolean;
}

export interface CEQuestion {
  type: "CE";
  correctAnswer: boolean;
}

export interface MCQuestion {
  type: "MC";
  correctLetter: string;
}

export type QuestionAnswerKey = CEQuestion | MCQuestion;

export interface AttemptAnswerInput {
  userAnswer: string;
  question: QuestionAnswerKey;

  /**
   * Peso individual da questão.
   * Quando não informado, o peso padrão é 1.
   */
  weight?: number;
}

export interface AttemptAnswerResult {
  userAnswer: string;
  points: number;
  weight: number;
}

export interface AttemptScoreResult {
  total: number;
  breakdown: AttemptAnswerResult[];
}

function validateWeight(weight: number): number {
  if (!Number.isFinite(weight) || weight <= 0) {
    throw new Error(
      "O peso da questão deve ser um número maior que zero.",
    );
  }

  return weight;
}

/**
 * Calcula os pontos de uma única questão.
 *
 * userAnswer:
 * - "C" | "E" para questões Certo/Errado;
 * - "A".."E" para múltipla escolha;
 * - "" para questão deixada em branco.
 *
 * O resultado da regra é multiplicado pelo peso da questão.
 */
export function scoreQuestion(
  userAnswer: string,
  question: QuestionAnswerKey,
  rule: ScoringRule,
  weight = 1,
): number {
  const validWeight = validateWeight(weight);

  if (userAnswer === "") {
    return rule.pointsBlank * validWeight;
  }

  const normalizedAnswer = userAnswer.trim().toUpperCase();

  const isCorrect =
    question.type === "CE"
      ? (normalizedAnswer === "C") === question.correctAnswer
      : normalizedAnswer ===
        question.correctLetter.trim().toUpperCase();

  const basePoints = isCorrect
    ? rule.pointsCorrect
    : rule.pointsWrong;

  return basePoints * validWeight;
}

/**
 * Calcula a pontuação total do simulado.
 *
 * A nota pode ser zerada quando o saldo for negativo, dependendo da
 * configuração floorAtZero.
 */
export function scoreAttempt(
  answers: AttemptAnswerInput[],
  rule: ScoringRule,
): AttemptScoreResult {
  let total = 0;

  const breakdown = answers.map(
    ({ userAnswer, question, weight = 1 }) => {
      const validWeight = validateWeight(weight);

      const points = scoreQuestion(
        userAnswer,
        question,
        rule,
        validWeight,
      );

      total += points;

      return {
        userAnswer,
        points,
        weight: validWeight,
      };
    },
  );

  const shouldFloorAtZero =
    rule.floorAtZero ??
    rule.type === "CE_PENALTY";

  if (shouldFloorAtZero && total < 0) {
    total = 0;
  }

  return {
    total,
    breakdown,
  };
}