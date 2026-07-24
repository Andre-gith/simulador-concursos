import { describe, expect, it } from "vitest";

import { prepareFinishedHistory } from "./history";

describe("prepareFinishedHistory", () => {
  it("retorna histórico vazio sem tentativas finalizadas", () => {
    expect(prepareFinishedHistory([])).toEqual([]);
    expect(
      prepareFinishedHistory([{ id: "open", finishedAt: null }]),
    ).toEqual([]);
  });

  it("ordena várias tentativas finalizadas da mais recente", () => {
    const history = prepareFinishedHistory([
      { id: "old", finishedAt: new Date("2026-01-01T10:00:00Z") },
      { id: "new", finishedAt: new Date("2026-01-02T10:00:00Z") },
    ]);
    expect(history.map((attempt) => attempt.id)).toEqual(["new", "old"]);
  });
});
