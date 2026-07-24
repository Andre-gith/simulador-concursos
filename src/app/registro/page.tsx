"use client";

import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useState } from "react";

export default function RegisterPage() {
  const router = useRouter();
  const [error, setError] = useState("");
  return (
    <main className="mx-auto max-w-md px-4 py-16">
      <h1 className="text-2xl font-semibold">Criar conta</h1>
      <form className="mt-6 space-y-4" onSubmit={async (event) => {
        event.preventDefault();
        const data = new FormData(event.currentTarget);
        const body = {
          name: data.get("name"),
          email: data.get("email"),
          password: data.get("password"),
        };
        const response = await fetch("/api/register", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        const result = await response.json() as { error?: string };
        if (!response.ok) return setError(result.error ?? "Cadastro não realizado.");
        await signIn("credentials", { ...body, redirect: false });
        router.push("/");
        router.refresh();
      }}>
        <input name="name" required minLength={2} placeholder="Nome" className="w-full rounded-lg bg-neutral-900 p-3" />
        <input name="email" type="email" required placeholder="E-mail" className="w-full rounded-lg bg-neutral-900 p-3" />
        <input name="password" type="password" required minLength={8} placeholder="Senha (mínimo 8 caracteres)" className="w-full rounded-lg bg-neutral-900 p-3" />
        {error && <p className="text-sm text-red-400">{error}</p>}
        <button className="w-full rounded-lg bg-orange-500 p-3 font-semibold text-neutral-950">Cadastrar</button>
      </form>
    </main>
  );
}
