"use server";

import { Buffer } from "node:buffer";

import {
  Prisma,
  PublicationStatus,
  type EducationLevel,
} from "@prisma/client";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/admin";
import { createAnthropicExamExtractor } from "@/lib/ai/providers/anthropic";
import {
  ExamImportService,
  PrismaExamImportPersistence,
} from "@/lib/import/import-service";
import {
  pdfImportMetadataSchema,
  runPdfImportWorkflow,
  validatePdfPair,
} from "@/lib/import/pdf-import-workflow";
import {
  validateContestForPublication,
  validateQuestionForPublication,
} from "@/lib/publication";

function text(data: FormData, name: string) {
  const value = data.get(name);
  if (typeof value !== "string" || !value.trim()) {
    throw new Error(`Campo obrigatório: ${name}.`);
  }
  return value.trim();
}

export async function createBank(data: FormData) {
  await requireAdmin();
  await prisma.banca.create({ data: { name: text(data, "name") } });
  revalidatePath("/admin");
}

export async function createSubject(data: FormData) {
  await requireAdmin();
  await prisma.subject.create({ data: { name: text(data, "name") } });
  revalidatePath("/admin");
}

export async function createTopic(data: FormData) {
  await requireAdmin();
  await prisma.topic.create({
    data: {
      name: text(data, "name"),
      subjectId: text(data, "subjectId"),
    },
  });
  revalidatePath("/admin");
}

