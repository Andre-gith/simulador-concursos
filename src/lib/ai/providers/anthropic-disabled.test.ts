import { describe, expect, it, vi } from "vitest";
import { createAnthropicExamExtractor } from "./anthropic";

describe("AI_PROVIDER", () => {
  it("é disabled por padrão mesmo com chave presente", () => {
    const fetchSpy = vi.fn();
    const result = createAnthropicExamExtractor({ ...process.env, AI_PROVIDER: "disabled", ANTHROPIC_API_KEY: "secret", ANTHROPIC_MODEL: "model" });
    expect(result.configured).toBe(false);
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});
