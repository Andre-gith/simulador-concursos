import { describe, expect, it } from "vitest";
import { FixtureCatalogProvider, GenericJsonCatalogProvider, ManualCatalogProvider } from "./providers";

describe("providers de catálogo", () => {
  it("manual valida e limita o payload", async () => {
    const result = await new ManualCatalogProvider().fetch({ limit: 2, records: [{
      externalId: "x", institution: "CEF", year: 2026, raw: { externalId: "x", institution: "CEF", year: 2026 },
    }] });
    expect(result.records[0].institution).toBe("CEF");
  });
  it("fixture lê apenas dentro do projeto", async () => {
    const result = await new FixtureCatalogProvider().fetch({ fixturePath: "data/catalog-fixtures/community-sample.json", limit: 10 });
    expect(result.records).toHaveLength(1);
  });
  it("JSON genérico exige HTTPS", async () => {
    await expect(new GenericJsonCatalogProvider().fetch({ baseUrl: "http://example.org", limit: 1 })).rejects.toThrow("HTTPS");
  });
});
