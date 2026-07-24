import Link from "next/link";
import { notFound } from "next/navigation";

import { setQuestionStatus } from "../../actions";
import { requireAdmin } from "@/lib/admin";
import { prisma } from "@/lib/prisma";

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

  return (
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
        <h2 className="font-semibold">Decisão editorial</h2>
        <p className="mt-2 text-sm text-neutral-500">
          A publicação só será aceita se gabarito, peso, fonte e página forem
          válidos.
        </p>
        <div className="mt-4 flex flex-wrap gap-3">
          {["DRAFT", "IN_REVIEW", "PUBLISHED", "ARCHIVED"].map((status) => (
            <form action={setQuestionStatus} key={status}>
              <input type="hidden" name="id" value={question.id} />
              <input type="hidden" name="status" value={status} />
              <button className="rounded-lg border border-neutral-700 px-4 py-2 hover:border-orange-500">
                {status}
              </button>
            </form>
          ))}
        </div>
      </section>
    </main>
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
