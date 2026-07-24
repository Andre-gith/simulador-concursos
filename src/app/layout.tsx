import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Simulador de Concursos — Pontuação Real da Banca",
  description:
    "Treine com a regra de pontuação exata da sua banca: Cebraspe, Cesgranrio, FGV.",
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
