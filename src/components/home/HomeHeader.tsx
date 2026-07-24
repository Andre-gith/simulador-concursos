import Link from "next/link";

import { LogoutButton } from "@/app/LogoutButton";

type HomeHeaderProps = {
  isAuthenticated: boolean;
  isAdmin: boolean;
};

export function HomeHeader({
  isAuthenticated,
  isAdmin,
}: HomeHeaderProps) {
  return (
    <header className="border-b border-white/10 bg-[#07110f]/95">
      <div className="mx-auto flex min-h-16 max-w-7xl flex-wrap items-center justify-between gap-4 px-4 py-3 sm:px-6 lg:px-8">
        <Link
          href="/"
          className="text-lg font-bold tracking-tight text-white"
          aria-label="Nota de Banca — página inicial"
        >
          Nota de <span className="text-amber-400">Banca</span>
        </Link>

        <nav
          aria-label="Navegação principal"
          className="flex flex-wrap items-center justify-end gap-x-5 gap-y-2 text-sm"
        >
          <Link href="/" className="text-white transition hover:text-amber-300">
            Início
          </Link>
          {isAuthenticated ? (
            <>
              <Link
                href="/historico"
                className="text-slate-300 transition hover:text-white"
              >
                Histórico
              </Link>
              {isAdmin && (
                <Link
                  href="/admin"
                  className="text-slate-300 transition hover:text-white"
                >
                  Admin
                </Link>
              )}
              <LogoutButton />
            </>
          ) : (
            <>
              <Link
                href="/login"
                className="text-slate-300 transition hover:text-white"
              >
                Entrar
              </Link>
              <Link
                href="/registro"
                className="rounded-full bg-amber-400 px-4 py-2 font-semibold text-slate-950 transition hover:bg-amber-300"
              >
                Registrar
              </Link>
            </>
          )}
        </nav>
      </div>
    </header>
  );
}
