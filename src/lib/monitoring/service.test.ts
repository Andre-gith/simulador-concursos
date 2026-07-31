import { mkdtemp, mkdir, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import {
  acquireMonitorLock, classifyImpact, compareDocuments, FixtureDiscoveryProvider,
  isDue, nextCheckAt, discoverWithRetry,
} from "./service";

const pdf = (version: string) => Buffer.from(`%PDF-1.4\nfixture ${version}\n%%EOF`);

describe("monitoramento oficial", () => {
  it("MANUAL não entra em due; diário vencido entra e futuro é ignorado", () => {
    const now = new Date("2026-01-02T00:00:00Z");
    expect(isDue({ enabled: true, frequency: "MANUAL", nextCheckAt: now }, now)).toBe(false);
    expect(isDue({ enabled: true, frequency: "DAILY", nextCheckAt: new Date("2026-01-01T00:00:00Z") }, now)).toBe(true);
    expect(isDue({ enabled: true, frequency: "DAILY", nextCheckAt: new Date("2026-01-03T00:00:00Z") }, now)).toBe(false);
    expect(nextCheckAt("WEEKLY", now)?.toISOString()).toBe("2026-01-09T00:00:00.000Z");
  });

  it("lock persistente impede concorrência e permite lock expirado", async () => {
    const updateMany = vi.fn().mockResolvedValueOnce({ count: 1 }).mockResolvedValueOnce({ count: 0 });
    const prisma = { sourceMonitor: { updateMany } } as never;
    expect(await acquireMonitorLock(prisma, "monitor", "token")).toBe(true);
    expect(await acquireMonitorLock(prisma, "monitor", "other")).toBe(false);
    expect(updateMany.mock.calls[0][0].where.OR).toEqual(expect.arrayContaining([
      { lockExpiresAt: null }, expect.objectContaining({ lockExpiresAt: expect.any(Object) }),
    ]));
  });

  it("mesmo hash não cria versão; novo hash altera; URL nova e remoção são detectadas", () => {
    const previous = [{ id: "old", sourceUrl: "https://gov.br/prova.pdf", sha256: "unused", originalFilename: "Prova", version: 1, metadata: {} }];
    const same = [{ url: previous[0].sourceUrl, title: "Prova", documentType: "EXAM" as const, content: pdf("1") }];
    previous[0].sha256 = createHash("sha256").update(same[0].content).digest("hex");
    expect(compareDocuments(same, previous).items[0].changeType).toBe("UNCHANGED");
    expect(compareDocuments([{ ...same[0], content: pdf("2") }], previous).items[0].changeType).toBe("CONTENT_CHANGED");
    expect(compareDocuments([{ ...same[0], url: "https://gov.br/renomeada.pdf" }], previous).items.map((x) => x.changeType)).toEqual(expect.arrayContaining(["DOCUMENT_RENAMED", "DOCUMENT_REMOVED_FROM_PAGE"]));
    expect(compareDocuments([{ ...same[0], url: "https://gov.br/nova.pdf", content: pdf("nova") }], previous).items.map((x) => x.changeType)).toEqual(expect.arrayContaining(["NEW_DOCUMENT", "DOCUMENT_REMOVED_FROM_PAGE"]));
    expect(compareDocuments([], previous).items[0].changeType).toBe("DOCUMENT_REMOVED_FROM_PAGE");
  });

  it("classifica impactos sem depender apenas do nome", () => {
    expect(classifyImpact("ANSWER_KEY_FINAL", false)).toBe("NEW_ANSWER_KEY_FINAL");
    expect(classifyImpact("ANSWER_KEY_FINAL", true)).toBe("ANSWER_KEY_CHANGED");
    expect(classifyImpact("ANNULMENT_NOTICE", false)).toBe("ANNULMENT_NOTICE");
    expect(classifyImpact("RECTIFICATION", false)).toBe("RECTIFICATION");
    expect(classifyImpact("NOTICE", true)).toBe("NOTICE_CHANGED");
  });

  it("repete falha temporária até 3 vezes e não repete validação permanente", async () => {
    const temporary = vi.fn().mockRejectedValueOnce(new Error("ECONNRESET")).mockRejectedValueOnce(new Error("timeout")).mockResolvedValue([]);
    expect((await discoverWithRetry({ discover: temporary }, { id: "m", sourceUrl: "https://gov.br", adapterType: "Generic" })).attempts).toBe(3);
    const permanent = vi.fn().mockRejectedValue(new Error("URL privada proibida"));
    await expect(discoverWithRetry({ discover: permanent }, { id: "m", sourceUrl: "https://gov.br", adapterType: "Generic" })).rejects.toThrow(/privada/);
    expect(permanent).toHaveBeenCalledTimes(1);
  });

  it("fixture local suporta a sequência completa sem rede", async () => {
    const root = await mkdtemp(join(tmpdir(), "monitor-fixture-"));
    const steps = [
      [{ url: "https://gov.br/prova.pdf", type: "EXAM", file: "prova.pdf" }, { url: "https://gov.br/preliminar.pdf", type: "ANSWER_KEY_PRELIMINARY", file: "preliminar.pdf" }],
      [{ url: "https://gov.br/prova.pdf", type: "EXAM", file: "prova.pdf" }, { url: "https://gov.br/preliminar.pdf", type: "ANSWER_KEY_PRELIMINARY", file: "preliminar.pdf" }],
      [{ url: "https://gov.br/prova.pdf", type: "EXAM", file: "prova.pdf" }, { url: "https://gov.br/definitivo.pdf", type: "ANSWER_KEY_FINAL", file: "definitivo.pdf", metadata: { answers: { "1": "B" } } }],
      [{ url: "https://gov.br/anulacao.pdf", type: "ANNULMENT_NOTICE", file: "anulacao.pdf", metadata: { annulled: [2] } }],
      [{ url: "https://gov.br/edital.pdf", type: "RECTIFICATION", file: "edital.pdf" }],
    ];
    for (const [index, documents] of steps.entries()) {
      const directory = join(root, `step-${index + 1}`); await mkdir(directory);
      for (const [fileIndex, item] of documents.entries()) await writeFile(join(directory, item.file), pdf(`${index}-${fileIndex}`));
      await writeFile(join(directory, "manifest.json"), JSON.stringify({ documents: documents.map((item) => ({ url: item.url, title: item.file, documentType: item.type, file: item.file, metadata: item.metadata })) }));
      expect((await new FixtureDiscoveryProvider(directory).discover()).length).toBe(documents.length);
    }
  });
});
