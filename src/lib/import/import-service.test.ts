import { describe, expect, it, vi } from "vitest";

import {
  AiExtractionError,
  parseAiJsonResponse,
} from "../ai/exam-extractor";
import {
  ExamDocumentValidationError,
  ExamImportService,
  type ExamImportPersistence,
} from "./import-service";
import { officialExamImportSchema } from "./exam-schema";
import { validatePdfPair } from "./pdf-import-workflow";

const sources = {
  exam: "https://oficial.example/prova.pdf",
  answerKey: "https://oficial.example/gabarito.pdf",
};

function validAiDocument() {
  return {
    schemaVersion: 1,
    contentNotice: "Extraído de documentos oficiais; revisão obrigatória.",
    reviewStatus: "IN_REVIEW",
    contest: {
      board: "BANCA",
      agency: "Instituição",
      year: 2026,
      position: "Cargo",
    },
    paper: {
      code: "CADERNO-1",
      examUrl: sources.exam,
      answerKeyUrl: sources.answerKey,
    },
    scoringRule: {
      type: "MC_NO_PENALTY",
      pointsCorrect: 1,
      pointsWrong: 0,
      pointsBlank: 0,
      floorAtZero: true,
    },
    blocks: [{ name: "Conhecimentos", order: 1 }],
    subjects: [{ name: "Matéria", topics: ["Assunto"] }],
    questions: [
      {
        number: 1,
        type: "MC",
        subject: "Matéria",
        topic: "Assunto",
        block: "Conhecimentos",
        weight: 1,
        statement: "Enunciado oficial.",
        sourceUrl: sources.exam,
        sourcePage: 2,
        alternatives: [
          { letter: "A", text: "Alternativa correta.", isCorrect: true },
          { letter: "B", text: "Alternativa incorreta.", isCorrect: false },
        ],
      },
      {
        number: 2,
        type: "CE",
        subject: "Matéria",
        weight: 1,
        statement: "Item oficial.",
        sourceUrl: sources.exam,
        sourcePage: 3,
        ceAnswer: true,
      },
    ],
  };
}

function persistenceMock() {
  return {
    save: vi.fn<ExamImportPersistence["save"]>().mockResolvedValue({
      concursoId: "contest",
      paperId: "paper",
      importJobId: "job",
      createdQuestions: 2,
      updatedQuestions: 0,
    }),
  };
}

describe("pipeline de importação oficial", () => {
  it("rejeita resposta inválida da IA", () => {
    expect(() => parseAiJsonResponse("isto não é JSON")).toThrow(
      AiExtractionError,
    );
  });

  it("rejeita JSON incompleto antes de chamar a persistência", async () => {
    const persistence = persistenceMock();
    const service = new ExamImportService(persistence);

    await expect(
      service.importAiDocument({ schemaVersion: 1 }, sources),
    ).rejects.toBeInstanceOf(ExamDocumentValidationError);
    expect(persistence.save).not.toHaveBeenCalled();
  });

  it("rejeita fluxo sem PDF de gabarito", () => {
    expect(() =>
      validatePdfPair({ exam: Buffer.from("%PDF-prova") }),
    ).toThrow("O PDF oficial do gabarito é obrigatório.");
  });

  it("rejeita documento estruturado sem referência de gabarito", () => {
    const document = validAiDocument();
    const { answerKeyUrl: _answerKeyUrl, ...paperWithoutAnswerKey } =
      document.paper;
    const documentWithoutAnswerKey = {
      ...document,
      paper: paperWithoutAnswerKey,
    };

    expect(
      officialExamImportSchema.safeParse(documentWithoutAnswerKey).success,
    ).toBe(false);
  });

  it("rejeita números de questões duplicados", async () => {
    const persistence = persistenceMock();
    const service = new ExamImportService(persistence);
    const document = validAiDocument();
    document.questions[1].number = 1;

    await expect(
      service.importAiDocument(document, sources),
    ).rejects.toBeInstanceOf(ExamDocumentValidationError);
    expect(persistence.save).not.toHaveBeenCalled();
  });

  it("rejeita múltiplas alternativas corretas", async () => {
    const persistence = persistenceMock();
    const service = new ExamImportService(persistence);
    const document = validAiDocument();
    const question = document.questions[0];
    if ("alternatives" in question && question.alternatives) {
      question.alternatives[1].isCorrect = true;
    }

    await expect(
      service.importAiDocument(document, sources),
    ).rejects.toBeInstanceOf(ExamDocumentValidationError);
    expect(persistence.save).not.toHaveBeenCalled();
  });

  it("propaga falha transacional sem relatar sucesso parcial", async () => {
    const committed: string[] = [];
    const persistence: ExamImportPersistence = {
      async save() {
        const staged = ["concurso", "caderno", "questões"];
        expect(staged).toHaveLength(3);
        throw new Error("rollback");
      },
    };
    const service = new ExamImportService(persistence);

    await expect(
      service.importAiDocument(validAiDocument(), sources),
    ).rejects.toThrow("rollback");
    expect(committed).toEqual([]);
  });

  it("força IN_REVIEW mesmo se a IA sugerir publicação", async () => {
    const persistence = persistenceMock();
    const service = new ExamImportService(persistence);
    const document = validAiDocument();
    document.reviewStatus = "PUBLISHED";

    await service.importAiDocument(document, sources);

    expect(persistence.save).toHaveBeenCalledWith(
      expect.objectContaining({ reviewStatus: "IN_REVIEW" }),
    );
  });
});
