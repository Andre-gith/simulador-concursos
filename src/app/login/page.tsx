"use client";

import Link from "next/link";
import { signIn } from "next-auth/react";
import { useState } from "react";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const router = useRouter();
  const [error, setError] = useState("");
  return (
    <main className="mx-auto max-w-md px-4 py-16">
      <h1 className="text-2xl font-semibold">Entrar</h1>
      <form
        className="mt-6 space-y-4"
        onSubmit={async (event) => {
          event.preventDefault();
          const data = new FormData(event.currentTarget);
          const result = await signIn("credentials", {
            email: data.get("email"),
            password: data.get("password"),
            redirect: false,
          });
          if (result?.error) return setError("E-mail ou senha inválidos.");
          router.push("/");
          router.refresh();
        }}
      >
        <input name="email" type="email" required placeholder="E-mail" className="w-full rounded-lg bg-neutral-900 p-3" />
        <input name="password" type="password" required minLength={8} placeholder="Senha" className="w-full rounded-lg bg-neutral-900 p-3" />
        {error && <p className="text-sm text-red-400">{error}</p>}
        <button className="w-full rounded-lg bg-orange-500 p-3 font-semibold text-neutral-950">Entrar</button>
      </form>
      <p className="mt-4 text-sm text-neutral-400">
        Não tem conta? <Link href="/registro" className="text-orange-400">Cadastre-se</Link>
      </p>
    </main>
  );
}
