export type ExamExtractionInput = {
  examText: string;
  answerKeyText: string;
  examPageCount: number;
  answerKeyPageCount: number;
  examSourceReference: string;
  answerKeySourceReference: string;
  metadata: {
    agency: string;
    board?: string;
    year?: number;
    edition?: string;
    position?: string;
    specialty?: string;
    educationLevel?: "FUNDAMENTAL" | "MEDIO" | "TECNICO" | "SUPERIOR";
    paperCode?: string;
  };
};

export interface ExamExtractor {
  readonly providerName: string;
  extract(input: ExamExtractionInput): Promise<unknown>;
}

export class AiProviderConfigurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AiProviderConfigurationError";
  }
}

export class AiExtractionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AiExtractionError";
  }
}

export function parseAiJsonResponse(response: string): unknown {
  const trimmed = response.trim();
  const withoutFence = trimmed
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/, "");

  try {
    return JSON.parse(withoutFence) as unknown;
  } catch {
    throw new AiExtractionError(
      "O provider de IA não retornou um objeto JSON válido.",
    );
  }
}
