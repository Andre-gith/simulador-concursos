import { readFile } from "node:fs/promises";

import {
  AnnulmentStatus,
  Prisma,
  PrismaClient,
  PublicationStatus,
} from "@prisma/client";

import { PdfParseTextExtractor } from "../src/lib/import/pdf-extractor";
import { validateQuestionForPublication } from "../src/lib/publication";

const corrections = [
  ["cms16on2b002ovpvkd16ojvj4", "Lydians – known RASCUNHO", "Lydians – known"],
  ["cms16on390048vpvkv0fkwvi2", "96 RASCUNHO ATUALIDADES DO MERCADO FINANCEIRO", "96"],
  ["cms16on3u0057vpvkbnky05nt", "privilegia a linguagem analógica, em detrimento da digital. RASCUNHO CONHECIMENTOS ESPECÍFICOS PROBABILIDADE E ESTATÍSTICA", "privilegia a linguagem analógica, em detrimento da digital."],
  ["cms16on48005svpvktfjc1cts", "1/3 RASCUNHO Dado Considere que: • a variável aleatória Z tem distribuição normal padrão (Z ~ N(0;1)); • Prob (Z > 1,64) = 5%; e • Prob (Z > 1,96) = 2,5% .", "1/3"],
  ["cms16on4i0066vpvkx4qhoome", "85% CONHECIMENTOS BANCÁRIOS", "85%"],
  ["cms16on540075vpvkd58cuooj", "mercado de balcão organizado RASCUNHO TECNOLOGIA DA INFORMAÇÃO", "mercado de balcão organizado"],
  ["cms15wnjt002bvpg0ijqbdztk", "Braille recebia os alunos e sempre auxiliava-os com o método criado. RASCUNHO", "Braille recebia os alunos e sempre auxiliava-os com o método criado."],
  ["cms15wnkq0049vpg0e1pbe34n", "35 RASCUNHO ATUALIDADES DO MERCADO FINANCEIRO", "35"],
  ["cms15wnl80058vpg08s46qrp1", "CVM RASCUNHO CONHECIMENTOS ESPECÍFICOS MATEMÁTICA FINANCEIRA", "CVM"],
  ["cms15wnlo0067vpg00qnqfbpi", "7.201,00 RASCUNHO CONHECIMENTOS BANCÁRIOS", "7.201,00"],
  ["cms15wnml0085vpg0b4n92wdy", "emitir títulos do CMN, responsabilizando-se pelo seu resgate. RASCUNHO RASCUNHO CONHECIMENTOS DE INFORMÁTICA", "emitir títulos do CMN, responsabilizando-se pelo seu resgate."],
  ["cms15wnn3009bvpg0s52i0qsk", "confidencialidade RASCUNHO", "confidencialidade"],
  ["cms15wnnu00b2vpg0x5z626u3", "Ctrl+Shift+A RASCUNHO VENDAS E NEGOCIAÇÃO", "Ctrl+Shift+A"],
] as const;

const pdfByContest = {
  cms16omz00002vpvk847qx2re:
    "data/imports/banco-do-brasil/agente-tecnologia/AGENTE DE TECNOLOGIA - Microrregião 158 - TI - GABARITO 1.pdf",
  cms15wngw0002vpg0t03yq5tv:
    "data/imports/banco-do-brasil/agente-comercial/PROVA A - AGENTE COMERCIAL - GABARITO 1.pdf",
} as const;

function normalize(value: string) {
  return value
    .normalize("NFKD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/[^\p{Letter}\p{Number}]+/gu, "")
    .toLowerCase();
}

async function main() {
  if (process.argv[2] !== "--apply" || process.argv[3] !== "--confirm=13") {
    throw new Error("Uso: npm run fix:bb-artifacts -- --apply --confirm=13");
  }
  const extractor = new PdfParseTextExtractor();
  const texts = new Map<string, string>();
  for (const [contestId, path] of Object.entries(pdfByContest)) {
    texts.set(contestId, normalize((await extractor.extract(await readFile(path))).text));
  }
  const prisma = new PrismaClient();
  try {
    const result = await prisma.$transaction(async (transaction) => {
      let updated = 0;
      for (const [id, oldText, officialText] of corrections) {
        const question = await transaction.question.findUniqueOrThrow({
          where: { id },
          include: { alternatives: true, paper: true },
        });
        const alternative = question.alternatives.find(({ letter }) => letter === "E");
        if (!alternative) throw new Error(`${id}: alternativa E ausente.`);
        if (alternative.text === officialText && question.status === PublicationStatus.PUBLISHED) continue;
        if (alternative.text !== oldText) throw new Error(`${id}: conteúdo mudou; correção cancelada.`);
        if (!texts.get(question.concursoId)?.includes(normalize(officialText))) {
          throw new Error(`${id}: texto oficial não confirmado no PDF.`);
        }
        const alternatives = question.alternatives.map((item) => ({
          ...item,
          text: item.id === alternative.id ? officialText : item.text,
        }));
        const candidate = {
          ...question,
          alternatives,
          textReviewed: true,
          alternativesReviewed: true,
          answerKeyReviewed: true,
          annulmentStatus: AnnulmentStatus.NOT_ANNULLED,
        };
        const issues = validateQuestionForPublication(candidate);
        if (issues.length) throw new Error(`${id}: ${issues.join(" ")}`);
        const now = new Date();
        await transaction.alternative.update({
          where: { id: alternative.id },
          data: { text: officialText },
        });
        await transaction.question.update({
          where: { id, status: PublicationStatus.IN_REVIEW },
          data: {
            textReviewed: true,
            alternativesReviewed: true,
            answerKeyReviewed: true,
            annulmentStatus: AnnulmentStatus.NOT_ANNULLED,
            extractionNotes: `${question.extractionNotes ? `${question.extractionNotes}\n` : ""}Correção documental: removido artefato de extração após conferência no PDF oficial; alternativa E preservada.`,
            reviewedAt: now,
            publishedAt: now,
            status: PublicationStatus.PUBLISHED,
          },
        });
        updated += 1;
      }
      return updated;
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    console.log(JSON.stringify({ correctedAndPublished: result }, null, 2));
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
