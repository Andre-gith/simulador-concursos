import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { LogoutButton } from "@/app/LogoutButton";

export default async function HomePage() {
  const session = await auth();
  const concursos = await prisma.concurso.findMany({
    where: {
      status: "PUBLISHED",
    },
    include: {
      banca: true,
      _count: {
        select: {
          questions: {
            where: {
              status: "PUBLISHED",
            },
          },
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  return (
    <main className="mx-auto max-w-3xl px-4 py-12">
      <div className="mb-6 flex justify-end gap-4">
        {session?.user ? (
          <>
            <a href="/historico" className="text-sm text-orange-400">Histórico</a>
            {session.user.role === "ADMIN" && (
              <a href="/admin" className="text-sm text-orange-400">Admin</a>
            )}
            <LogoutButton />
          </>
        ) : (
          <>
            <a href="/login" className="text-sm text-orange-400">Entrar</a>
            <a href="/registro" className="text-sm text-neutral-400">Cadastrar</a>
          </>
        )}
      </div>
      <h1 className="text-2xl font-semibold mb-2">
        Simulador de Concursos
      </h1>
      <p className="text-neutral-400 mb-8">
        Treine com a pontuação real da banca — inclusive o desconto por erro.
      </p>

      {concursos.length === 0 ? (
        <p className="text-neutral-500">
          Nenhum concurso publicado ainda. Importe uma prova pelo painel admin.
        </p>
      ) : (
        <ul className="space-y-3">
          {concursos.map((c) => (
            <li
              key={c.id}
              className="border border-neutral-800 rounded-lg p-4 hover:border-orange-500 transition-colors"
            >
              <a href={`/concursos/${c.id}`} className="block">
                <div className="flex items-center justify-between">
                  <span className="font-medium">
                    {c.orgao} — {c.cargo}
                  </span>
                  <span className="text-xs text-orange-400 uppercase tracking-wide">
                    {c.banca.name}
                  </span>
                </div>
                <div className="text-sm text-neutral-500 mt-1">
                  {c.ano} · {c._count.questions} questões
                </div>
              </a>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
