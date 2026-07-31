import { prisma } from "@/lib/prisma";
import { validateProductionConfig } from "@/lib/production-config";
import { privateStorage } from "@/lib/storage";
export const dynamic = "force-dynamic";
export async function GET() {
  try {
    const errors = validateProductionConfig().filter((issue) => issue.severity === "error");
    if (errors.length) return Response.json({ status: "not_ready", checks: { configuration: false, database: false, storage: false } }, { status: 503, headers: { "cache-control": "no-store" } });
    await prisma.$queryRaw`SELECT 1`;
    privateStorage();
    return Response.json({ status: "ready", checks: { configuration: true, database: true, storage: true } }, { headers: { "cache-control": "no-store" } });
  } catch {
    return Response.json({ status: "not_ready", checks: { configuration: true, database: false, storage: false } }, { status: 503, headers: { "cache-control": "no-store" } });
  }
}