export async function setQuestionStatus(data: FormData) {
  await requireAdmin();
  const id = text(data, "id");
  const status = text(data, "status");
  if (!["DRAFT", "IN_REVIEW", "PUBLISHED", "ARCHIVED"].includes(status)) {
    throw new Error("Status inválido.");
  }
  await prisma.$transaction(
    async (transaction) => {
      const question = await transaction.question.findUnique({
        where: { id },
        include: {
          alternatives: true,
          paper: true,
          concurso: { select: { status: true } },
        },
      });
      if (!question) throw new Error("Questão não encontrada.");
      if (
        question.concurso.status === PublicationStatus.PUBLISHED &&
        question.status === PublicationStatus.PUBLISHED &&
        status !== PublicationStatus.PUBLISHED
      ) {
        throw new Error(
          "Retorne o concurso para IN_REVIEW antes de retirar uma questão publicada.",
        );
      }
      if (status === PublicationStatus.PUBLISHED) {
        const issues = validateQuestionForPublication(question);
        if (issues.length > 0) throw new Error(issues.join(" "));
      }
      await transaction.question.update({
        where: { id },
        data: {
          status: status as PublicationStatus,
        },
      });
    },
    { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
  );
  revalidatePath("/admin");
  revalidatePath(`/admin/questoes/${id}`);
}

const optionalMetadata = z
  .string()
  .trim()
  .transform((value) => value || null);
const optionalUrl = z
  .string()
  .trim()
  .transform((value) => value || null)
  .refine((value) => value === null || URL.canParse(value), {
    message: "Informe uma URL absoluta válida.",
  });
const contestMetadataSchema = z.object({
  id: z.string().trim().min(1),
  bancaId: z.string().trim().min(1, "Selecione a banca."),
  orgao: z.string().trim().min(1, "Informe a instituição."),
  cargo: z.string().trim().min(1, "Informe o cargo."),
  especialidade: optionalMetadata,
  edicao: optionalMetadata,
  ano: z.coerce.number().int().min(1900).max(2200),
  nivel: z
    .enum(["", "FUNDAMENTAL", "MEDIO", "TECNICO", "SUPERIOR"])
    .transform((value) => (value || null) as EducationLevel | null),
  officialPageUrl: optionalUrl,
  editalUrl: optionalUrl,
});

export type AdminActionState = {
  status: "idle" | "success" | "error";
  message: string;
};

export async function updateContestMetadata(
  _previousState: AdminActionState,
  data: FormData,
): Promise<AdminActionState> {
  await requireAdmin();
  const validation = contestMetadataSchema.safeParse({
    id: data.get("id"),
    bancaId: data.get("bancaId"),
    orgao: data.get("orgao"),
    cargo: data.get("cargo"),
    especialidade: data.get("especialidade"),
    edicao: data.get("edicao"),
    ano: data.get("ano"),
    nivel: data.get("nivel"),
    officialPageUrl: data.get("officialPageUrl"),
    editalUrl: data.get("editalUrl"),
  });
  if (!validation.success) {
    return {
      status: "error",
      message: validation.error.issues
        .map((issue) => issue.message)
        .join(" "),
    };
  }

  const { id, ...metadata } = validation.data;
  const bankExists = await prisma.banca.findUnique({
    where: { id: metadata.bancaId },
    select: { id: true },
  });
  if (!bankExists) {
    return { status: "error", message: "A banca selecionada não existe." };
  }
  const result = await prisma.concurso.updateMany({
    where: { id },
    data: metadata,
  });
  if (result.count !== 1) {
    return { status: "error", message: "Concurso não encontrado." };
  }

  revalidatePath("/");
  revalidatePath("/admin");
  revalidatePath(`/admin/concursos/${id}`);
  return { status: "success", message: "Metadados atualizados com segurança." };
}

export async function setContestStatus(
  _previousState: AdminActionState,
  data: FormData,
): Promise<AdminActionState> {
  await requireAdmin();
  const id = text(data, "id");
  const parsedStatus = z
    .nativeEnum(PublicationStatus)
    .safeParse(data.get("status"));
  if (!parsedStatus.success) {
    return { status: "error", message: "Status de concurso inválido." };
  }

  try {
    await prisma.$transaction(
      async (transaction) => {
        const contest = await transaction.concurso.findUnique({
          where: { id },
          include: {
            scoringRule: true,
            questions: {
              include: { alternatives: true, paper: true },
            },
          },
        });
        if (!contest) throw new Error("Concurso não encontrado.");

        if (parsedStatus.data === PublicationStatus.PUBLISHED) {
          const issues = validateContestForPublication(contest);
          if (issues.length > 0) throw new Error(issues.join(" "));
        }
        await transaction.concurso.update({
          where: { id },
          data: { status: parsedStatus.data },
        });
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
  } catch (error) {
    console.error("Alteração de status do concurso rejeitada.", {
      contestId: id,
      requestedStatus: parsedStatus.data,
      error: error instanceof Error ? error.message : String(error),
    });
    return {
      status: "error",
      message:
        error instanceof Error
          ? error.message
          : "Não foi possível alterar o status.",
    };
  }

  revalidatePath("/");
  revalidatePath("/admin");
  revalidatePath(`/admin/concursos/${id}`);
  return {
    status: "success",
    message: `Status alterado para ${parsedStatus.data}.`,
  };
}

export type PdfImportActionState = {
  status: "idle" | "success" | "warning" | "error";
  message: string;
  intermediatePath?: string;
};

async function uploadedPdf(data: FormData, name: string) {
  const value = data.get(name);
  if (!(value instanceof File) || value.size === 0) return undefined;
  return Buffer.from(await value.arrayBuffer());
}

export async function importOfficialPdfs(
  _previousState: PdfImportActionState,
  data: FormData,
): Promise<PdfImportActionState> {
  await requireAdmin();

  try {
    const metadataResult = pdfImportMetadataSchema.safeParse({
      agency: data.get("agency"),
      board: data.get("board"),
      year: data.get("year"),
      edition: data.get("edition"),
      position: data.get("position"),
      specialty: data.get("specialty"),
      educationLevel: data.get("educationLevel"),
      paperCode: data.get("paperCode"),
    });
    if (!metadataResult.success) {
      return {
        status: "error",
        message: metadataResult.error.issues
          .map((issue) => issue.message)
          .join(" "),
      };
    }

    const files = validatePdfPair({
      exam: await uploadedPdf(data, "examPdf"),
      answerKey: await uploadedPdf(data, "answerKeyPdf"),
    });
    const aiConfiguration = createAnthropicExamExtractor();
    const importService = new ExamImportService(
      new PrismaExamImportPersistence(prisma),
    );
    const result = await runPdfImportWorkflow({
      files,
      metadata: metadataResult.data,
      aiExtractor: aiConfiguration.configured
        ? aiConfiguration.extractor
        : undefined,
      importService: aiConfiguration.configured ? importService : undefined,
    });

    if (!aiConfiguration.configured) {
      return {
        status: "warning",
        message: aiConfiguration.message,
        intermediatePath: result.intermediateRelativePath,
      };
    }

    revalidatePath("/admin");
    return {
      status: "success",
      message: `${result.importResult?.createdQuestions ?? 0} questões criadas e ${result.importResult?.updatedQuestions ?? 0} atualizadas. Todas permanecem em revisão humana.`,
      intermediatePath: result.intermediateRelativePath,
    };
  } catch (error) {
    console.error("Falha na importação administrativa por PDF.", {
      error: error instanceof Error ? error.message : String(error),
    });
    return {
      status: "error",
      message:
        error instanceof Error
          ? error.message
          : "Não foi possível processar os documentos.",
    };
  }
}
