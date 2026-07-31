import {
  AnnulmentStatus,
  EducationLevel,
  PublicationStatus,
} from "@prisma/client";
import Link from "next/link";

import { PdfImportForm } from "./PdfImportForm";
import {
  createBank,
  createSubject,
  createTopic,
} from "./actions";
import { requireAdmin } from "@/lib/admin";
import { prisma } from "@/lib/prisma";
import { AdminShell } from "@/components/layout/AdminShell";
import {
  isQuestionReadyForPublication,
  validateQuestionForPublication,
} from "@/lib/publication";
import { BulkReviewForm } from "@/components/admin/BulkReviewForm";

type AdminPageProps = {
  searchParams: Promise<{
    institution?: string | string[];
    position?: string | string[];
    specialty?: string | string[];
    bank?: string | string[];
    status?: string | string[];
    level?: string | string[];
    paper?: string | string[];
    visual?: string | string[];
    annulment?: string | string[];
    reviewState?: string | string[];
  }>;
};

const STATUSES: PublicationStatus[] = [
  "DRAFT",
  "IN_REVIEW",
  "PUBLISHED",
  "ARCHIVED",
];
const LEVELS: EducationLevel[] = [
  "FUNDAMENTAL",
  "MEDIO",
  "TECNICO",
  "SUPERIOR",
];

function first(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] ?? "" : value ?? "";
}

