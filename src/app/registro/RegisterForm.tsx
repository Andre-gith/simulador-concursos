"use client";

import Link from "next/link";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useState } from "react";

export default function RegisterForm() {
  const router = useRouter();
  const [error, setError] = useState("");

  return (
    <section className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-9">
      <p className="text-sm font-bold uppercase tracking-[0.18em] text-emerald-800">
        Nota de Banca
      </p>
      <h1 className="mt-3 text-3xl font-black tracking-tight text-slate-950">
        Criar conta
      </h1>
      <p className="mt-2 text-sm leading-6 text-slate-600">
        Salve tentativas e acompanhe sua evolução em cada prova.
      </p>

      <form
        className="mt-7 space-y-5"
        onSubmit={async (event) => {
          event.preventDefault();
          setError("");
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
          const result = (await response.json()) as { error?: string };
          if (!response.ok) {
            return setError(result.error ?? "Cadastro não realizado.");
          }
          await signIn("credentials", { ...body, redirect: false });
          router.push("/");
          router.refresh();
        }}
      >
        <RegisterField
          label="Nome"
          name="name"
          type="text"
          minLength={2}
          autoComplete="name"
        />
        <RegisterField
          label="E-mail"
          name="email"
          type="email"
          autoComplete="email"
        />
        <RegisterField
          label="Senha"
          hint="Mínimo de 8 caracteres"
          name="password"
          type="password"
          minLength={8}
          autoComplete="new-password"
        />
        {error && (
          <p
            role="alert"
            className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
          >
            {error}
          </p>
        )}
        <button className="min-h-12 w-full rounded-xl bg-amber-400 px-5 py-3 font-bold text-slate-950 transition hover:bg-amber-300 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-800">
          Cadastrar
        </button>
      </form>
      <p className="mt-6 text-center text-sm text-slate-600">
        Já possui conta?{" "}
        <Link href="/login" className="font-bold text-emerald-800">
          Entrar
        </Link>
      </p>
    </section>
  );
}

function RegisterField({
  label,
  hint,
  ...input
}: {
  label: string;
  hint?: string;
  name: string;
  type: string;
  minLength?: number;
  autoComplete: string;
}) {
  return (
    <label className="block text-sm font-semibold text-slate-800">
      {label}
      {hint && (
        <span className="ml-2 font-normal text-slate-500">{hint}</span>
      )}
      <input
        {...input}
        required
        className="mt-2 min-h-12 w-full rounded-xl border border-slate-300 bg-white px-4 text-slate-950 outline-none transition focus:border-emerald-700 focus:ring-2 focus:ring-emerald-100"
      />
    </label>
  );
}
