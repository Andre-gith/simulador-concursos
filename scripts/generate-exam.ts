import { spawnSync } from "node:child_process";
import { readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { examImportSchema } from "../src/lib/examImportSchema";
import { buildDataprevExam } from "../src/lib/import/dataprev-generator";
import { buildTranspetroMechanicalExam } from "../src/lib/import/transpetro-generator";

async function main() {
  const [directoryArgument] = process.argv.slice(2);
  if (!directoryArgument) {
    throw new Error("Uso: npm run generate:exam -- <diretório>");
  }
  const projectRoot = process.cwd();
  const targetDirectory = resolve(directoryArgument);
  const normalized = targetDirectory.replaceAll("\\", "/").toLowerCase();
  const isDataprev = normalized.endsWith(
    "/data/imports/dataprev/desenvolvimento-de-software",
  );
  const isTranspetro = normalized.endsWith(
    "/data/imports/transpetro/manutencao-mecanica",
  );
  if (!isDataprev && !isTranspetro) {
    throw new Error("Caderno não suportado pelo gerador determinístico.");
  }
  const sourceDirectory = isDataprev
    ? resolve(dirname(targetDirectory), "Desenvolvimento de Software")
    : resolve(
        dirname(targetDirectory),
        "Manutenção  Mecânica — Manutenção  Mecânica",
      );
  const helper = resolve(
    dirname(fileURLToPath(import.meta.url)),
    isDataprev
      ? "extract-dataprev-pdf.py"
      : "extract-transpetro-mechanical.py",
  );
  const extraction = spawnSync(
    "python",
    [helper, sourceDirectory, targetDirectory],
    {
      encoding: "utf8",
      env: { ...process.env, PYTHONIOENCODING: "utf-8" },
      maxBuffer: 20 * 1024 * 1024,
    },
  );
  if (extraction.status !== 0) {
    throw new Error(
      `Extração local falhou: ${extraction.stderr || extraction.stdout}`,
    );
  }
  const raw = JSON.parse(extraction.stdout) as {
    pages?: Array<{ number: number; text: string }>;
    questions?: Array<{
      number: number;
      statement: string;
      alternatives: Array<{ letter: string; text: string }>;
      sourcePage: number;
    }>;
    answers: Record<string, boolean | string>;
    assets: Record<string, string>;
  };
  const document = isDataprev
    ? buildDataprevExam({
        pages: raw.pages ?? [],
        answers: raw.answers as Record<string, boolean>,
        assets: raw.assets,
        projectRoot,
      })
    : buildTranspetroMechanicalExam({
        questions: raw.questions ?? [],
        answers: raw.answers as Record<string, string>,
        assets: raw.assets,
        projectRoot,
      });
  const validated = examImportSchema.parse(document);
  const output = resolve(targetDirectory, "exam.json");
  await writeFile(output, `${JSON.stringify(validated, null, 2)}\n`, "utf8");
  const readBack = examImportSchema.parse(
    JSON.parse(await readFile(output, "utf8")) as unknown,
  );
  console.log(
    JSON.stringify({
      output,
      questions: readBack.questions.length,
      first: readBack.questions[0]?.number,
      last: readBack.questions.at(-1)?.number,
      visualQuestions: readBack.questions
        .filter((question) => question.visualAssets.length > 0)
        .map((question) => question.number),
      reviewStatus: readBack.reviewStatus,
    }, null, 2),
  );
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
