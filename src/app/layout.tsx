import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Nota de Banca — Pontuação real da sua prova",
  description:
    "Treine concursos com penalidades, pesos e regras de pontuação configuradas para cada prova.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}
