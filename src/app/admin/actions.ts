"use server";

import { revalidatePath } from "next/cache";

import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/admin";

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
  if (!["IN_REVIEW", "PUBLISHED", "ARCHIVED"].includes(status)) {
    throw new Error("Status inválido.");
  }
  const question = await prisma.question.findUnique({
    where: { id },
    include: { alternatives: true },
  });
  if (!question) throw new Error("Questão não encontrada.");
  if (
    status === "PUBLISHED" &&
    ((question.type === "CE" && question.ceAnswer === null) ||
      (question.type === "MC" &&
        question.alternatives.filter((item) => item.isCorrect).length !== 1) ||
      question.weight <= 0)
  ) {
    throw new Error("A questão não passou pela validação de publicação.");
  }
  await prisma.question.update({
    where: { id },
    data: { status: status as "IN_REVIEW" | "PUBLISHED" | "ARCHIVED" },
  });
  revalidatePath("/admin");
  revalidatePath(`/admin/questoes/${id}`);
}
