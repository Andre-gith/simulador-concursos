import type { ExamImportDocument } from "../examImportSchema";

export type ExpectedExamIdentity = {
  specialty: string;
  paperCode: string;
};

export function assertExamIdentity(
  document: Pick<ExamImportDocument, "contest" | "paper">,
  expected: ExpectedExamIdentity,
) {
  if (document.contest.specialty !== expected.specialty) {
    throw new Error(
      `Especialidade incompatível: esperado "${expected.specialty}", recebido "${document.contest.specialty ?? "não informado"}".`,
    );
  }

  if (document.paper.code !== expected.paperCode) {
    throw new Error(
      `Caderno incompatível: esperado "${expected.paperCode}", recebido "${document.paper.code}".`,
    );
  }
}
