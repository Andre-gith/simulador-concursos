import { access } from "node:fs/promises";

import {
  AnnulmentStatus,
  Prisma,
  PrismaClient,
  PublicationStatus,
} from "@prisma/client";

import {
  validateContestForPublication,
  validateQuestionForPublication,
} from "../src/lib/publication";
import { resolveImportVisualAsset } from "../src/lib/visualAssets";

const prisma = new PrismaClient();
const reason =
  "Publicação temporária autorizada pelo administrador sem revisão visual individual.";
const confirmation = "--confirm=PUBLICAR-BB-COM-OVERRIDE-VISUAL";
const configs = [
  {
    id: "cms16omz00002vpvk847qx2re",
    specialty: "Agente de Tecnologia",
    expectedPublished: 69,
    expectedArchived: 1,
    expectedOverrides: 21,
  },
  {
    id: "cms15wngw0002vpg0t03yq5tv",
    specialty: "Agente Comercial",
    expectedPublished: 70,
    expectedArchived: 0,
    expectedOverrides: 4,
  },
] as const;

const include = {
  alternatives: true,
  paper: true,
  visualAssets: true,
} satisfies Prisma.QuestionInclude;

async function verifyAssets(
  questions: Array<Prisma.QuestionGetPayload<{ include: typeof include }>>,
) {
  for (const question of questions) {
    if (question.visualAssets.length === 0) {
      throw new Error(`Questão ${question.number}: recurso visual ausente.`);
    }
    for (const asset of question.visualAssets) {
      const resolved = resolveImportVisualAsset(asset.assetPath);
      if (!resolved) {
        throw new Error(`Questão ${question.number}: caminho visual inválido.`);
      }
      await access(resolved.absolutePath);
    }
  }
}

async function main() {
  if (!process.argv.includes("--apply") || !process.argv.includes(confirmation)) {
    throw new Error(
      `Uso: npm run publish:bb-overrides -- --apply ${confirmation}`,
    );
  }

  const pending = await prisma.question.findMany({
    where: {
      concursoId: { in: configs.map((config) => config.id) },
      status: PublicationStatus.IN_REVIEW,
      requiresVisualReview: true,
    },
    include,
  });
  await verifyAssets(pending);

  const result = await prisma.$transaction(
    async (transaction) => {
      const publishedByContest: Record<string, number> = {};
      const now = new Date();
      for (const config of configs) {
        const contest = await transaction.concurso.findUniqueOrThrow({
          where: { id: config.id },
          include: {
            scoringRule: true,
            questions: { include },
          },
        });
        if (contest.especialidade !== config.specialty) {
          throw new Error(`Especialidade incompatível em ${config.id}.`);
        }
        const archived67 = contest.questions.find(
          (question) => question.id === "cms16on8y00ddvpvkbjcj4y5o",
        );
        if (
          config.specialty === "Agente de Tecnologia" &&
          archived67?.status !== PublicationStatus.ARCHIVED
        ) {
          throw new Error("A questão 67 de Tecnologia não está ARCHIVED.");
        }

        const candidates = contest.questions.filter(
          (question) => question.status === PublicationStatus.IN_REVIEW,
        );
        for (const question of candidates) {
          if (!question.requiresVisualReview || question.visualAssets.length === 0) {
            throw new Error(
              `Questão ${question.number}: não é elegível ao override visual.`,
            );
          }
          if (!question.paperId || !question.paper) {
            throw new Error(`Questão ${question.number}: caderno ausente.`);
          }
          const candidate = {
            ...question,
            textReviewed: true,
            alternativesReviewed: true,
            answerKeyReviewed: true,
            publicationOverride: true,
            publicationOverrideReason: reason,
            publicationOverrideAt: now,
            annulmentStatus: AnnulmentStatus.NOT_ANNULLED,
          };
          const issues = validateQuestionForPublication(candidate);
          if (issues.length > 0) {
            throw new Error(issues.join(" "));
          }
        }
        if (candidates.length > 0) {
          const updated = await transaction.question.updateMany({
            where: {
              id: { in: candidates.map((question) => question.id) },
              status: PublicationStatus.IN_REVIEW,
            },
            data: {
              textReviewed: true,
              alternativesReviewed: true,
              answerKeyReviewed: true,
              publicationOverride: true,
              publicationOverrideReason: reason,
              publicationOverrideAt: now,
              annulmentStatus: AnnulmentStatus.NOT_ANNULLED,
              reviewedAt: now,
              publishedAt: now,
              status: PublicationStatus.PUBLISHED,
            },
          });
          if (updated.count !== candidates.length) {
            throw new Error("O estado mudou durante a publicação das questões.");
          }
          publishedByContest[config.id] = updated.count;
        } else {
          publishedByContest[config.id] = 0;
        }

        const refreshed = await transaction.concurso.findUniqueOrThrow({
          where: { id: config.id },
          include: {
            scoringRule: true,
            questions: { include },
          },
        });
        const published = refreshed.questions.filter(
          (question) => question.status === PublicationStatus.PUBLISHED,
        ).length;
        const archived = refreshed.questions.filter(
          (question) => question.status === PublicationStatus.ARCHIVED,
        ).length;
        const activePending = refreshed.questions.filter(
          (question) =>
            question.status !== PublicationStatus.PUBLISHED &&
            question.status !== PublicationStatus.ARCHIVED,
        ).length;
        const overrides = refreshed.questions.filter(
          (question) => question.publicationOverride,
        ).length;
        if (
          published !== config.expectedPublished ||
          archived !== config.expectedArchived ||
          activePending !== 0 ||
          overrides !== config.expectedOverrides
        ) {
          throw new Error(`Contagens finais inválidas em ${config.specialty}.`);
        }
        if (refreshed.status === PublicationStatus.IN_REVIEW) {
          const issues = validateContestForPublication(refreshed);
          if (issues.length > 0) throw new Error(issues.join(" "));
          await transaction.concurso.update({
            where: { id: config.id, status: PublicationStatus.IN_REVIEW },
            data: { status: PublicationStatus.PUBLISHED },
          });
        } else if (refreshed.status !== PublicationStatus.PUBLISHED) {
          throw new Error(`Status de concurso inválido em ${config.specialty}.`);
        }
      }
      return publishedByContest;
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
  );
  console.log(JSON.stringify({ publishedNow: result }, null, 2));
}

main()
  .finally(() => prisma.$disconnect())
  .catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
