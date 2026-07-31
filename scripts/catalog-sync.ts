import { prisma } from "../src/lib/prisma";
import { syncCatalogSource, syncDueCatalogSources } from "../src/lib/catalog-sync/service";

function argument(name: string) {
  const prefix = `--${name}=`;
  return process.argv.find((item) => item.startsWith(prefix))?.slice(prefix.length);
}

async function main() {
  const sourceId = argument("source");
  const fixturePath = argument("fixture");
  const dryRun = process.argv.includes("--dry-run");
  const due = process.argv.includes("--due");
  if (due) console.log(JSON.stringify(await syncDueCatalogSources(prisma), null, 2));
  else if (sourceId) console.log(JSON.stringify(await syncCatalogSource(prisma, sourceId, { dryRun, fixturePath }), null, 2));
  else throw new Error("Use --due ou --source=<id>. Opções: --dry-run e --fixture=<caminho>.");
}

main().finally(() => prisma.$disconnect());
