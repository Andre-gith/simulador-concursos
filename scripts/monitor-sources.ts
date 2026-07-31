import { PrismaClient } from "@prisma/client";
import { executeDueMonitors, executeMonitor, FixtureDiscoveryProvider } from "../src/lib/monitoring/service";

async function main() {
  const args = process.argv.slice(2);
  const due = args.includes("--due");
  const dryRun = args.includes("--dry-run");
  const monitorId = args.find((value) => value.startsWith("--monitor-id="))?.split("=")[1];
  const fixture = args.find((value) => value.startsWith("--fixture="))?.slice("--fixture=".length);
  if (!due && !monitorId && !fixture) throw new Error("Use --due, --monitor-id=<id> ou --fixture=<diretório>.");
  const prisma = new PrismaClient();
  try {
    const provider = fixture ? new FixtureDiscoveryProvider(fixture) : undefined;
    if (due) {
      console.log(JSON.stringify(await executeDueMonitors(prisma, { dryRun, provider }), null, 2));
      return;
    }
    const selectedId = monitorId ?? (await prisma.sourceMonitor.findFirst({ orderBy: { createdAt: "asc" }, select: { id: true } }))?.id;
    if (!selectedId) throw new Error("Nenhum monitor disponível para a fixture.");
    console.log(JSON.stringify(await executeMonitor(prisma, selectedId, { dryRun, manual: true, provider }), null, 2));
  } finally { await prisma.$disconnect(); }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
