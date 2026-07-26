import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";

import {
  setQuestionStatus,
  updateQuestionReview,
} from "../../actions";
import { requireAdmin } from "@/lib/admin";
import { prisma } from "@/lib/prisma";
import { validateQuestionForPublication } from "@/lib/publication";
import { AdminShell } from "@/components/layout/AdminShell";
import { loadImportVisualAsset } from "@/lib/visualAssets";
import { ConfirmButton } from "@/components/admin/ConfirmButton";

export default async function ReviewQuestionPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireAdmin();
  const { id } = await params;
  const question = await prisma.question.findUnique({
    where: { id },
    include: {
      concurso: { include: { banca: true } },
      paper: true,
      subject: true,
      topic: true,
      block: true,
      alternatives: { orderBy: { letter: "asc" } },
    },
  });
  if (!question) notFound();
  const [subjects, topics, blocks, papers] = await Promise.all([
    prisma.subject.findMany({ orderBy: { name: "asc" } }),
    prisma.topic.findMany({ orderBy: { name: "asc" } }),
    prisma.examBlock.findMany({
      where: { concursoId: question.concursoId },
      orderBy: { order: "asc" },
    }),
    prisma.examPaper.findMany({
      where: { concursoId: question.concursoId },
      orderBy: { code: "asc" },
    }),
  ]);

  const source = question.sourceUrl ?? question.paper?.provaUrl ?? null;
  const correctAlternative = question.alternatives.find(
    (alternative) => alternative.isCorrect,
  );
  const answerKey =
    question.type === "CE"
      ? question.ceAnswer === null
        ? "Não informado"
        : question.ceAnswer
          ? "Certo"
          : "Errado"
      : correctAlternative
        ? `${correctAlternative.letter} — ${correctAlternative.text}`
        : "Não informado";
  const publicationIssues = validateQuestionForPublication(question);
  const visualAssets = new Map<string, string | null>(
    await Promise.all(
      question.alternatives.map(
        async (alternative) =>
          [
            alternative.id,
            await loadImportVisualAsset(alternative.visualAssetPath),
          ] as const,
      ),
    ),
  );

  return (
    <AdminShell>
    <main className="mx-auto max-w-4xl px-4 py-10">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-sm text-orange-400">
            {question.concurso.banca.name} · {question.concurso.orgao}
          </p>
          <h1 className="mt-1 text-2xl font-semibold">
            Revisão da questão {question.number ?? "sem número"}
          </h1>
          <p className="mt-2 text-sm text-neutral-500">
            Status atual: {question.status}
          </p>
        </div>
        <Link href="/admin" className="text-orange-400">
          Voltar à fila
        </Link>
      </div>

      <section className="mt-6 grid gap-3 rounded-xl bg-neutral-900 p-5 text-sm sm:grid-cols-3">
        <Info label="Instituição" value={question.concurso.orgao} />
        <Info label="Cargo" value={question.concurso.cargo} />
        <Info
          label="Especialidade"
          value={question.concurso.especialidade ?? "Não informada"}
        />
        <Info
          label="Edição"
          value={`${question.concurso.edicao ?? "Sem edição"} · ${question.concurso.ano}`}
        />
        <Info label="Prova" value={question.paper?.title ?? "Não informada"} />
        <Info label="Matéria" value={question.subject.name} />
        <Info label="Assunto" value={question.topic?.name ?? "Não informado"} />
        <Info label="Bloco" value={question.block?.name ?? "Não informado"} />
        <Info label="Peso" value={String(question.weight)} />
        <Info
          label="Página no PDF"
          value={
            question.sourcePage ? String(question.sourcePage) : "Não informada"
          }
        />
        <Info
          label="Caderno"
          value={question.paper?.code ?? "Não informado"}
        />
        <Info
          label="Elemento visual"
          value={
            question.requiresVisualReview
              ? question.visualReviewResolved
                ? "Revisado"
                : "Revisão pendente"
              : "Não identificado"
          }
        />
        <Info
          label="Anulação"
          value={question.annulmentStatus}
        />
      </section>

      <section className="mt-6 rounded-xl border border-neutral-800 p-5">
        <h2 className="font-semibold">PDF ou referência da fonte</h2>
        <div className="mt-3 break-all text-sm text-neutral-300">
          {source ? <SourceReference source={source} /> : "Não informada"}
        </div>
      </section>

      <section className="mt-6 rounded-xl border border-neutral-800 p-5">
        <h2 className="font-semibold">Enunciado</h2>
        <p className="mt-4 whitespace-pre-line leading-7">
          {question.statement}
        </p>
      </section>

      <section className="mt-6 rounded-xl border border-neutral-800 p-5">
        <h2 className="font-semibold">Alternativas e gabarito</h2>
        <div className="mt-4 space-y-2">
          {question.alternatives.map((item) => (
            <div
              key={item.id}
              className={
                item.isCorrect
                  ? "rounded border border-emerald-800 bg-emerald-950 p-3"
                  : "rounded bg-neutral-900 p-3"
              }
            >
              <strong>{item.letter}</strong> — {item.text}
              {item.isCorrect && (
                <span className="ml-2 text-xs font-semibold text-emerald-300">
                  Gabarito
                </span>
              )}
              {item.isVisual && (
                <div className="mt-3 space-y-2">
                  <p className="text-xs text-amber-300">
                    Recurso visual oficial · página{" "}
                    {item.sourcePage ?? "não informada"}
                  </p>
                  <p className="break-all text-xs text-neutral-500">
                    {item.visualAssetPath ?? "Arquivo visual não informado"}
                  </p>
                  {visualAssets.get(item.id) ? (
                    <Image
                      src={visualAssets.get(item.id) ?? ""}
                      alt={`Recurso visual oficial da alternativa ${item.letter}`}
                      width={900}
                      height={500}
                      unoptimized
                      className="h-auto max-h-[32rem] w-auto max-w-full rounded bg-white object-contain"
                    />
                  ) : (
                    <p className="text-xs text-red-300">
                      O recurso visual local não pôde ser carregado.
                    </p>
                  )}
                </div>
              )}
            </div>
          ))}
          {question.type === "CE" && (
            <p className="rounded bg-neutral-900 p-3">
              Item do tipo Certo ou Errado
            </p>
          )}
        </div>
        <p className="mt-4 text-sm">
          <span className="text-neutral-500">Gabarito registrado: </span>
          <strong>{answerKey}</strong>
        </p>
      </section>

      <section className="mt-6 rounded-xl border border-neutral-800 p-5">
        <h2 className="font-semibold">Observações de extração</h2>
        <p className="mt-3 whitespace-pre-line text-sm text-neutral-300">
          {question.extractionNotes ?? "Nenhuma observação registrada."}
        </p>
      </section>

      <form
        action={updateQuestionReview}
        className="mt-6 space-y-6 rounded-xl border border-neutral-800 p-5"
      >
        <input type="hidden" name="id" value={question.id} />
        <div>
          <h2 className="font-semibold">Conferência e correção manual</h2>
          <p className="mt-2 text-sm text-neutral-500">
            Salvar mantém a questão em IN_REVIEW. A publicação é uma decisão
            separada e sempre passa pela validação centralizada.
          </p>
        </div>

        <label className="block text-sm">
          <span className="mb-1 block text-neutral-400">Enunciado</span>
          <textarea
            name="statement"
            required
            defaultValue={question.statement}
            rows={10}
            className="input w-full"
          />
        </label>

        <div className="grid gap-3 sm:grid-cols-2">
          <SelectField
            label="Matéria"
            name="subjectId"
            value={question.subjectId}
            options={subjects.map((item) => ({
              value: item.id,
              label: item.name,
            }))}
          />
          <SelectField
            label="Assunto"
            name="topicId"
            value={question.topicId ?? ""}
            optional
            options={topics.map((item) => ({
              value: item.id,
              label: item.name,
            }))}
          />
          <SelectField
            label="Bloco"
            name="blockId"
            value={question.blockId ?? ""}
            options={blocks.map((item) => ({
              value: item.id,
              label: item.name,
            }))}
          />
          <SelectField
            label="Caderno"
            name="paperId"
            value={question.paperId ?? ""}
            options={papers.map((item) => ({
              value: item.id,
              label: `${item.code}${item.title ? ` — ${item.title}` : ""}`,
            }))}
          />
          <label className="text-sm">
            <span className="mb-1 block text-neutral-400">Peso</span>
            <input
              name="weight"
              type="number"
              min="0.000001"
              step="any"
              required
              defaultValue={question.weight}
              className="input w-full"
            />
          </label>
          <label className="text-sm">
            <span className="mb-1 block text-neutral-400">Página</span>
            <input
              name="sourcePage"
              type="number"
              min="1"
              required
              defaultValue={question.sourcePage ?? ""}
              className="input w-full"
            />
          </label>
        </div>

        <label className="block text-sm">
          <span className="mb-1 block text-neutral-400">Fonte</span>
          <input
            name="sourceUrl"
            defaultValue={question.sourceUrl ?? source ?? ""}
            className="input w-full"
          />
        </label>

        <label className="block text-sm">
          <span className="mb-1 block text-neutral-400">
            Observações de extração
          </span>
          <textarea
            name="extractionNotes"
            defaultValue={question.extractionNotes ?? ""}
            rows={4}
            className="input w-full"
          />
        </label>

        <div>
          <h3 className="font-semibold">Alternativas e gabarito</h3>
          <div className="mt-3 space-y-3">
            {question.type === "MC" ? (
              question.alternatives.map((alternative) => (
                <div
                  key={alternative.id}
                  className="grid gap-2 rounded-lg bg-neutral-900 p-3 sm:grid-cols-[auto_1fr]"
                >
                  <label className="flex items-center gap-2 font-semibold">
                    <input
                      type="radio"
                      name="correctAnswer"
                      value={alternative.id}
                      defaultChecked={alternative.isCorrect}
                      required
                    />
                    {alternative.letter}
                  </label>
                  <textarea
                    name={`alternative-${alternative.id}`}
                    defaultValue={alternative.text}
                    required
                    rows={2}
                    className="input w-full"
                  />
                </div>
              ))
            ) : (
              <select
                name="correctAnswer"
                defaultValue={question.ceAnswer ? "CE_TRUE" : "CE_FALSE"}
                className="input"
              >
                <option value="CE_TRUE">Certo</option>
                <option value="CE_FALSE">Errado</option>
              </select>
            )}
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <CheckField
            name="textReviewed"
            label="Texto conferido"
            checked={question.textReviewed}
          />
          <CheckField
            name="alternativesReviewed"
            label="Alternativas conferidas"
            checked={question.alternativesReviewed}
          />
          <CheckField
            name="answerKeyReviewed"
            label="Gabarito confirmado"
            checked={question.answerKeyReviewed}
          />
          <CheckField
            name="requiresVisualReview"
            label="Possui elemento visual"
            checked={question.requiresVisualReview}
          />
          <CheckField
            name="visualReviewResolved"
            label="Pendência visual resolvida"
            checked={question.visualReviewResolved}
          />
        </div>

        <SelectField
          label="Situação de anulação"
          name="annulmentStatus"
          value={question.annulmentStatus}
          options={[
            { value: "PENDING", label: "Pendente de conferência" },
            { value: "NOT_ANNULLED", label: "Não anulada" },
            { value: "ANNULLED", label: "Anulada" },
          ]}
        />

        <button className="rounded-lg bg-orange-500 px-5 py-3 font-semibold text-neutral-950">
          Salvar revisão
        </button>
      </form>

      <section className="mt-6 rounded-xl border border-neutral-800 p-5">
        <h2 className="font-semibold">Impedimentos de publicação</h2>
        {publicationIssues.length === 0 ? (
          <p className="mt-3 rounded-xl bg-emerald-50 p-3 text-sm font-semibold text-emerald-800">
            Pronta para publicar
          </p>
        ) : (
          <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-amber-300">
            {publicationIssues.map((issue) => (
              <li key={issue}>{issue}</li>
            ))}
          </ul>
        )}
      </section>

      <section className="mt-6 rounded-xl border border-neutral-800 p-5">
        <h2 className="font-semibold">Decisão editorial</h2>
        <p className="mt-2 text-sm text-neutral-500">
          As ações alteram somente esta questão e nunca publicam o concurso.
        </p>
        <div className="mt-4 flex flex-wrap gap-3">
          {question.status !== "PUBLISHED" && (
            <form action={setQuestionStatus}>
              <input type="hidden" name="id" value={question.id} />
              <input type="hidden" name="status" value="PUBLISHED" />
              <ConfirmButton
                disabled={publicationIssues.length > 0}
                message="Publicar esta questão? O concurso não será publicado automaticamente."
                className="rounded-lg bg-emerald-700 px-4 py-2 font-semibold text-white disabled:cursor-not-allowed disabled:opacity-40"
              >
                Publicar questão
              </ConfirmButton>
            </form>
          )}
          {question.status === "PUBLISHED" && (
            <form action={setQuestionStatus}>
              <input type="hidden" name="id" value={question.id} />
              <input type="hidden" name="status" value="IN_REVIEW" />
              <ConfirmButton
                disabled={question.concurso.status === "PUBLISHED"}
                message="Retornar esta questão para revisão?"
                className="rounded-lg border border-amber-500 px-4 py-2 font-semibold text-amber-800"
              >
                Retornar para revisão
              </ConfirmButton>
              {question.concurso.status === "PUBLISHED" && (
                <p className="mt-2 max-w-sm text-xs text-amber-800">
                  Retorne primeiro o concurso para revisão.
                </p>
              )}
            </form>
          )}
          {question.status !== "ARCHIVED" && (
            <form action={setQuestionStatus}>
              <input type="hidden" name="id" value={question.id} />
              <input type="hidden" name="status" value="ARCHIVED" />
              <ConfirmButton
                message="Arquivar esta questão sem excluí-la?"
                className="rounded-lg border border-red-300 px-4 py-2 font-semibold text-red-700"
              >
                Arquivar
              </ConfirmButton>
            </form>
          )}
        </div>
      </section>
    </main>
    </AdminShell>
  );
}

function SourceReference({ source }: { source: string }) {
  if (source.startsWith("https://") || source.startsWith("http://")) {
    return (
      <a
        href={source}
        target="_blank"
        rel="noreferrer"
        className="text-orange-400 underline"
      >
        {source}
      </a>
    );
  }
  return <span>{source}</span>;
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <span className="block text-xs text-neutral-500">{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function SelectField({
  label,
  name,
  value,
  options,
  optional = false,
}: {
  label: string;
  name: string;
  value: string;
  options: Array<{ value: string; label: string }>;
  optional?: boolean;
}) {
  return (
    <label className="text-sm">
      <span className="mb-1 block text-neutral-400">{label}</span>
      <select
        name={name}
        defaultValue={value}
        required={!optional}
        className="input w-full"
      >
        {optional && <option value="">Não informado</option>}
        {!optional && value === "" && <option value="">Selecione</option>}
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function CheckField({
  name,
  label,
  checked,
}: {
  name: string;
  label: string;
  checked: boolean;
}) {
  return (
    <label className="flex items-center gap-2 rounded-lg bg-neutral-900 p-3 text-sm">
      <input type="checkbox" name={name} defaultChecked={checked} />
      {label}
    </label>
  );
}
