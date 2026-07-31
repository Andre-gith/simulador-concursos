import { basename, extname, relative, resolve, sep } from "node:path";
import { officialImportStorageRoot } from "./workflow";

const allowedExtensions = new Set([".pdf", ".json", ".txt", ".png", ".jpg", ".jpeg", ".webp"]);

export async function validateStoredImportFile(localPath: string, expectedJobId: string) {
  const base = resolve(officialImportStorageRoot, expectedJobId);
  const target = resolve(localPath);
  if (target !== base && !target.startsWith(`${base}${sep}`)) throw new Error("Arquivo fora do diretório do trabalho.");
  const extension = extname(target).toLowerCase();
  if (!allowedExtensions.has(extension)) throw new Error("Extensão não permitida.");
  return { target, key: relative(process.cwd(), target).replaceAll("\\", "/"), extension, filename: basename(target).replace(/[^\w.-]/g, "_") };
}

export function contentTypeFor(extension: string) {
  return ({ ".pdf": "application/pdf", ".json": "application/json; charset=utf-8", ".txt": "text/plain; charset=utf-8",
    ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".webp": "image/webp" } as Record<string, string>)[extension] ?? "application/octet-stream";
}
