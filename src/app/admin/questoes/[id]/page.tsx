import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/admin";
import { setQuestionStatus } from "../../actions";

export default async function ReviewQuestionPage({ params }: { params: Promise<{ id: string }> }) {
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
  return (
    <main className="mx-auto max-w-4xl px-4 py-10">
      <h1 className="text-2xl font-semibold">Revisão da questão {question.number ?? ""}</h1>
      <p className="mt-2 text-sm text-neutral-500">{question.concurso.banca.name} · {question.concurso.orgao}</p>
      <div className="mt-6 grid gap-3 rounded-xl bg-neutral-900 p-5 text-sm sm:grid-cols-3">
        <Info label="Matéria" value={question.subject.name} />
        <Info label="Assunto" value={question.topic?.name ?? "Não informado"} />
        <Info label="Bloco" value={question.block?.name ?? "Não informado"} />
        <Info label="Peso" value={String(question.weight)} />
        <Info label="Página" value={question.sourcePage ? String(question.sourcePage) : "Não informada"} />
        <Info label="Fonte oficial" value={question.sourceUrl ?? question.paper?.provaUrl ?? "Não informada"} />
      </div>
      <p className="mt-6 whitespace-pre-line">{question.statement}</p>
      <div className="mt-4 space-y-2">
        {question.alternatives.map((item) => <div key={item.id} className={item.isCorrect ? "rounded bg-green-950 p-3" : "rounded bg-neutral-900 p-3"}>{item.letter} — {item.text}</div>)}
        {question.type === "CE" && <p>Gabarito: {question.ceAnswer ? "Certo" : "Errado"}</p>}
      </div>
      <div className="mt-6 flex gap-3">
        {["PUBLISHED", "IN_REVIEW", "ARCHIVED"].map((status) => (
          <form action={setQuestionStatus} key={status}>
            <input type="hidden" name="id" value={question.id} />
            <input type="hidden" name="status" value={status} />
            <button className="rounded-lg border border-neutral-700 px-4 py-2">{status}</button>
          </form>
        ))}
      </div>
    </main>
  );
}
function Info({ label, value }: { label: string; value: string }) {
  return <div><span className="block text-xs text-neutral-500">{label}</span><strong>{value}</strong></div>;
}