export default async function AdminPage({ searchParams }: AdminPageProps) {
  await requireAdmin();
  const params = await searchParams;
  const institution = first(params.institution).trim().slice(0, 100);
  const position = first(params.position).trim().slice(0, 100);
  const specialty = first(params.specialty).trim().slice(0, 100);
  const bank = first(params.bank);
  const requestedStatus = first(params.status);
  const requestedLevel = first(params.level);
  const paper = first(params.paper).trim().slice(0, 100);
  const visual = first(params.visual);
  const requestedAnnulment = first(params.annulment);
  const reviewState = first(params.reviewState);
  const annulmentStatuses: AnnulmentStatus[] = [
    "PENDING",
    "NOT_ANNULLED",
    "ANNULLED",
  ];
  const annulment = annulmentStatuses.includes(
    requestedAnnulment as AnnulmentStatus,
  )
    ? (requestedAnnulment as AnnulmentStatus)
    : undefined;
  const status = STATUSES.includes(requestedStatus as PublicationStatus)
    ? (requestedStatus as PublicationStatus)
    : undefined;
  const level = LEVELS.includes(requestedLevel as EducationLevel)
    ? (requestedLevel as EducationLevel)
    : undefined;
  const queueStatus =
    reviewState === "published"
      ? PublicationStatus.PUBLISHED
      : reviewState === "archived"
        ? PublicationStatus.ARCHIVED
        : status;

  const [
    banks,
    contests,
    editorialEntries,
    subjects,
    topics,
    blocks,
    papers,
    reviewQuestions,
  ] = await Promise.all([
      prisma.banca.findMany({ orderBy: { name: "asc" } }),
      prisma.concurso.findMany({
        where: {
          ...(institution
            ? { orgao: { contains: institution, mode: "insensitive" } }
            : {}),
          ...(position
            ? { cargo: { contains: position, mode: "insensitive" } }
            : {}),
          ...(specialty
            ? {
                especialidade: {
                  contains: specialty,
                  mode: "insensitive",
                },
              }
            : {}),
          ...(bank ? { bancaId: bank } : {}),
          ...(status ? { status } : {}),
          ...(level ? { nivel: level } : {}),
        },
        include: {
          banca: true,
          questions: {
            select: { status: true, publicationOverride: true },
          },
        },
        orderBy: [{ createdAt: "desc" }],
      }),
      prisma.editorialCatalogEntry.findMany({
        where: {
          ...(institution
            ? { orgao: { contains: institution, mode: "insensitive" } }
            : {}),
          ...(position
            ? { cargo: { contains: position, mode: "insensitive" } }
            : {}),
          ...(specialty
            ? {
                especialidade: {
                  contains: specialty,
                  mode: "insensitive",
                },
              }
            : {}),
          ...(bank ? { bancaId: bank } : {}),
          ...(status ? { status } : {}),
          ...(level ? { nivel: level } : {}),
        },
        include: { banca: true },
        orderBy: [{ orgao: "asc" }, { title: "asc" }],
      }),
      prisma.subject.findMany({ orderBy: { name: "asc" } }),
      prisma.topic.findMany({
        include: { subject: true },
        orderBy: { name: "asc" },
      }),
      prisma.examBlock.count(),
      prisma.examPaper.count(),
      prisma.question.findMany({
        where: {
          ...(queueStatus
            ? { status: queueStatus }
            : reviewState
              ? {}
              : { status: "IN_REVIEW" }),
          ...(institution
            ? {
                concurso: {
                  orgao: { contains: institution, mode: "insensitive" },
                  ...(position
                    ? { cargo: { contains: position, mode: "insensitive" } }
                    : {}),
                  ...(specialty
                    ? {
                        especialidade: {
                          contains: specialty,
                          mode: "insensitive",
                        },
                      }
                    : {}),
                  ...(bank ? { bancaId: bank } : {}),
                },
              }
            : position || specialty || bank
              ? {
                  concurso: {
                    ...(position
                      ? { cargo: { contains: position, mode: "insensitive" } }
                      : {}),
                    ...(specialty
                      ? {
                          especialidade: {
                            contains: specialty,
                            mode: "insensitive",
                          },
                        }
                      : {}),
                    ...(bank ? { bancaId: bank } : {}),
                  },
                }
              : {}),
          ...(paper
            ? {
                paper: {
                  code: { contains: paper, mode: "insensitive" },
                },
              }
            : {}),
          ...(visual === "pending"
            ? { requiresVisualReview: true, visualReviewResolved: false }
            : visual === "override"
              ? { publicationOverride: true }
            : visual === "yes"
              ? { requiresVisualReview: true }
              : visual === "no"
                ? { requiresVisualReview: false }
                : {}),
          ...(annulment ? { annulmentStatus: annulment } : {}),
        },
        include: {
          subject: true,
          block: true,
          paper: true,
          alternatives: {
            select: {
              text: true,
              isCorrect: true,
              isVisual: true,
              visualAssetPath: true,
              sourcePage: true,
            },
          },
          concurso: { include: { banca: true } },
        },
        orderBy: [
          { concurso: { especialidade: "asc" } },
          { paper: { code: "asc" } },
          { number: "asc" },
        ],
      }),
    ]);

  const displayedQuestions = reviewQuestions.filter((question) => {
    const ready = isQuestionReadyForPublication(question);
    if (reviewState === "ready") return ready;
    if (reviewState === "pending") return !ready;
    if (reviewState === "visual") {
      return question.requiresVisualReview && !question.visualReviewResolved;
    }
    if (reviewState === "annulment") {
      return question.annulmentStatus === "PENDING";
    }
    return true;
  });
  const [activeMonitors, pendingOfficialChanges, recentMonitorFailures] =
    await Promise.all([
      prisma.sourceMonitor.count({ where: { enabled: true } }),
      prisma.documentChange.count({ where: { status: "WAITING_REVIEW" } }),
      prisma.monitorRun.count({
        where: {
          status: "FAILED",
          startedAt: { gte: new Date(Date.now() - 7 * 86_400_000) },
        },
      }),
    ]);

  return (
    <AdminShell>
    <main className="mx-auto max-w-7xl px-4 py-10">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-sm font-bold uppercase tracking-[0.18em] text-emerald-800">Nota de Banca</p>
          <h1 className="mt-2 text-3xl font-black text-slate-950">Painel administrativo</h1>
          <p className="mt-2 text-sm text-slate-600">
            Gestão de concursos, importação e revisão editorial.
          </p>
        </div>
        <Link href="/" className="font-bold text-emerald-800">
          Voltar à home
        </Link>
      </div>

      <section className="mt-8 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <Count label="Concursos filtrados" value={contests.length} />
        <Count label="Entradas editoriais" value={editorialEntries.length} />
        <Count label="Blocos" value={blocks} />
        <Count label="Cadernos" value={papers} />
        <Count label="Questões em revisão" value={reviewQuestions.length} />
      </section>

      <section className="mt-8 rounded-2xl border border-amber-300 bg-amber-50 p-5">
        <p className="text-xs font-black uppercase tracking-[0.18em] text-amber-700">
          Novo fluxo administrativo
        </p>
        <div className="mt-2 flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="text-xl font-black text-emerald-950">
              Importar concurso por URL oficial
            </h2>
            <p className="mt-1 text-sm text-slate-600">
              Descoberta, download seguro, extração local, dry-run e revisão em etapas confirmadas.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Link
              href="/admin/importacoes"
              className="rounded-xl border border-emerald-900 px-5 py-3 font-black text-emerald-900"
            >
              Ver importações
            </Link>
            <Link
              href="/admin/importacoes/nova"
              className="rounded-xl bg-emerald-900 px-5 py-3 font-black text-white"
            >
              Iniciar importação
            </Link>
          </div>
        </div>
      </section>

      <section className="mt-8 rounded-2xl border border-emerald-200 bg-emerald-50 p-5">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="text-xl font-black text-emerald-950">Monitoramento oficial</h2>
            <p className="mt-1 text-sm text-slate-600">
              {activeMonitors} monitores ativos · {pendingOfficialChanges} atualizações pendentes · {recentMonitorFailures} falhas recentes
            </p>
          </div>
          <div className="flex gap-3">
            <Link href="/admin/monitoramento/alteracoes" className="rounded-xl border border-emerald-900 px-4 py-3 font-black text-emerald-900">
              Atualizações oficiais pendentes
            </Link>
            <Link href="/admin/monitoramento" className="rounded-xl bg-emerald-900 px-4 py-3 font-black text-white">
              Abrir monitoramento
            </Link>
          </div>
        </div>
      </section>

      <section className="mt-8 rounded-2xl border border-neutral-800 p-5">
        <div>
          <h2 className="text-lg font-semibold">Concursos</h2>
          <p className="mt-1 text-sm text-neutral-500">
            Filtre o catálogo e abra um registro para editar seus metadados ou
            alterar o status.
          </p>
        </div>
        <form
          method="get"
          className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-4"
        >
          <input
            name="institution"
            defaultValue={institution}
            placeholder="Instituição"
            className="input"
          />
          <input
            name="position"
            defaultValue={position}
            placeholder="Cargo"
            className="input"
          />
          <input
            name="specialty"
            defaultValue={specialty}
            placeholder="Especialidade"
            className="input"
          />
          <select name="bank" defaultValue={bank} className="input">
            <option value="">Todas as bancas</option>
            {banks.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
          </select>
          <select name="status" defaultValue={status ?? ""} className="input">
            <option value="">Todos os status</option>
            {STATUSES.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>
          <select name="level" defaultValue={level ?? ""} className="input">
            <option value="">Todos os níveis</option>
            {LEVELS.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>
          <input
            name="paper"
            defaultValue={paper}
            placeholder="Caderno"
            className="input"
          />
          <select name="visual" defaultValue={visual} className="input">
            <option value="">Qualquer elemento visual</option>
            <option value="pending">Revisão visual pendente</option>
            <option value="override">Publicadas por override</option>
            <option value="yes">Com elemento visual</option>
            <option value="no">Sem elemento visual</option>
          </select>
          <select
            name="annulment"
            defaultValue={annulment ?? ""}
            className="input"
          >
            <option value="">Qualquer situação de anulação</option>
            <option value="PENDING">Anulação pendente</option>
            <option value="NOT_ANNULLED">Não anulada</option>
            <option value="ANNULLED">Anulada</option>
          </select>
          <select
            name="reviewState"
            defaultValue={reviewState}
            className="input"
          >
            <option value="">Todas da fila atual</option>
            <option value="ready">Prontas para publicar</option>
            <option value="pending">Com pendências</option>
            <option value="visual">Revisão visual pendente</option>
            <option value="annulment">Anulação pendente</option>
            <option value="published">Publicadas</option>
            <option value="archived">Arquivadas</option>
          </select>
          <div className="flex gap-2">
            <button className="flex-1 rounded-lg bg-orange-500 px-4 py-2 font-semibold text-neutral-950">
              Filtrar
            </button>
            <Link
              href="/admin"
              className="rounded-lg border border-neutral-700 px-4 py-3 text-sm"
            >
              Limpar
            </Link>
          </div>
        </form>

        <div className="mt-6 overflow-x-auto">
          <table className="min-w-[1100px] w-full text-left text-sm">
            <thead className="border-b border-neutral-800 text-xs uppercase text-neutral-500">
              <tr>
                <th className="px-3 py-3">Instituição</th>
                <th className="px-3 py-3">Banca</th>
                <th className="px-3 py-3">Cargo / especialidade</th>
                <th className="px-3 py-3">Edição</th>
                <th className="px-3 py-3">Nível</th>
                <th className="px-3 py-3">Status</th>
                <th className="px-3 py-3 text-center">Total</th>
                <th className="px-3 py-3 text-center">Revisão</th>
                <th className="px-3 py-3 text-center">Publicadas</th>
                <th className="px-3 py-3 text-center">Override visual</th>
                <th className="px-3 py-3">Ação</th>
              </tr>
            </thead>
            <tbody>
              {contests.map((contest) => {
                const inReview = contest.questions.filter(
                  (question) => question.status === "IN_REVIEW",
                ).length;
                const published = contest.questions.filter(
                  (question) => question.status === "PUBLISHED",
                ).length;
                const overrides = contest.questions.filter(
                  (question) => question.publicationOverride,
                ).length;
                return (
                  <tr
                    key={contest.id}
                    className="border-b border-neutral-900 align-top"
                  >
                    <td className="px-3 py-4 font-medium">{contest.orgao}</td>
                    <td className="px-3 py-4">{contest.banca.name}</td>
                    <td className="px-3 py-4">
                      <span className="block">{contest.cargo}</span>
                      <span className="text-neutral-500">
                        {contest.especialidade ?? "Sem especialidade"}
                      </span>
                    </td>
                    <td className="px-3 py-4">
                      {contest.edicao ?? "—"} · {contest.ano}
                    </td>
                    <td className="px-3 py-4">{contest.nivel ?? "—"}</td>
                    <td className="px-3 py-4">
                      <StatusBadge status={contest.status} />
                    </td>
                    <td className="px-3 py-4 text-center">
                      {contest.questions.length}
                    </td>
                    <td className="px-3 py-4 text-center">{inReview}</td>
                    <td className="px-3 py-4 text-center">{published}</td>
                    <td className="px-3 py-4 text-center">{overrides}</td>
                    <td className="px-3 py-4">
                      <Link
                        href={`/admin/concursos/${contest.id}`}
                        className="font-semibold text-orange-400"
                      >
                        Editar
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {contests.length === 0 && (
            <p className="py-8 text-center text-neutral-500">
              Nenhum concurso corresponde aos filtros.
            </p>
          )}
        </div>
      </section>

      <section className="mt-8 rounded-2xl border border-neutral-800 p-5">
        <h2 className="text-lg font-semibold">Entradas editoriais</h2>
        <p className="mt-1 text-sm text-neutral-500">
          Registros em preparação, sem prova, regra ou questões. Eles permanecem
          separados até os documentos oficiais permitirem criar um concurso.
        </p>
        <div className="mt-5 overflow-x-auto">
          <table className="min-w-[850px] w-full text-left text-sm">
            <thead className="border-b border-neutral-800 text-xs uppercase text-neutral-500">
              <tr>
                <th className="px-3 py-3">Instituição</th>
                <th className="px-3 py-3">Banca</th>
                <th className="px-3 py-3">Cargo</th>
                <th className="px-3 py-3">Especialidade</th>
                <th className="px-3 py-3">Nível</th>
                <th className="px-3 py-3">Status</th>
              </tr>
            </thead>
            <tbody>
              {editorialEntries.map((entry) => (
                <tr key={entry.id} className="border-b border-neutral-900">
                  <td className="px-3 py-4 font-medium">{entry.orgao}</td>
                  <td className="px-3 py-4">
                    {entry.banca?.name ?? "A confirmar"}
                  </td>
                  <td className="px-3 py-4">
                    {entry.cargo ?? "A confirmar"}
                  </td>
                  <td className="px-3 py-4">{entry.especialidade ?? "—"}</td>
                  <td className="px-3 py-4">{entry.nivel ?? "—"}</td>
                  <td className="px-3 py-4">
                    <StatusBadge status={entry.status} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {editorialEntries.length === 0 && (
            <p className="py-8 text-center text-neutral-500">
              Nenhuma entrada editorial corresponde aos filtros.
            </p>
          )}
        </div>
      </section>

      <section className="mt-8 grid gap-4 md:grid-cols-3">
        <AdminForm
          title={`Bancas (${banks.length})`}
          action={createBank}
          fields={
            <input
              name="name"
              required
              placeholder="Nome da banca"
              className="input"
            />
          }
        />
        <AdminForm
          title={`Matérias (${subjects.length})`}
          action={createSubject}
          fields={
            <input
              name="name"
              required
              placeholder="Nome da matéria"
              className="input"
            />
          }
        />
        <AdminForm
          title={`Assuntos (${topics.length})`}
          action={createTopic}
          fields={
            <>
              <select name="subjectId" required className="input">
                {subjects.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                  </option>
                ))}
              </select>
              <input
                name="name"
                required
                placeholder="Nome do assunto"
                className="input"
              />
            </>
          }
        />
      </section>

      <section className="mt-8 rounded-2xl border border-neutral-800 p-5">
        <h2 className="text-lg font-semibold">Fila de revisão</h2>
        <p className="mt-1 text-sm text-slate-600">
          Selecione apenas as questões conferidas nesta sessão. A operação é
          atômica: se uma seleção for inválida, nenhuma questão será alterada.
        </p>
        <BulkReviewForm>
        <div className="mt-4 overflow-x-auto">
          <table className="min-w-[1150px] w-full text-left text-sm">
            <thead className="border-b border-neutral-800 text-xs uppercase text-neutral-500">
              <tr>
                <th className="px-3 py-3">Selecionar</th>
                <th className="px-3 py-3">Número</th>
                <th className="px-3 py-3">Concurso</th>
                <th className="px-3 py-3">Matéria</th>
                <th className="px-3 py-3">Bloco</th>
                <th className="px-3 py-3">Página</th>
                <th className="px-3 py-3">Caderno</th>
                <th className="px-3 py-3">Status</th>
                <th className="px-3 py-3">Gabarito</th>
                <th className="px-3 py-3">Visual</th>
                <th className="px-3 py-3">Anulação</th>
                <th className="px-3 py-3">Ação</th>
              </tr>
            </thead>
            <tbody>
              {displayedQuestions.map((question) => {
                const hasAnswerKey =
                  question.type === "CE"
                    ? question.ceAnswer !== null
                    : question.alternatives.filter(
                        (alternative) => alternative.isCorrect,
                      ).length === 1;
                const publicationIssues =
                  validateQuestionForPublication(question);
                const batchBlocked =
                  question.status === "ARCHIVED" ||
                  (question.requiresVisualReview &&
                    !question.visualReviewResolved) ||
                  Boolean(
                    question.extractionNotes &&
                      /\b(diverg|conflit|incompat)/i.test(
                        question.extractionNotes,
                      ),
                  );
                return (
                  <tr
                    key={question.id}
                    className={
                      question.requiresVisualReview &&
                      !question.visualReviewResolved
                        ? "border-b border-amber-900 bg-amber-950/20"
                        : "border-b border-neutral-900"
                    }
                  >
                    <td className="px-3 py-4">
                      <input
                        type="checkbox"
                        name="questionIds"
                        value={question.id}
                        disabled={batchBlocked}
                        aria-label={`Selecionar questão ${question.number ?? "sem número"}`}
                      />
                    </td>
                    <td className="px-3 py-4 font-semibold">
                      {question.number ?? "—"}
                    </td>
                    <td className="px-3 py-4">
                      <span className="block">{question.concurso.orgao}</span>
                      <span className="text-xs text-neutral-500">
                        {question.concurso.especialidade ?? question.concurso.cargo}
                      </span>
                    </td>
                    <td className="px-3 py-4">{question.subject.name}</td>
                    <td className="px-3 py-4">{question.block?.name ?? "—"}</td>
                    <td className="px-3 py-4">
                      {question.sourcePage ?? "—"}
                    </td>
                    <td className="px-3 py-4">
                      {question.paper?.code ?? "—"}
                    </td>
                    <td className="px-3 py-4">
                      <StatusBadge status={question.status} />
                      <span className="mt-1 block text-xs text-slate-500">
                        {publicationIssues.length === 0
                          ? "Pronta"
                          : `${publicationIssues.length} impedimento(s)`}
                      </span>
                    </td>
                    <td className="px-3 py-4">
                      {hasAnswerKey ? "Presente" : "Ausente"}
                    </td>
                    <td className="px-3 py-4">
                      {question.publicationOverride
                        ? "Publicada por override administrativo — revisão visual pendente."
                        : question.requiresVisualReview
                          ? question.visualReviewResolved
                            ? "Resolvido"
                            : "Pendente"
                          : "Não"}
                    </td>
                    <td className="px-3 py-4">
                      {question.annulmentStatus}
                    </td>
                    <td className="px-3 py-4">
                      <Link
                        href={`/admin/questoes/${question.id}`}
                        className="font-semibold text-orange-400"
                      >
                        Revisar
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {displayedQuestions.length === 0 && (
            <p className="py-6 text-neutral-500">
              Nenhuma questão aguardando revisão.
            </p>
          )}
        </div>
        </BulkReviewForm>
      </section>

      <section className="mt-8 rounded-2xl border border-neutral-700 p-5">
        <h2 className="font-semibold">Importação de documentos oficiais</h2>
        <p className="mt-2 text-sm text-neutral-400">
          Envie a prova e o gabarito oficiais. Toda questão importada entra na
          fila como IN_REVIEW e exige revisão humana.
        </p>
        <PdfImportForm
          aiConfigured={Boolean(
            process.env.ANTHROPIC_API_KEY?.trim() &&
              process.env.ANTHROPIC_MODEL?.trim(),
          )}
        />
      </section>
    </main>
    </AdminShell>
  );
}

function AdminForm({
  title,
  action,
  fields,
}: {
  title: string;
  action: (data: FormData) => Promise<void>;
  fields: React.ReactNode;
}) {
  return (
    <form
      action={action}
      className="space-y-3 rounded-2xl border border-slate-200 bg-white p-4"
    >
      <h2 className="font-semibold">{title}</h2>
      {fields}
      <button className="rounded-xl bg-amber-400 px-4 py-2 font-bold text-slate-950">
        Criar
      </button>
    </form>
  );
}

function Count({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <strong className="text-2xl text-slate-950">{value}</strong>
      <span className="block text-xs text-slate-500">{label}</span>
    </div>
  );
}

function StatusBadge({ status }: { status: PublicationStatus }) {
  const styles: Record<PublicationStatus, string> = {
    DRAFT: "bg-slate-100 text-slate-700",
    IN_REVIEW: "bg-amber-100 text-amber-900",
    PUBLISHED: "bg-emerald-100 text-emerald-900",
    ARCHIVED: "bg-red-50 text-red-700",
  };
  return (
    <span className={`rounded-full px-2 py-1 text-xs font-bold ${styles[status]}`}>
      {status}
    </span>
  );
}
