import type { ExamImportDocument } from "../examImportSchema";

export type DataprevPhysicalPage = { number: number; text: string };

const ranges = [
  { start: 1, end: 20, subject: "Língua Portuguesa" },
  { start: 21, end: 30, subject: "Língua Inglesa" },
  { start: 31, end: 35, subject: "Raciocínio Lógico" },
  { start: 36, end: 40, subject: "Atualidades" },
  {
    start: 41,
    end: 50,
    subject:
      "Legislação acerca de Segurança de Informações e Proteção de Dados",
  },
  {
    start: 51,
    end: 120,
    subject:
      "Conhecimentos Específicos de Desenvolvimento de Software e Tecnologia da Informação",
  },
] as const;

const pageRanges = [
  { page: 1, start: 51, end: 84 },
  { page: 2, start: 85, end: 116 },
  { page: 3, start: 117, end: 120 },
  { page: 4, start: 1, end: 10 },
  { page: 5, start: 11, end: 25 },
  { page: 6, start: 26, end: 40 },
  { page: 7, start: 41, end: 50 },
] as const;

const contextMarkers = [
  "Julgue ",
  "Acerca ",
  "A respeito ",
  "Com relação ",
  "No que ",
  "Considerando ",
  "Based on ",
  "Tomando ",
  "Em relação ",
  "Quanto ",
  "Sobre ",
  "Com base ",
  "Relativamente ",
  "LÍNGUA INGLESA",
  "RACIOCÍNIO LÓGICO",
  "ATUALIDADES",
  "LEGISLAÇÃO ACERCA",
];

function normalizeText(value: string) {
  return value
    .replace(/\r/g, "")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]{2,}/g, " ")
    .trim();
}

function cleanPage(text: string) {
  return text
    .split(/\r?\n/)
    .filter((line) => {
      const value = line.trim();
      return (
        !value.startsWith("pcimarkpci ") &&
        value !== "www.pciconcursos.com.br" &&
        !/^\d{12,}$/.test(value) &&
        !/^\d{3}[A-Z]{2}\d{9}$/.test(value) &&
        value !== "CEBRASPE – DATAPREV – Edital: 2023" &&
        value !== "Espaço livre"
      );
    })
    .join("\n");
}

function findContextStart(text: string) {
  const indexes = contextMarkers
    .map((marker) => text.indexOf(`\n${marker}`))
    .filter((index) => index >= 0);
  return indexes.length > 0 ? Math.min(...indexes) : -1;
}

function subjectFor(number: number) {
  const range = ranges.find(
    (candidate) => number >= candidate.start && number <= candidate.end,
  );
  if (!range) throw new Error(`Matéria não definida para a questão ${number}.`);
  return range.subject;
}

export function extractDataprevQuestions(pages: DataprevPhysicalPage[]) {
  const extracted = new Map<
    number,
    { number: number; sourcePage: number; statement: string; subject: string }
  >();
  for (const mapping of pageRanges) {
    const physicalPage = pages.find((page) => page.number === mapping.page);
    if (!physicalPage) throw new Error(`Página física ${mapping.page} ausente.`);
    const text = cleanPage(physicalPage.text);
    const matches = [
      ...text.matchAll(
        /(?:^|\n)[ \t]*(\d{1,3})(?:[ \t]*\n[ \t]*|[ \t]+)(?=\S)/g,
      ),
    ].filter((match) => {
      const number = Number(match[1]);
      return number >= mapping.start && number <= mapping.end;
    });
    const numbers = matches.map((match) => Number(match[1]));
    const expected = Array.from(
      { length: mapping.end - mapping.start + 1 },
      (_, index) => mapping.start + index,
    );
    if (JSON.stringify(numbers) !== JSON.stringify(expected)) {
      throw new Error(
        `Página ${mapping.page}: sequência inesperada (${numbers.join(", ")}).`,
      );
    }

    let activeContext = normalizeText(
      text.slice(0, matches[0]?.index ?? 0),
    );
    for (const [index, match] of matches.entries()) {
      const number = Number(match[1]);
      const start = (match.index ?? 0) + match[0].length;
      const end = matches[index + 1]?.index ?? text.length;
      let item = text.slice(start, end);
      const contextStart = findContextStart(item);
      let nextContext: string | null = null;
      if (contextStart >= 0) {
        nextContext = normalizeText(item.slice(contextStart));
        item = item.slice(0, contextStart);
      }
      item = normalizeText(item);
      if (!item) throw new Error(`Questão ${number}: enunciado vazio.`);
      extracted.set(number, {
        number,
        sourcePage: mapping.page,
        statement: normalizeText(
          activeContext ? `${activeContext}\n\n${item}` : item,
        ),
        subject: subjectFor(number),
      });
      if (nextContext) activeContext = nextContext;
    }
  }
  const ordered = [...extracted.values()].sort((left, right) => left.number - right.number);
  if (
    ordered.length !== 120 ||
    ordered.some((question, index) => question.number !== index + 1)
  ) {
    throw new Error("O caderno deve conter as questões 1 a 120 sem lacunas.");
  }
  return ordered;
}

