import Link from "next/link";

import { AdminShell } from "@/components/layout/AdminShell";
import { requireAdmin } from "@/lib/admin";
import { prisma } from "@/lib/prisma";

export default async function VisualCandidatePreviewPage() {
  await requireAdmin();
  const questions = await prisma.question.findMany({
    where: {
      concursoId: {
        in: ["cms16omz00002vpvk847qx2re", "cms15wngw0002vpg0t03yq5tv"],
      },
      status: "IN_REVIEW",
      requiresVisualReview: true,
      id: { not: "cms16on8y00ddvpvkbjcj4y5o" },
    },
    select: {
      id: true,
      number: true,
      statement: true,
      concurso: { select: { especialidade: true } },
      subject: { select: { name: true } },
      alternatives: {
        orderBy: { letter: "asc" },
        select: { id: true, letter: true, text: true },
      },
      visualAssets: {
        orderBy: [{ order: "asc" }, { sourcePage: "asc" }],
        select: { id: true, sourcePage: true },
      },
    },
    orderBy: [{ concursoId: "asc" }, { number: "asc" }],
  });
  return (
    <AdminShell>
      <main className="mx-auto max-w-5xl px-4 py-8">
        <div className="rounded-xl border border-amber-300 bg-amber-50 p-4 font-bold text-amber-900">
          Prévia administrativa — conteúdo ainda em revisão.
        </div>
        <div className="my-5 flex flex-wrap gap-2">
          <Link href="/admin/revisao-visual/banco-do-brasil" className="rounded-lg border border-slate-300 px-3 py-2 font-bold">
            Voltar à revisão
          </Link>
          {questions.map((question) => (
            <a key={question.id} href={`#q-${question.id}`} className="rounded-lg bg-white px-3 py-2 text-sm font-bold shadow-sm">
              {question.concurso.especialidade}: {question.number}
            </a>
          ))}
        </div>
        <div className="space-y-6">
          {questions.map((question) => (
            <article id={`q-${question.id}`} key={question.id} className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <p className="text-sm font-bold text-emerald-800">
                {question.concurso.especialidade} · Questão {question.number} · {question.subject.name}
              </p>
              <p className="mt-5 whitespace-pre-line leading-7 text-slate-800">{question.statement}</p>
              <div className="mt-5 grid gap-4">
                {question.visualAssets.map((asset) => (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img key={asset.id} src={`/api/visual-assets/${asset.id}`} alt={`Recurso visual da questão ${question.number}, página ${asset.sourcePage}`} className="h-auto max-h-[900px] w-full object-contain" />
                ))}
              </div>
              <ol className="mt-5 space-y-3">
                {question.alternatives.map((alternative) => (
                  <li key={alternative.id} className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                    <strong>{alternative.letter}.</strong> {alternative.text}
                  </li>
                ))}
              </ol>
            </article>
          ))}
        </div>
      </main>
    </AdminShell>
  );
}
