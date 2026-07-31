import { createHash } from "node:crypto";
import type { CatalogRecord } from "./types";

const INSTITUTION_ALIASES = new Map([
  ["caixa", "caixa economica federal"],
  ["cef", "caixa economica federal"],
  ["caixa economica", "caixa economica federal"],
]);

export function normalizeText(value?: string | null) {
  return (value ?? "")
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLocaleLowerCase("pt-BR")
    .replace(/[^\p{Letter}\p{Number}]+/gu, " ")
    .trim()
    .replace(/\s+/g, " ");
}

export function normalizedInstitution(value: string) {
  const normalized = normalizeText(value);
  return INSTITUTION_ALIASES.get(normalized) ?? normalized;
}

export function identityParts(record: Omit<CatalogRecord, "externalId" | "raw">) {
  return {
    institution: normalizedInstitution(record.institution),
    board: normalizeText(record.board),
    position: normalizeText(record.position),
    specialty: normalizeText(record.specialty),
    year: record.year ?? null,
    edition: normalizeText(record.edition),
  };
}

export function normalizedIdentity(record: Omit<CatalogRecord, "externalId" | "raw">) {
  const p = identityParts(record);
  return [p.institution, p.board, p.position, p.specialty, p.year ?? "", p.edition].join("|");
}

export function catalogKey(record: Omit<CatalogRecord, "externalId" | "raw">) {
  return `community:${createHash("sha256").update(normalizedIdentity(record)).digest("hex").slice(0, 32)}`;
}

type ExistingIdentity = {
  orgao: string;
  banca?: { name: string } | null;
  cargo?: string | null;
  especialidade?: string | null;
  ano?: number | null;
  edicao?: string | null;
};

export function classifyMatch(incoming: CatalogRecord, existing: ExistingIdentity) {
  const left = identityParts(incoming);
  const right = identityParts({
    institution: existing.orgao,
    board: existing.banca?.name,
    position: existing.cargo,
    specialty: existing.especialidade,
    year: existing.ano,
    edition: existing.edicao,
  });
  if (left.institution !== right.institution) return "NONE" as const;
  if (left.board && right.board && left.board !== right.board) return "CONFLICT" as const;
  if (left.year !== null && right.year !== null && left.year !== right.year) return "CONFLICT" as const;
  if (left.specialty && right.specialty && left.specialty !== right.specialty) return "CONFLICT" as const;
  if (left.position && right.position && left.position !== right.position) return "PROBABLE" as const;
  if (!left.board || !right.board || left.year === null || right.year === null) return "PROBABLE" as const;
  return normalizedIdentity(incoming) === normalizedIdentity({
    institution: existing.orgao,
    board: existing.banca?.name,
    position: existing.cargo,
    specialty: existing.especialidade,
    year: existing.ano,
    edition: existing.edicao,
  }) ? "EXACT" as const : "PROBABLE" as const;
}
