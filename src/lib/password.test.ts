import { describe, expect, it } from "vitest";

import { hashPassword, verifyPassword } from "./password";

describe("password", () => {
  it("gera hash com salt e valida somente a senha correta", async () => {
    const hash = await hashPassword("senha-segura-123");
    expect(hash).not.toContain("senha-segura-123");
    await expect(verifyPassword("senha-segura-123", hash)).resolves.toBe(true);
    await expect(verifyPassword("senha-errada", hash)).resolves.toBe(false);
  });
});
