import { NextRequest, NextResponse } from "next/server";
import { isCatalogCronAuthorized } from "@/lib/catalog-sync/cron-auth";
import { syncDueCatalogSources } from "@/lib/catalog-sync/service";
import { prisma } from "@/lib/prisma";
import { enforceRateLimit } from "@/lib/rate-limit";
import { jobExecutor } from "@/lib/job-executor";
import { enqueueDueCatalogSources } from "@/lib/jobs/schedulers";

export const maxDuration = 60;
export async function POST(request: NextRequest) {
  if (!isCatalogCronAuthorized(request.headers.get("authorization"))) {
    return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  }
  const limited = await enforceRateLimit("internal:catalog-sync", 2, 60);
  if (!limited.allowed) return NextResponse.json({ error: "Limite excedido." }, { status: 429, headers: { "retry-after": String(limited.retryAfterSeconds) } });
  const executor = jobExecutor();
  if (executor.mode === "queue") {
    const queued = await enqueueDueCatalogSources(prisma, executor);
    return NextResponse.json({ queued: queued.length, duplicates: queued.filter((item) => item.duplicated).length }, { status: 202 });
  }
  const results = await syncDueCatalogSources(prisma);
  return NextResponse.json({ processed: results.length, succeeded: results.filter((item) => item.status === "COMPLETED").length });
}
