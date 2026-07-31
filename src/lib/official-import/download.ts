import { createHash } from "node:crypto";
import { mkdir, open, rename, stat, unlink } from "node:fs/promises";
import { dirname, resolve, sep } from "node:path";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import { DOWNLOAD_LIMITS, parseSecureUrl, validatePublicDns } from "./url-security";

export function safeImportPath(root: string, ...segments: string[]) {
  const target = resolve(root, ...segments);
  const normalizedRoot = resolve(root);
  if (target !== normalizedRoot && !target.startsWith(`${normalizedRoot}${sep}`)) {
    throw new Error("Tentativa de path traversal bloqueada.");
  }
  return target;
}

export async function downloadOfficialPdf(options: {
  url: string; destination: string; approvedHosts?: string[];
  fetchImplementation?: typeof fetch;
}) {
  const fetcher = options.fetchImplementation ?? fetch;
  let current = parseSecureUrl(options.url, options.approvedHosts);
  for (let redirect = 0; redirect <= DOWNLOAD_LIMITS.maxRedirects; redirect += 1) {
    await validatePublicDns(current);
    const response = await fetcher(current, {
      redirect: "manual", signal: AbortSignal.timeout(DOWNLOAD_LIMITS.timeoutMs),
      headers: { "user-agent": "NotaDeBanca-OfficialImporter/1.0 (administrative document fetcher)" },
    });
    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get("location");
      if (!location) throw new Error("Redirecionamento sem destino.");
      current = parseSecureUrl(new URL(location, current).href, options.approvedHosts);
      continue;
    }
    if (!response.ok || !response.body) throw new Error(`Download recusado (HTTP ${response.status}).`);
    const contentType = response.headers.get("content-type")?.split(";")[0].trim().toLowerCase();
    if (contentType !== "application/pdf") throw new Error("MIME type não permitido; esperado application/pdf.");
    const declared = Number(response.headers.get("content-length") ?? 0);
    if (declared > DOWNLOAD_LIMITS.maxBytes) throw new Error("PDF excede o limite de 20 MB.");
    await mkdir(dirname(options.destination), { recursive: true });
    const temporary = `${options.destination}.part`;
    const handle = await open(temporary, "w");
    let bytes = 0;
    const hash = createHash("sha256");
    const limiter = new TransformStream<Uint8Array, Uint8Array>({
      transform(chunk, controller) {
        bytes += chunk.byteLength;
        if (bytes > DOWNLOAD_LIMITS.maxBytes) throw new Error("PDF excede o limite de 20 MB.");
        hash.update(chunk); controller.enqueue(chunk);
      },
    });
    try {
      await pipeline(Readable.fromWeb(response.body.pipeThrough(limiter) as never), handle.createWriteStream());
      const check = await open(temporary, "r");
      const header = Buffer.alloc(5); await check.read(header, 0, 5, 0); await check.close();
      if (header.toString("ascii") !== "%PDF-") throw new Error("A assinatura real do arquivo não é PDF.");
      await rename(temporary, options.destination);
    } catch (error) { await handle.close().catch(() => undefined); await unlink(temporary).catch(() => undefined); throw error; }
    return { finalUrl: current.href, mimeType: contentType, size: (await stat(options.destination)).size, sha256: hash.digest("hex") };
  }
  throw new Error("Limite de redirecionamentos excedido.");
}
