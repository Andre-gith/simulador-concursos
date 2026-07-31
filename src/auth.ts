import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { z } from "zod";

import { prisma } from "@/lib/prisma";
import { verifyPassword } from "@/lib/password";
import { enforceRateLimit } from "./lib/rate-limit";

export async function authorizeCredentials(credentials: unknown) {
  const parsed = z
    .object({
      email: z.string().email().transform((value) => value.toLowerCase()),
      password: z.string().min(8),
    })
    .safeParse(credentials);
  if (!parsed.success) return null;
  const limited = await enforceRateLimit(`login:${parsed.data.email}`, 10, 900);
  if (!limited.allowed) return null;

  const user = await prisma.user.findUnique({
    where: { email: parsed.data.email },
  });
  if (!user || !user.passwordHash) {
    return null;
  }

  const passwordIsValid = await verifyPassword(
    parsed.data.password,
    user.passwordHash,
  );

  if (!passwordIsValid) {
    return null;
  }
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
  };
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  session: { strategy: "jwt", maxAge: 8 * 60 * 60 },
  cookies: {
    sessionToken: {
      name: process.env.NODE_ENV === "production" ? "__Secure-authjs.session-token" : "authjs.session-token",
      options: { httpOnly: true, sameSite: "lax", path: "/", secure: process.env.NODE_ENV === "production" },
    },
  },
  pages: { signIn: "/login" },
  providers: [
    Credentials({
      credentials: {
        email: { label: "E-mail", type: "email" },
        password: { label: "Senha", type: "password" },
      },
      authorize: authorizeCredentials,
    }),
  ],
  callbacks: {
    jwt({ token, user }) {
      if (user) {
        token.userId = user.id;
        token.role = user.role;
      }
      return token;
    },
    session({ session, token }) {
      if (
        session.user &&
        typeof token.userId === "string" &&
        token.userId.trim().length > 0
      ) {
        session.user.id = token.userId;
      }
      if (session.user) {
        session.user.role = token.role === "ADMIN" ? "ADMIN" : "USER";
      }
      return session;
    },
  },
});
