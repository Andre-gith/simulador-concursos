import { describe, expect, it } from "vitest";

import { getAttemptTiming } from "./attemptTiming";

describe("getAttemptTiming", () => {
  const startedAt = new Date("2026-01-01T12:00:00.000Z");

  it("trata simulado sem limite", () => {
    expect(getAttemptTiming(startedAt, null)).toMatchObject({
      hasTimeLimit: false,
      expiresAt: null,
      isExpired: false,
    });
  });

  it("calcula limite e restaura o restante a partir do servidor", () => {
    const timing = getAttemptTiming(
      startedAt,
      30,
      new Date("2026-01-01T12:10:00.000Z"),
    );
    expect(timing.expiresAt?.toISOString()).toBe(
      "2026-01-01T12:30:00.000Z",
    );
    expect(timing.remainingMilliseconds).toBe(20 * 60_000);
  });

  it("detecta tempo expirado", () => {
    expect(
      getAttemptTiming(
        startedAt,
        10,
        new Date("2026-01-01T12:10:00.000Z"),
      ).isExpired,
    ).toBe(true);
  });
});
