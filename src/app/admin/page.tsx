import Link from "next/link";

import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/admin";
import { createBank, createSubject, createTopic } from "./actions";

export default async function AdminPage() {
  await requireAdmin();
  const [banks, contests, subjects, topics, blocks, papers, reviewQuestions] =
    await Promise.all([
      prisma.banca.findMany({ orderBy: { name: "asc" } }),
      prisma.concurso.findMany({ include: { banca: true }, orderBy: { createdAt: "desc" } }),
      prisma.subject.findMany({ orderBy: { name: "asc" } }),
      prisma.topic.findMany({ include: { subject: true }, orderBy: { name: "asc" } }),
      prisma.examBlock.findMany({ include: { concurso: true }, orderBy: { createdAt: "desc" } }),
      prisma.examPaper.findMany({ include: { concurso: true }, orderBy: { createdAt: "desc" } }),
      prisma.question.findMany({
        where: { status: "IN_REVIEW" },
        include: { subject: true, concurso: true },
        orderBy: { createdAt: "asc" },
      }),
    ]);

  return (
    <main className="mx-auto max-w-6xl px-4 py-10">
      <div className="flex justify-between">
        <div><h1 className="text-2xl font-semibold">Painel administrativo</h1><p className="text-sm text-neutral-500">Base de gestão e revisão editorial.</p></div>
        <Link href="/" className="text-orange-400">Voltar</Link>
      </div>

      <section className="mt-8 grid gap-4 md:grid-cols-3">
        <AdminForm title={`Bancas (${banks.length})`} action={createBank} fields={<input name="name" required placeholder="Nome da banca" className="input" />} />
        <AdminForm title={`Matérias (${subjects.length})`} action={createSubject} fields={<input name="name" required placeholder="Nome da matéria" className="input" />} />
        <AdminForm title={`Assuntos (${topics.length})`} action={createTopic} fields={<><select name="subjectId" required className="input">{subjects.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select><input name="name" required placeholder="Nome do assunto" className="input" /></>} />
      </section>

      <section className="mt-8 grid gap-3 sm:grid-cols-4">
        <Count label="Concursos" value={contests.length} />
        <Count label="Blocos" value={blocks.length} />
        <Count label="Cadernos" value={papers.length} />
        <Count label="Em revisão" value={reviewQuestions.length} />
      </section>

      <section className="mt-8 rounded-2xl border border-neutral-800 p-5">
        <h2 className="text-lg font-semibold">Fila de revisão</h2>
        <div className="mt-4 space-y-2">
          {reviewQuestions.map((question) => (
            <Link key={question.id} href={`/admin/questoes/${question.id}`} className="block rounded-lg bg-neutral-900 p-3">
              Questão {question.number ?? "sem número"} · {question.subject.name} · {question.concurso.orgao}
            </Link>
          ))}
          {reviewQuestions.length === 0 && <p className="text-neutral-500">Nenhuma questão aguardando revisão.</p>}
        </div>
      </section>

      <section className="mt-8 rounded-2xl border border-dashed border-neutral-700 p-5">
        <h2 className="font-semibold">Importação por PDF — arquitetura preparada</h2>
        <p className="mt-2 text-sm text-neutral-400">
          O schema já registra prova, gabarito, fonte, página e ImportJob. Upload,
          armazenamento e extração ainda dependem da escolha do serviço. Nenhuma
          integração de IA está ativa; revisão humana continuará obrigatória.
        </p>
        <button disabled className="mt-4 rounded-lg bg-neutral-800 p-3 text-neutral-500">
          Upload de prova e gabarito (pendente)
        </button>
      </section>
    </main>
  );
}

function AdminForm({ title, action, fields }: { title: string; action: (data: FormData) => Promise<void>; fields: React.ReactNode }) {
  return <form action={action} className="space-y-3 rounded-2xl border border-neutral-800 p-4"><h2 className="font-semibold">{title}</h2>{fields}<button className="rounded-lg bg-orange-500 px-4 py-2 text-neutral-950">Criar</button></form>;
}
function Count({ label, value }: { label: string; value: number }) {
  return <div className="rounded-xl bg-neutral-900 p-4"><strong className="text-2xl">{value}</strong><span className="block text-xs text-neutral-500">{label}</span></div>;
}
