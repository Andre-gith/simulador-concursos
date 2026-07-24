import Link from "next/link";

import type { CatalogFilter } from "@/lib/catalog";

type CatalogControlsProps = {
  activeFilter: CatalogFilter;
  query: string;
};

const FILTERS: Array<{ value: CatalogFilter; label: string }> = [
  { value: "all", label: "Todos" },
  { value: "available", label: "Disponíveis" },
  { value: "preparing", label: "Em preparação" },
  { value: "cesgranrio", label: "Cesgranrio" },
  { value: "cebraspe", label: "Cebraspe" },
  { value: "fgv", label: "FGV" },
  { value: "mid-level", label: "Médio / técnico" },
  { value: "higher-level", label: "Superior" },
];

function filterHref(filter: CatalogFilter, query: string) {
  const params = new URLSearchParams();
  if (query) params.set("q", query);
  if (filter !== "all") params.set("filter", filter);
  const suffix = params.toString();
  return suffix ? `/?${suffix}#catalogo` : "/#catalogo";
}

export function CatalogControls({
  activeFilter,
  query,
}: CatalogControlsProps) {
  return (
    <div className="space-y-5">
      <form
        action="/"
        method="get"
        role="search"
        className="flex flex-col gap-3 sm:flex-row"
      >
        <label htmlFor="catalog-search" className="sr-only">
          Buscar por instituição, cargo, especialidade, banca ou edição
        </label>
        <input type="hidden" name="filter" value={activeFilter} />
        <input
          id="catalog-search"
          name="q"
          type="search"
          defaultValue={query}
          placeholder="Instituição, cargo, especialidade, banca ou edição"
          className="min-h-12 flex-1 rounded-xl border border-slate-300 bg-white px-4 text-slate-950 outline-none ring-amber-400 transition placeholder:text-slate-500 focus:ring-2"
        />
        <button
          type="submit"
          className="min-h-12 rounded-xl bg-emerald-800 px-6 font-semibold text-white transition hover:bg-emerald-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-400"
        >
          Buscar provas
        </button>
      </form>

      <nav aria-label="Filtros do catálogo" className="flex flex-wrap gap-2">
        {FILTERS.map((filter) => {
          const active = activeFilter === filter.value;
          return (
            <Link
              key={filter.value}
              href={filterHref(filter.value, query)}
              aria-current={active ? "page" : undefined}
              className={
                active
                  ? "rounded-full bg-emerald-900 px-4 py-2 text-sm font-semibold text-white"
                  : "rounded-full border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:border-emerald-700 hover:text-emerald-900"
              }
            >
              {filter.label}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
