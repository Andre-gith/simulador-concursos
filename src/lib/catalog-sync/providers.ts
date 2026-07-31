import { readFile } from "node:fs/promises";
import { isAbsolute, resolve } from "node:path";
import { z } from "zod";
import type { CatalogProvider, CatalogProviderContext, CatalogProviderResult, CatalogRecord } from "./types";

const recordSchema = z.object({
  externalId: z.union([z.string(), z.number()]).transform(String),
  institution: z.string().trim().min(2).max(200),
  board: z.string().trim().max(120).nullish(),
  position: z.string().trim().max(160).nullish(),
  specialty: z.string().trim().max(160).nullish(),
  year: z.coerce.number().int().min(1900).max(2200).nullish(),
  edition: z.string().trim().max(80).nullish(),
  level: z.enum(["FUNDAMENTAL", "MEDIO", "TECNICO", "SUPERIOR"]).nullish(),
  possibleOfficialUrl: z.string().url().nullish(),
  informativeUrl: z.string().url().nullish(),
  estimatedDate: z.string().datetime({ offset: true }).nullish(),
  forecastStatus: z.string().trim().max(100).nullish(),
}).passthrough();

function parseRecords(payload: unknown, limit: number): CatalogRecord[] {
  const array = Array.isArray(payload) ? payload : z.object({ records: z.array(z.unknown()) }).parse(payload).records;
  if (array.length > limit) throw new Error(`Fonte excedeu o limite de ${limit} registros.`);
  return array.map((item) => {
    const parsed = recordSchema.parse(item);
    return { ...parsed, raw: item as Record<string, unknown> };
  });
}

export class FixtureCatalogProvider implements CatalogProvider {
  readonly type = "FIXTURE" as const;
  async fetch(context: CatalogProviderContext): Promise<CatalogProviderResult> {
    if (!context.fixturePath) throw new Error("Fixture não configurada.");
    const path = isAbsolute(context.fixturePath) ? context.fixturePath : resolve(process.cwd(), context.fixturePath);
    if (!path.startsWith(process.cwd())) throw new Error("Fixture fora do projeto.");
    return { records: parseRecords(JSON.parse(await readFile(path, "utf8")), context.limit) };
  }
}

export class ManualCatalogProvider implements CatalogProvider {
  readonly type = "MANUAL" as const;
  async fetch(context: CatalogProviderContext) {
    return { records: parseRecords(context.records ?? [], context.limit) };
  }
}

export class GenericJsonCatalogProvider implements CatalogProvider {
  readonly type = "GENERIC_JSON" as const;
  async fetch(context: CatalogProviderContext) {
    if (!context.baseUrl) throw new Error("URL base não configurada.");
    const url = new URL(context.baseUrl);
    if (url.protocol !== "https:") throw new Error("A fonte JSON deve usar HTTPS.");
    const configuredBase = process.env.CATALOG_PROVIDER_BASE_URL;
    if (configuredBase && url.origin !== new URL(configuredBase).origin) throw new Error("Origem JSON não autorizada.");
    const response = await fetch(url, {
      headers: context.apiKey ? { Authorization: `Bearer ${context.apiKey}` } : {},
      signal: AbortSignal.timeout(15_000),
      cache: "no-store",
    });
    if (!response.ok) throw new Error(`Fonte JSON respondeu HTTP ${response.status}.`);
    const size = Number(response.headers.get("content-length") ?? 0);
    if (size > 2_000_000) throw new Error("Payload excede 2 MB.");
    return { records: parseRecords(await response.json(), context.limit) };
  }
}

export function providerFor(type: CatalogProvider["type"]) {
  if (type === "FIXTURE") return new FixtureCatalogProvider();
  if (type === "MANUAL") return new ManualCatalogProvider();
  return new GenericJsonCatalogProvider();
}
