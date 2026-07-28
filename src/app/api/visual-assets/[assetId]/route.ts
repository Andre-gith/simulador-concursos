import { readFile } from "node:fs/promises";

import { PublicationStatus } from "@prisma/client";
import { NextResponse } from "next/server";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { resolveImportVisualAsset } from "@/lib/visualAssets";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ assetId: string }> },
) {
  const { assetId } = await params;
  const asset = await prisma.questionVisualAsset.findUnique({
    where: { id: assetId },
    select: {
      assetPath: true,
      question: { select: { status: true } },
    },
  });
  if (!asset) return new NextResponse("Recurso não encontrado.", { status: 404 });

  const session = await auth();
  const isAdmin =
    Boolean(session?.user?.id) && session?.user?.role === "ADMIN";
  if (asset.question.status !== PublicationStatus.PUBLISHED && !isAdmin) {
    return new NextResponse("Recurso não encontrado.", { status: 404 });
  }

  const resolved = resolveImportVisualAsset(asset.assetPath);
  if (!resolved) {
    console.error("Caminho de recurso visual rejeitado.", { assetId });
    return new NextResponse("Recurso não encontrado.", { status: 404 });
  }
  try {
    const body = await readFile(resolved.absolutePath);
    return new NextResponse(body, {
      headers: {
        "Content-Type": resolved.mimeType,
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    console.error("Falha ao ler recurso visual.", {
      assetId,
      error: error instanceof Error ? error.message : String(error),
    });
    return new NextResponse("Recurso não encontrado.", { status: 404 });
  }
}
