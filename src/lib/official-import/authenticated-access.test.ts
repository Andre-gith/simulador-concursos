import { describe, expect, it } from "vitest";
import { adminAccessDecision } from "../admin-access";

describe("acesso autenticado às importações", () => {
  it("redireciona visitante para login", () => {
    expect(adminAccessDecision(null)).toEqual({ allowed: false, redirectTo: "/login" });
  });
  it("bloqueia USER", () => {
    expect(adminAccessDecision({ user: { id: "user-1", role: "USER" } })).toEqual({ allowed: false, redirectTo: "/" });
  });
  it("permite ADMIN", () => {
    expect(adminAccessDecision({ user: { id: "admin-1", role: "ADMIN" } })).toEqual({ allowed: true });
  });
});
