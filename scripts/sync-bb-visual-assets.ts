import { readdir } from "node:fs/promises";
import { resolve } from "node:path";

import {
  Prisma,
  PrismaClient,
  PublicationStatus,
  VisualPlacement,
} from "@prisma/client";

const prisma = new PrismaClient();
const configs = [
  {
    contestId: "cms16omz00002vpvk847qx2re",
    specialty: "Agente de Tecnologia",
    directory: "data/imports/banco-do-brasil/agente-tecnologia",
    questions: [26, 33, 36, 37, 38, 40, 45, 48, 51, 55, 56, 58, 59, 60, 63, 64, 65, 66, 68, 69, 70],
  },
  {
    contestId: "cms15wngw0002vpg0t03yq5tv",
    specialty: "Agente Comercial",
    directory: "data/imports/banco-do-brasil/agente-comercial",
    questions: [18, 19, 41, 60],
  },
] as const;

function pageFrom(fileName: string) {
  const match = fileName.match(/-p(\d+)\.png$/i);
  if (!match) throw new Error(`Nome de recurso visual inválido: ${fileName}`);
  return Number(match[1]);
}

async function main() {
  const result = await prisma.$transaction(async (tx) => {
    let created = 0;
    let ignored = 0;
    for (const config of configs) {
      const contest = await tx.concurso.findUniqueOrThrow({
        where: { id: config.contestId },
        select: { especialidade: true },
      });
      if (contest.especialidade !== config.specialty) {
        throw new Error(`Especialidade incompatível em ${config.contestId}.`);
      }
      for (const number of config.questions) {
        const question = await tx.question.findFirstOrThrow({
          where: {
            concursoId: config.contestId,
            number,
            status: PublicationStatus.IN_REVIEW,
          },
          select: { id: true },
        });
        const directory = `${config.directory}/assets/questao-${number}`;
        const files = (await readdir(resolve(directory)))
          .filter((file) => /^visual-\d+-p\d+\.png$/i.test(file))
          .sort();
        if (files.length === 0) {
          throw new Error(`Nenhum recurso visual para a questão ${number}.`);
        }
        for (const [order, file] of files.entries()) {
          const assetPath = `${directory}/${file}`;
          const found = await tx.questionVisualAsset.findUnique({
            where: {
              questionId_assetPath: { questionId: question.id, assetPath },
            },
            select: { id: true },
          });
          if (found) {
            ignored += 1;
          } else {
            await tx.questionVisualAsset.create({
              data: {
                questionId: question.id,
                placement: VisualPlacement.STATEMENT,
                assetPath,
                sourcePage: pageFrom(file),
                order,
                description:
                  "Recorte fiel da prova oficial; revisão visual humana obrigatória.",
              },
            });
            created += 1;
          }
        }
      }
    }
    return { created, ignored };
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  console.log(JSON.stringify(result, null, 2));
}

main()
  .finally(() => prisma.$disconnect())
  .catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
