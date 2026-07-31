import type { ExamImportDocument } from "../examImportSchema";

type ExtractedQuestion = {
  number: number;
  statement: string;
  alternatives: Array<{ letter: string; text: string }>;
  sourcePage: number;
};

export function buildTranspetroMechanicalExam(input: {
  questions: ExtractedQuestion[];
  answers: Record<string, string>;
  assets: Record<string, string>;
  projectRoot: string;
}): ExamImportDocument {
  const sourceDirectory =
    "data/imports/transpetro/Manuten%C3%A7%C3%A3o%20%20Mec%C3%A2nica%20%E2%80%94%20Manuten%C3%A7%C3%A3o%20%20Mec%C3%A2nica";
  const examUrl = `local-document:///${sourceDirectory}/manutencao_mecanica.pdf`;
  const answerKeyUrl = `local-document:///${sourceDirectory}/gabarito%20%281%29.pdf`;
  const visualPath = (number: number) => {
    const path = input.assets[String(number)];
    return path
      ?.replaceAll("\\", "/")
      .replace(`${input.projectRoot.replaceAll("\\", "/")}/`, "");
  };

  return {
    schemaVersion: 1,
    contentNotice:
      "Prova 9 — Manutenção — Mecânica, com gabarito definitivo confirmado pelo responsável administrativo em 29/07/2026. Conteúdo sujeito à revisão editorial contínua.",
    reviewStatus: "IN_REVIEW",
    contest: {
      board: "CESGRANRIO",
      agency: "Transpetro",
      edition: "TRANSPETRO/PSP/TERRA/NÍVEL MÉDIO/2023.1",
      year: 2023,
      position: "Profissional Transpetro de Nível Médio — Júnior",
      specialty: "Manutenção | Mecânica",
      educationLevel: "MEDIO",
    },
    paper: {
      code: "PROVA-9-MANUTENCAO-MECANICA",
      examUrl,
      answerKeyUrl,
      appliedAt: "2023-12-10T00:00:00-03:00",
    },
    scoringRule: {
      type: "MC_NO_PENALTY",
      pointsCorrect: 1,
      pointsWrong: 0,
      pointsBlank: 0,
      floorAtZero: true,
    },
    blocks: [
      { name: "Conhecimentos Básicos", order: 0, minimumScore: 10 },
      { name: "Conhecimentos Específicos", order: 1, minimumScore: 20 },
    ],
    subjects: [
      { name: "Língua Portuguesa", topics: [] },
      { name: "Matemática", topics: [] },
      { name: "Conhecimentos Específicos — Manutenção Mecânica", topics: [] },
    ],
    questions: input.questions.map((question) => {
      const correctLetter = input.answers[String(question.number)];
      if (!correctLetter) {
        throw new Error(`Gabarito ausente para a questão ${question.number}.`);
      }
      const assetPath = visualPath(question.number);
      return {
        number: question.number,
        type: "MC" as const,
        subject:
          question.number <= 10
            ? "Língua Portuguesa"
            : question.number <= 20
              ? "Matemática"
              : "Conhecimentos Específicos — Manutenção Mecânica",
        block:
          question.number <= 20
            ? "Conhecimentos Básicos"
            : "Conhecimentos Específicos",
        weight: 1,
        statement: question.statement,
        sourcePage: question.sourcePage,
        sourceUrl: examUrl,
        requiresVisualReview: Boolean(assetPath),
        visualAssets: assetPath
          ? [
              {
                placement: "STATEMENT" as const,
                assetPath,
                sourcePage: question.sourcePage,
                order: 0,
              },
            ]
          : [],
        alternatives: question.alternatives.map((alternative) => ({
          ...alternative,
          isCorrect: alternative.letter === correctLetter,
          isVisual: question.number === 32,
          ...(question.number === 32 && assetPath
            ? {
                visualAssetPath: assetPath,
                sourcePage: question.sourcePage,
              }
            : {}),
        })),
      };
    }),
  };
}
