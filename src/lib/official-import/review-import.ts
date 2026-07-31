import { readFile } from "node:fs/promises";
import { Prisma, PublicationStatus, type PrismaClient } from "@prisma/client";
import { examImportSchema } from "@/lib/examImportSchema";

export type ReviewImportResult = {
  concursoId: string;
  paperId: string;
  createdQuestions: number;
  unchangedQuestions: number;
  createdAlternatives: number;
  createdVisualAssets: number;
};

function equalRule(current: {
  type: string; pointsCorrect: number; pointsWrong: number; pointsBlank: number;
  floorAtZero: boolean; minimumTotalScore: number | null; minimumCorrect: number | null;
}, expected: {
  type: string; pointsCorrect: number; pointsWrong: number; pointsBlank: number;
  floorAtZero: boolean; minimumTotalScore?: number; minimumCorrect?: number;
}) {
  return current.type === expected.type && current.pointsCorrect === expected.pointsCorrect &&
    current.pointsWrong === expected.pointsWrong && current.pointsBlank === expected.pointsBlank &&
    current.floorAtZero === expected.floorAtZero &&
    current.minimumTotalScore === (expected.minimumTotalScore ?? null) &&
    current.minimumCorrect === (expected.minimumCorrect ?? null);
}

export async function importJobForReview(
  prisma: PrismaClient,
  jobId: string,
  adminUserId: string,
): Promise<ReviewImportResult> {
  return prisma.$transaction(async (tx) => {
    const job = await tx.importJob.findUnique({
      where: { id: jobId },
      include: {
        sourceDocuments: true,
        artifacts: { where: { artifactType: "EXAM_JSON" }, orderBy: { createdAt: "desc" }, take: 1 },
      },
    });
    if (!job) throw new Error("Trabalho de importação não encontrado.");
    if (job.adminUserId !== adminUserId) {
      // ADMINs podem assumir trabalhos de outro ADMIN, mas isso fica auditado.
      await tx.importAuditEvent.create({ data: { importJobId: job.id, adminUserId, action: "IMPORT_ASSUMED_BY_ADMIN" } });
    }
    if (job.stage === "COMPLETED" && job.importResult) {
      return job.importResult as unknown as ReviewImportResult;
    }
    if (job.stage !== "WAITING_REVIEW") throw new Error("O trabalho ainda não está aguardando revisão.");
    if (!job.destinationType || job.destinationType === "CANCELLED") throw new Error("Selecione um destino válido.");
    const validTypes = new Set(job.sourceDocuments.filter((doc) => doc.status === "VALIDATED").map((doc) => doc.documentType));
    if (!validTypes.has("EXAM") || !["ANSWER_KEY_PRELIMINARY", "ANSWER_KEY_FINAL"].some((type) => validTypes.has(type as never))) {
      throw new Error("Prova e gabarito validados são obrigatórios.");
    }
    const artifact = job.artifacts[0];
    if (!artifact) throw new Error("exam.json validado não encontrado.");
    const document = examImportSchema.parse(JSON.parse(await readFile(artifact.localPath, "utf8")));

    const banca = await tx.banca.upsert({ where: { name: document.contest.board }, update: {}, create: { name: document.contest.board } });
    let concurso: { id: string; status: PublicationStatus };
    if (job.destinationType === "EXISTING_CONTEST_NEW_PAPER") {
      if (!job.destinationContestId) throw new Error("Concurso de destino não selecionado.");
      const existing = await tx.concurso.findUnique({ where: { id: job.destinationContestId }, include: { scoringRule: true, banca: true } });
      if (!existing) throw new Error("Concurso de destino não encontrado.");
      if (!["DRAFT", "IN_REVIEW"].includes(existing.status)) throw new Error(`Concurso ${existing.status} não pode receber novo caderno.`);
      if (existing.banca.name !== document.contest.board || existing.orgao !== document.contest.agency ||
          existing.cargo !== document.contest.position || existing.ano !== document.contest.year ||
          existing.especialidade !== (document.contest.specialty ?? null)) {
        throw new Error("O concurso selecionado não corresponde aos metadados confirmados do exam.json.");
      }
      if (existing.scoringRule && !equalRule(existing.scoringRule, document.scoringRule)) {
        throw new Error("A regra de pontuação diverge do concurso selecionado.");
      }
      concurso = existing;
    } else {
      const equivalent = await tx.concurso.findFirst({ where: {
        bancaId: banca.id, orgao: document.contest.agency, cargo: document.contest.position,
        ano: document.contest.year, edicao: document.contest.edition ?? null,
        especialidade: document.contest.specialty ?? null,
      } });
      if (equivalent) throw new Error("Já existe concurso equivalente. Selecione a opção de novo caderno.");
      if (job.destinationType === "EDITORIAL_ENTRY") {
        if (!job.destinationEditorialEntryId) throw new Error("Entrada editorial não selecionada.");
        const entry = await tx.editorialCatalogEntry.findUnique({ where: { id: job.destinationEditorialEntryId } });
        if (!entry) throw new Error("Entrada editorial não encontrada.");
        if (entry.orgao !== document.contest.agency ||
            (entry.cargo !== null && entry.cargo !== document.contest.position) ||
            (entry.ano !== null && entry.ano !== document.contest.year)) {
          throw new Error("A entrada editorial não corresponde aos metadados confirmados do exam.json.");
        }
      }
      concurso = await tx.concurso.create({ data: {
        bancaId: banca.id, orgao: document.contest.agency, cargo: document.contest.position,
        ano: document.contest.year, edicao: document.contest.edition ?? null,
        especialidade: document.contest.specialty ?? null, nivel: document.contest.educationLevel ?? null,
        dataProva: document.paper.appliedAt ? new Date(document.paper.appliedAt) : null,
        editalUrl: document.contest.noticeUrl ?? null, officialPageUrl: document.contest.officialPageUrl ?? null,
        status: "IN_REVIEW",
      } });
    }

    const currentRule = await tx.scoringRule.findUnique({ where: { concursoId: concurso.id } });
    if (!currentRule) await tx.scoringRule.create({ data: { concursoId: concurso.id, ...document.scoringRule } });
    const existingPaper = await tx.examPaper.findUnique({ where: { concursoId_code: { concursoId: concurso.id, code: document.paper.code } } });
    if (existingPaper) throw new Error("O caderno já existe; nenhuma questão foi alterada.");
    const paper = await tx.examPaper.create({ data: {
      concursoId: concurso.id, code: document.paper.code, title: document.contest.edition ?? document.paper.code,
      appliedAt: document.paper.appliedAt ? new Date(document.paper.appliedAt) : null,
      provaUrl: document.paper.examUrl ?? null, gabaritoUrl: document.paper.answerKeyUrl ?? null,
    } });

    const blockIds = new Map<string, string>();
    for (const block of document.blocks) {
      const saved = await tx.examBlock.upsert({
        where: { concursoId_name: { concursoId: concurso.id, name: block.name } },
        update: {},
        create: { concursoId: concurso.id, name: block.name, order: block.order, minimumScore: block.minimumScore ?? null, minimumCorrect: block.minimumCorrect ?? null },
      });
      blockIds.set(block.name, saved.id);
    }
    const subjectIds = new Map<string, string>(); const topicIds = new Map<string, string>();
    for (const subject of document.subjects) {
      const saved = await tx.subject.upsert({ where: { name: subject.name }, update: {}, create: { name: subject.name } });
      subjectIds.set(subject.name, saved.id);
      for (const topic of subject.topics) {
        const savedTopic = await tx.topic.upsert({ where: { subjectId_name: { subjectId: saved.id, name: topic } }, update: {}, create: { subjectId: saved.id, name: topic } });
        topicIds.set(`${subject.name}\0${topic}`, savedTopic.id);
      }
    }
    let createdAlternatives = 0; let createdVisualAssets = 0;
    for (const question of document.questions) {
      const subjectId = subjectIds.get(question.subject);
      if (!subjectId) throw new Error(`Matéria não resolvida: ${question.subject}.`);
      const alternatives = question.type === "MC" ? question.alternatives.map((item) => ({
        letter: item.letter.toUpperCase(), text: item.text, isCorrect: item.isCorrect, isVisual: item.isVisual,
        visualAssetPath: item.visualAssetPath ?? null, visualDescription: item.visualDescription ?? null, sourcePage: item.sourcePage ?? null,
      })) : [];
      const visualAssets = question.visualAssets.map((item) => ({
        placement: item.placement, alternativeLetter: item.alternativeLetter ?? null, assetPath: item.assetPath,
        sourcePage: item.sourcePage, order: item.order, description: item.description ?? null,
      }));
      await tx.question.create({ data: {
        concursoId: concurso.id, paperId: paper.id, blockId: question.block ? blockIds.get(question.block) ?? null : null,
        subjectId, topicId: question.topic ? topicIds.get(`${question.subject}\0${question.topic}`) ?? null : null,
        number: question.number, type: question.type, statement: question.statement,
        ceAnswer: question.type === "CE" ? question.ceAnswer : null, weight: question.weight,
        sourceUrl: question.sourceUrl ?? null, sourcePage: question.sourcePage ?? null,
        requiresVisualReview: question.requiresVisualReview, visualReviewResolved: false,
        textReviewed: false, alternativesReviewed: false, answerKeyReviewed: false,
        annulmentStatus: "PENDING", status: "IN_REVIEW",
        alternatives: alternatives.length ? { create: alternatives } : undefined,
        visualAssets: visualAssets.length ? { create: visualAssets } : undefined,
      } });
      createdAlternatives += alternatives.length; createdVisualAssets += visualAssets.length;
    }
    const result: ReviewImportResult = {
      concursoId: concurso.id, paperId: paper.id, createdQuestions: document.questions.length,
      unchangedQuestions: 0, createdAlternatives, createdVisualAssets,
    };
    await tx.importJob.update({ where: { id: job.id }, data: {
      concursoId: concurso.id, stage: "COMPLETED", status: "REVIEWED", finishedAt: new Date(),
      importResult: result as unknown as Prisma.InputJsonValue,
    } });
    await tx.importAuditEvent.create({ data: {
      importJobId: job.id, adminUserId, action: "IMPORTED_FOR_REVIEW",
      details: { ...result, publicationStatus: "IN_REVIEW" },
    } });
    return result;
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
}
