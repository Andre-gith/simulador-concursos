"use client";

import Link from "next/link";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useState } from "react";

export default function LoginForm() {
  const router = useRouter();
  const [error, setError] = useState("");

  return (
    <section className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-9">
      <p className="text-sm font-bold uppercase tracking-[0.18em] text-emerald-800">
        Nota de Banca
      </p>
      <h1 className="mt-3 text-3xl font-black tracking-tight text-slate-950">
        Entrar
      </h1>
      <p className="mt-2 text-sm leading-6 text-slate-600">
        Acesse seus simulados, resultados e histórico de tentativas.
      </p>

      <form
        method="post"
        className="mt-7 space-y-5"
        onSubmit={async (event) => {
          event.preventDefault();
          setError("");
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
        <AuthField
          label="E-mail"
          name="email"
          type="email"
          autoComplete="email"
        />
        <AuthField
          label="Senha"
          name="password"
          type="password"
          minLength={8}
          autoComplete="current-password"
        />
        {error && (
          <p
            role="alert"
            className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
          >
            {error}
          </p>
        )}
        <button type="submit" className="min-h-12 w-full rounded-xl bg-amber-400 px-5 py-3 font-bold text-slate-950 transition hover:bg-amber-300 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-800">
          Entrar
        </button>
      </form>
      <p className="mt-6 text-center text-sm text-slate-600">
        Não tem conta?{" "}
        <Link href="/registro" className="font-bold text-emerald-800">
          Cadastre-se
        </Link>
      </p>
    </section>
  );
}

function AuthField({
  label,
  name,
  type,
  minLength,
  autoComplete,
}: {
  label: string;
  name: string;
  type: string;
  minLength?: number;
  autoComplete: string;
}) {
  return (
    <label className="block text-sm font-semibold text-slate-800">
      {label}
      <input
        name={name}
        type={type}
        required
        minLength={minLength}
        autoComplete={autoComplete}
        className="mt-2 min-h-12 w-full rounded-xl border border-slate-300 bg-white px-4 text-slate-950 outline-none transition focus:border-emerald-700 focus:ring-2 focus:ring-emerald-100"
      />
    </label>
  );
}