export function buildDataprevExam(input: {
  pages: DataprevPhysicalPage[];
  answers: Record<string, boolean>;
  assets: Record<string, string>;
  projectRoot: string;
}): ExamImportDocument {
  const questions = extractDataprevQuestions(input.pages);
  const sourceDirectory =
    "data/imports/dataprev/Desenvolvimento%20de%20Software";
  const subjects = [...new Set(questions.map((question) => question.subject))];
  return {
    schemaVersion: 1,
    contentNotice:
      "Gabarito oficial preliminar — publicação pendente de confirmação definitiva. Critérios documentais: mínimo de 10 pontos em P1, 21 pontos em P2 e 36 pontos no conjunto; classificação final NP1 + 2 × NP2.",
    reviewStatus: "IN_REVIEW",
    contest: {
      board: "CEBRASPE",
      agency:
        "Empresa de Tecnologia e Informações da Previdência — Dataprev",
      edition: "Edital nº 1 — Dataprev, de 28 de julho de 2023",
      year: 2023,
      position: "Analista de Tecnologia da Informação",
      specialty: "Desenvolvimento de Software",
      educationLevel: "SUPERIOR",
    },
    paper: {
      code: "893_DATAPREV_007_01",
      examUrl: `local-document:///${sourceDirectory}/analista_de_tecnologia_da_informacao_perfil_desenvolvimento_de_software.pdf`,
      answerKeyUrl: `local-document:///${sourceDirectory}/gabarito.pdf`,
      appliedAt: "2023-10-01T00:00:00-03:00",
    },
    scoringRule: {
      type: "CE_PENALTY",
      pointsCorrect: 1,
      pointsWrong: -1,
      pointsBlank: 0,
      floorAtZero: false,
    },
    blocks: [
      { name: "P1 — Conhecimentos Gerais", order: 0, minimumScore: 10 },
      {
        name: "P2 — Conhecimentos Específicos",
        order: 1,
        minimumScore: 42,
      },
    ],
    subjects: subjects.map((name) => ({ name, topics: [] })),
    questions: questions.map((question) => {
      const answer = input.answers[String(question.number)];
      if (typeof answer !== "boolean") {
        throw new Error(`Gabarito ausente para a questão ${question.number}.`);
      }
      const visualPath = input.assets[String(question.number)];
      return {
        number: question.number,
        type: "CE" as const,
        subject: question.subject,
        block:
          question.number <= 50
            ? "P1 — Conhecimentos Gerais"
            : "P2 — Conhecimentos Específicos",
        weight: question.number <= 50 ? 1 : 2,
        statement: question.statement,
        ceAnswer: answer,
        sourcePage: question.sourcePage,
        sourceUrl: `local-document:///${sourceDirectory}/analista_de_tecnologia_da_informacao_perfil_desenvolvimento_de_software.pdf`,
        requiresVisualReview: Boolean(visualPath),
        visualAssets: visualPath
          ? [
              {
                placement: "STATEMENT" as const,
                assetPath: visualPath
                  .replaceAll("\\", "/")
                  .replace(`${input.projectRoot.replaceAll("\\", "/")}/`, ""),
                sourcePage: question.sourcePage,
                order: 0,
              },
            ]
          : [],
      };
    }),
  };
}
