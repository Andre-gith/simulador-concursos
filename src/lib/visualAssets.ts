import { readFile } from "node:fs/promises";
import { extname, isAbsolute, relative, resolve } from "node:path";

export function resolveImportVisualAsset(
  path: string,
  projectRoot = process.cwd(),
) {
  const importsRoot = resolve(projectRoot, "data", "imports");
  const absolutePath = resolve(projectRoot, path);
  const pathFromImports = relative(importsRoot, absolutePath);

  if (
    !pathFromImports ||
    pathFromImports.startsWith("..") ||
    isAbsolute(pathFromImports)
  ) {
    return null;
  }

  const mimeType =
    {
      ".png": "image/png",
      ".jpg": "image/jpeg",
      ".jpeg": "image/jpeg",
      ".webp": "image/webp",
    }[extname(absolutePath).toLowerCase()] ?? null;

  return mimeType ? { absolutePath, mimeType } : null;
}

export async function loadImportVisualAsset(path: string | null) {
  if (!path) return null;
  const asset = resolveImportVisualAsset(path);
  if (!asset) return null;

  try {
    const contents = await readFile(asset.absolutePath);
    return `data:${asset.mimeType};base64,${contents.toString("base64")}`;
  } catch {
    return null;
  }
}
