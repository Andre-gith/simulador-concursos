import { createHash } from "node:crypto";
import { prisma } from "../src/lib/prisma";
import { LocalPrivateStorageProvider, ObjectStorageProvider } from "../src/lib/storage";

const jobId = process.argv.find((value) => value.startsWith("--job-id="))?.slice(9);
const all = process.argv.includes("--all");
const visualAssetsOnly = process.argv.includes("--visual-assets");
const dryRun = process.argv.includes("--dry-run");

async function main() {
  if (!jobId && !all && !visualAssetsOnly) throw new Error("Informe --job-id=<id>, --visual-assets ou --all.");
  if (!dryRun && process.env.STORAGE_PROVIDER !== "s3") throw new Error("A migração exige STORAGE_PROVIDER=s3; use --dry-run para auditoria local.");
  const where = jobId ? { importJobId: jobId } : {};
  const [documents, artifacts, visualAssets] = await Promise.all([
    prisma.sourceDocument.findMany({ where: { ...where, localPath: { not: null } }, select: { localPath: true, sha256: true } }),
    prisma.importArtifact.findMany({ where, select: { localPath: true, sha256: true } }),
    jobId ? [] : prisma.questionVisualAsset.findMany({ select: { assetPath: true } }),
  ]);
  const source = new LocalPrivateStorageProvider();
  const destination = dryRun ? null : new ObjectStorageProvider();
  const report = { dryRun, discovered: 0, missingLocal: 0, alreadyPresent: 0, uploaded: 0, verified: 0, failed: 0 };
  const importFiles = visualAssetsOnly ? [] : [...documents, ...artifacts].map((item) => ({ path: item.localPath, sha256: item.sha256 }));
  const visualFiles = jobId ? [] : visualAssets.map((item) => ({ path: item.assetPath, sha256: null }));
  for (const item of [...importFiles, ...visualFiles]) {
    if (!item.path) continue; report.discovered += 1;
    const key = item.path.replaceAll("\\", "/").replace(/^.*?(data\/imports\/)/, "$1");
    if (!(await source.exists(key))) { report.missingLocal += 1; continue; }
    const data = await source.get(key); const digest = createHash("sha256").update(data).digest("hex");
    if (item.sha256 && item.sha256 !== digest) { report.failed += 1; continue; }
    if (dryRun) continue;
    const metadata = await destination!.metadata(key);
    if (metadata?.sha256 === digest) { report.alreadyPresent += 1; continue; }
    await destination!.put(key, data, { sha256: digest });
    report.uploaded += 1;
    if (await destination!.sha256(key) === digest) report.verified += 1; else report.failed += 1;
  }
  console.log(JSON.stringify(report, null, 2));
  if (report.failed) process.exitCode = 1;
}
main().finally(() => prisma.$disconnect());
