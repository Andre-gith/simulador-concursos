import { beforeEach, describe, expect, it, vi } from "vitest";

const { findUniqueMock, verifyPasswordMock, nextAuthMock } = vi.hoisted(() => ({
  findUniqueMock: vi.fn(),
  verifyPasswordMock: vi.fn(),
  nextAuthMock: vi.fn(),
}));

vi.mock("next-auth", () => ({
  default: nextAuthMock.mockImplementation((config) => ({
    handlers: {},
    auth: vi.fn(),
    signIn: vi.fn(),
    signOut: vi.fn(),
    __config: config,
  })),
}));

vi.mock("next-auth/providers/credentials", () => ({
  default: vi.fn((config) => config),
}));

vi.mock("@/lib/prisma", () => ({
  prisma: {
    user: {
      findUnique: findUniqueMock,
    },
  },
}));

vi.mock("@/lib/password", () => ({
  verifyPassword: verifyPasswordMock,
}));

import { authorizeCredentials } from "./auth";

type AuthConfiguration = {
  callbacks: {
    session(input: {
      session: {
        user?: {
          id?: string;
          role?: "USER" | "ADMIN";
        };
      };
      token: {
        userId?: unknown;
        role?: unknown;
      };
    }): {
      user?: {
        id?: string;
        role?: "USER" | "ADMIN";
      };
    };
  };
};

function sessionCallback() {
  const invocation = nextAuthMock.mock.calls[0];
  if (!invocation) throw new Error("NextAuth não foi configurado.");
  return (invocation[0] as AuthConfiguration).callbacks.session;
}

describe("Auth.js", () => {
  beforeEach(() => {
    findUniqueMock.mockReset();
    verifyPasswordMock.mockReset();
  });

  it("atribui token.userId válido à sessão", () => {
    const session = sessionCallback()({
      session: { user: {} },
      token: { userId: "user-123", role: "USER" },
    });

    expect(session.user?.id).toBe("user-123");
  });

  it("não cria ID quando token.userId está ausente", () => {
    const session = sessionCallback()({
      session: { user: {} },
      token: { role: "USER" },
    });

    expect(session.user).not.toHaveProperty("id");
  });

  it.each([123, true, {}, [], null, ""])(
    "não cria ID para token.userId inválido: %j",
    (userId) => {
      const session = sessionCallback()({
        session: { user: {} },
        token: { userId, role: "USER" },
      });

      expect(session.user).not.toHaveProperty("id");
    },
  );

  it("rejeita login com usuário inexistente", async () => {
    findUniqueMock.mockResolvedValue(null);

    await expect(
      authorizeCredentials({
        email: "usuario@example.com",
        password: "senha-segura",
      }),
    ).resolves.toBeNull();
    expect(verifyPasswordMock).not.toHaveBeenCalled();
  });

  it("rejeita login quando passwordHash está ausente", async () => {
    findUniqueMock.mockResolvedValue({
      id: "user-123",
      email: "usuario@example.com",
      name: "Usuário",
      role: "USER",
      passwordHash: null,
    });

    await expect(
      authorizeCredentials({
        email: "usuario@example.com",
        password: "senha-segura",
      }),
    ).resolves.toBeNull();
    expect(verifyPasswordMock).not.toHaveBeenCalled();
  });

  it("rejeita senha incorreta", async () => {
    findUniqueMock.mockResolvedValue({
      id: "user-123",
      email: "usuario@example.com",
      name: "Usuário",
      role: "USER",
      passwordHash: "hash",
    });
    verifyPasswordMock.mockResolvedValue(false);

    await expect(
      authorizeCredentials({
        email: "usuario@example.com",
        password: "senha-incorreta",
      }),
    ).resolves.toBeNull();
  });

  it("aceita senha correta e normaliza o e-mail", async () => {
    findUniqueMock.mockResolvedValue({
      id: "user-123",
      email: "usuario@example.com",
      name: "Usuário",
      role: "USER",
      passwordHash: "hash",
    });
    verifyPasswordMock.mockResolvedValue(true);

    await expect(
      authorizeCredentials({
        email: "USUARIO@EXAMPLE.COM",
        password: "senha-correta",
      }),
    ).resolves.toEqual({
      id: "user-123",
      email: "usuario@example.com",
      name: "Usuário",
      role: "USER",
    });
    expect(findUniqueMock).toHaveBeenCalledWith({
      where: { email: "usuario@example.com" },
    });
    expect(verifyPasswordMock).toHaveBeenCalledWith("senha-correta", "hash");
  });

  it("aceita credenciais válidas de administrador sem alterar a verificação", async () => {
    findUniqueMock.mockResolvedValue({
      id: "admin-123",
      email: "admin@example.com",
      name: "Admin",
      role: "ADMIN",
      passwordHash: "hash-admin",
    });
    verifyPasswordMock.mockResolvedValue(true);

    await expect(
      authorizeCredentials({
        email: "admin@example.com",
        password: "senha-admin",
      }),
    ).resolves.toEqual({
      id: "admin-123",
      email: "admin@example.com",
      name: "Admin",
      role: "ADMIN",
    });
    expect(verifyPasswordMock).toHaveBeenCalledWith(
      "senha-admin",
      "hash-admin",
    );
  });
});
