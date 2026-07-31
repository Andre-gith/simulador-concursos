import { z } from "zod";

import {
  AiExtractionError,
  AiProviderConfigurationError,
  parseAiJsonResponse,
  type ExamExtractionInput,
  type ExamExtractor,
} from "../exam-extractor";

const responseSchema = z
  .object({
    content: z.array(
      z
        .object({
          type: z.string(),
          text: z.string().optional(),
        })
        .passthrough(),
    ),
  })
  .passthrough();

function buildPrompt(input: ExamExtractionInput) {
  return `Estruture os documentos oficiais abaixo como um único JSON.

Regras obrigatórias:
- Retorne somente JSON, sem Markdown.
- Use schemaVersion 1 e reviewStatus "IN_REVIEW".
- Nunca invente conteúdo ausente. Se um dado obrigatório não puder ser confirmado, interrompa e retorne um objeto com a chave "extractionError".
- Cada questão deve ter number, type, subject, weight, statement, sourcePage e sourceUrl.
- Use exatamente "${input.examSourceReference}" como sourceUrl de todas as questões.
- Questões CE precisam de ceAnswer booleano e não devem ter alternatives.
- Questões MC precisam de pelo menos duas alternatives, com letter, text e isCorrect, e exatamente uma correta.
- Declare previamente todos os blocks, subjects e topics usados.
- Inclua uma scoringRule completa e confirmada pelos documentos.
- Use "${input.answerKeySourceReference}" em paper.answerKeyUrl e "${input.examSourceReference}" em paper.examUrl.
- O número de página deve corresponder ao PDF da prova.

Metadados fornecidos pelo administrador:
${JSON.stringify(input.metadata)}

PDF da prova (${input.examPageCount} páginas):
${input.examText}

PDF do gabarito (${input.answerKeyPageCount} páginas):
${input.answerKeyText}`;
}

export class AnthropicExamExtractor implements ExamExtractor {
  readonly providerName = "Anthropic";

  constructor(
    private readonly apiKey: string,
    private readonly model: string,
    private readonly fetchImplementation: typeof fetch = fetch,
  ) {
    if (!apiKey.trim()) {
      throw new AiProviderConfigurationError(
        "ANTHROPIC_API_KEY não está configurada.",
      );
    }
    if (!model.trim()) {
      throw new AiProviderConfigurationError(
        "ANTHROPIC_MODEL não está configurado.",
      );
    }
  }

  async extract(input: ExamExtractionInput): Promise<unknown> {
    const response = await this.fetchImplementation(
      "https://api.anthropic.com/v1/messages",
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-api-key": this.apiKey,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({
          model: this.model,
          max_tokens: 32_000,
          temperature: 0,
          messages: [{ role: "user", content: buildPrompt(input) }],
        }),
        signal: AbortSignal.timeout(180_000),
      },
    );

    if (!response.ok) {
      const requestId = response.headers.get("request-id");
      throw new AiExtractionError(
        `Anthropic recusou a extração (HTTP ${response.status})${
          requestId ? `, request-id ${requestId}` : ""
        }.`,
      );
    }

    const parsedResponse = responseSchema.safeParse(await response.json());
    if (!parsedResponse.success) {
      throw new AiExtractionError(
        "A resposta da Anthropic não possui o formato esperado.",
      );
    }
    const text = parsedResponse.data.content
      .filter((block) => block.type === "text" && block.text)
      .map((block) => block.text)
      .join("\n");

    if (!text) {
      throw new AiExtractionError(
        "A Anthropic não retornou conteúdo textual estruturado.",
      );
    }
    return parseAiJsonResponse(text);
  }
}

export type ExamExtractorConfiguration =
  | { configured: true; extractor: ExamExtractor }
  | { configured: false; message: string };

export function createAnthropicExamExtractor(
  environment: NodeJS.ProcessEnv = process.env,
): ExamExtractorConfiguration {
  const provider = (environment.AI_PROVIDER ?? "disabled").trim().toLowerCase();
  if (provider !== "anthropic") {
    return {
      configured: false,
      message:
        provider === "disabled"
          ? "A extração local foi concluída. AI_PROVIDER=disabled: nenhuma chamada externa foi executada."
          : `AI_PROVIDER=${provider} não usa o adaptador Anthropic.`,
    };
  }
  const apiKey = environment.ANTHROPIC_API_KEY?.trim();
  const model = environment.ANTHROPIC_MODEL?.trim();

  if (!apiKey) {
    return {
      configured: false,
      message:
        "A extração de texto foi concluída, mas a IA não foi executada porque ANTHROPIC_API_KEY não está configurada.",
    };
  }
  if (!model) {
    return {
      configured: false,
      message:
        "A extração de texto foi concluída, mas a IA não foi executada porque ANTHROPIC_MODEL não está configurado.",
    };
  }

  return {
    configured: true,
    extractor: new AnthropicExamExtractor(apiKey, model),
  };
}
