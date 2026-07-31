import type { CatalogTrustLevel } from "@prisma/client";

export type CatalogRecord = {
  externalId: string;
  institution: string;
  board?: string | null;
  position?: string | null;
  specialty?: string | null;
  year?: number | null;
  edition?: string | null;
  level?: "FUNDAMENTAL" | "MEDIO" | "TECNICO" | "SUPERIOR" | null;
  possibleOfficialUrl?: string | null;
  informativeUrl?: string | null;
  estimatedDate?: string | null;
  forecastStatus?: string | null;
  raw: Record<string, unknown>;
};

export type CatalogProviderContext = {
  baseUrl?: string | null;
  config?: unknown;
  apiKey?: string;
  fixturePath?: string;
  records?: CatalogRecord[];
  limit: number;
  cursor?: unknown;
};

export type CatalogProviderResult = {
  records: CatalogRecord[];
  cursor?: unknown;
  warnings?: string[];
};

export interface CatalogProvider {
  readonly type: "FIXTURE" | "MANUAL" | "GENERIC_JSON";
  fetch(context: CatalogProviderContext): Promise<CatalogProviderResult>;
}

export const AUTO_EDITABLE_FIELDS = [
  "possibleOfficialUrl",
  "informativeUrl",
  "estimatedDate",
  "forecastStatus",
] as const;

export type SyncSourceShape = {
  id: string;
  providerType: "FIXTURE" | "MANUAL" | "GENERIC_JSON";
  trustLevel: CatalogTrustLevel;
  baseUrl: string | null;
  config: unknown;
};
