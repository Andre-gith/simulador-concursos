import type {
  EducationLevel,
  PublicationStatus,
} from "@prisma/client";
import Link from "next/link";

import { PdfImportForm } from "./PdfImportForm";
import { createBank, createSubject, createTopic } from "./actions";
import { requireAdmin } from "@/lib/admin";
import { prisma } from "@/lib/prisma";

type AdminPageProps = {
  searchParams: Promise<{
    institution?: string | string[];
    bank?: string | string[];
    status?: string | string[];
    level?: string | string[];
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
  const bank = first(params.bank);
  const requestedStatus = first(params.status);
  const requestedLevel = first(params.level);
  const status = STATUSES.includes(requestedStatus as PublicationStatus)
    ? (requestedStatus as PublicationStatus)
    : undefined;
  const level = LEVELS.includes(requestedLevel as EducationLevel)
    ? (requestedLevel as EducationLevel)
    : undefined;

  const [banks, contests, subjects, topics, blocks, papers, reviewQuestions] =
    await Promise.all([
      prisma.banca.findMany({ orderBy: { name: "asc" } }),
      prisma.concurso.findMany({
        where: {
          ...(institution
            ? { orgao: { contains: institution, mode: "insensitive" } }
            : {}),
          ...(bank ? { bancaId: bank } : {}),
          ...(status ? { status } : {}),
          ...(level ? { nivel: level } : {}),
        },
        include: {
          banca: true,
          questions: { select: { status: true } },
        },
        orderBy: [{ createdAt: "desc" }],
      }),
      prisma.subject.findMany({ orderBy: { name: "asc" } }),
      prisma.topic.findMany({
        include: { subject: true },
        orderBy: { name: "asc" },
      }),
      prisma.examBlock.count(),
      prisma.examPaper.count(),
      prisma.question.findMany({
        where: { status: "IN_REVIEW" },
        include: { subject: true, concurso: true },
        orderBy: { createdAt: "asc" },
      }),
    ]);

  return (
    <main className="mx-auto max-w-7xl px-4 py-10">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">Painel administrativo</h1>
          <p className="text-sm text-neutral-500">
            Gestão de concursos, importação e revisão editorial.
          </p>
        </div>
        <Link href="/" className="text-orange-400">
          Voltar
        </Link>
      </div>

      <section className="mt-8 grid gap-3 sm:grid-cols-4">
        <Count label="Concursos filtrados" value={contests.length} />
        <Count label="Blocos" value={blocks} />
        <Count label="Cadernos" value={papers} />
        <Count label="Questões em revisão" value={reviewQuestions.length} />
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
          className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-5"
        >
          <input
            name="institution"
            defaultValue={institution}
            placeholder="Instituição"
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
        <div className="mt-4 space-y-2">
          {reviewQuestions.map((question) => (
            <Link
              key={question.id}
              href={`/admin/questoes/${question.id}`}
              className="block rounded-lg bg-neutral-900 p-3"
            >
              Questão {question.number ?? "sem número"} ·{" "}
              {question.subject.name} · {question.concurso.orgao}
            </Link>
          ))}
          {reviewQuestions.length === 0 && (
            <p className="text-neutral-500">
              Nenhuma questão aguardando revisão.
            </p>
          )}
        </div>
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
      className="space-y-3 rounded-2xl border border-neutral-800 p-4"
    >
      <h2 className="font-semibold">{title}</h2>
      {fields}
      <button className="rounded-lg bg-orange-500 px-4 py-2 text-neutral-950">
        Criar
      </button>
    </form>
  );
}

function Count({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl bg-neutral-900 p-4">
      <strong className="text-2xl">{value}</strong>
      <span className="block text-xs text-neutral-500">{label}</span>
    </div>
  );
}

function StatusBadge({ status }: { status: PublicationStatus }) {
  return (
    <span className="rounded-full bg-neutral-800 px-2 py-1 text-xs font-semibold">
      {status}
    </span>
  );
}
