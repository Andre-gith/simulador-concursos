import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { contentTypeFor, validateStoredImportFile } from "@/lib/official-import/file-access";
import { privateStorage } from "@/lib/storage";

export async function GET(request: Request, { params }: { params: Promise<{ jobId: string; documentId: string }> }) {
  const session = await auth();
  if (!session?.user?.id) return new Response("Não autenticado.", { status: 401 });
  if (session.user.role !== "ADMIN") return new Response("Acesso negado.", { status: 403 });
  const { jobId, documentId } = await params;
  const document = await prisma.sourceDocument.findFirst({ where: { id: documentId, importJobId: jobId, localPath: { not: null } } });
  if (!document?.localPath) return new Response("Documento não encontrado.", { status: 404 });
  try {
    const file = await validateStoredImportFile(document.localPath, jobId);
    if (file.extension !== ".pdf") return new Response("Tipo de documento proibido.", { status: 415 });
    const download = new URL(request.url).searchParams.get("download") === "1";
    return new Response(new Uint8Array(await privateStorage().get(file.key)), { headers: {
      "content-type": contentTypeFor(file.extension),
      "content-disposition": `${download ? "attachment" : "inline"}; filename="${file.filename}"`,
      "x-content-type-options": "nosniff", "cache-control": "private, no-store",
    } });
  } catch { return new Response("Arquivo indisponível.", { status: 404 }); }
}
