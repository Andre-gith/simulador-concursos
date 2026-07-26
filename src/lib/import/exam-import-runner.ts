import {
  summarizeExamImport,
  type ExamImportDocument,
} from "../examImportSchema";

type ImportExecutionOptions<Result> = {
  dryRun: boolean;
  persist(document: ExamImportDocument): Promise<Result>;
};

export async function executeExamImport<Result>(
  document: ExamImportDocument,
  options: ImportExecutionOptions<Result>,
) {
  const summary = summarizeExamImport(document);

  if (options.dryRun) {
    return {
      kind: "dry-run" as const,
      summary,
    };
  }

  return {
    kind: "imported" as const,
    summary,
    result: await options.persist(document),
  };
}
