import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { contentTypeFor, validateStoredImportFile } from "@/lib/official-import/file-access";
import { isPrivateStorageConfigured, privateStorage } from "@/lib/storage";

export async function GET(request: Request, { params }: { params: Promise<{ jobId: string; artifactId: string }> }) {
  const session = await auth();
  if (!session?.user?.id) return new Response("Não autenticado.", { status: 401 });
  if (session.user.role !== "ADMIN") return new Response("Acesso negado.", { status: 403 });
  if (!isPrivateStorageConfigured()) return new Response("Arquivo indisponível.", { status: 503 });
  const { jobId, artifactId } = await params;
  const artifact = await prisma.importArtifact.findFirst({ where: { id: artifactId, importJobId: jobId } });
  if (!artifact) return new Response("Artefato não encontrado.", { status: 404 });
  try {
    const file = await validateStoredImportFile(artifact.localPath, jobId);
    const url = new URL(request.url); const download = url.searchParams.get("download") === "1";
    const data = await privateStorage().get(file.key);
    const previewable = [".json", ".txt"].includes(file.extension);
    const body = !download && previewable && data.length > 512 * 1024
      ? Buffer.concat([data.subarray(0, 512 * 1024), Buffer.from("\n\n[Prévia limitada a 512 KB]")])
      : data;
    return new Response(new Uint8Array(body), { headers: {
      "content-type": contentTypeFor(file.extension),
      "content-disposition": `${download ? "attachment" : "inline"}; filename="${file.filename}"`,
      "x-content-type-options": "nosniff", "cache-control": "private, no-store",
    } });
  } catch { return new Response("Arquivo indisponível.", { status: 404 }); }
}
