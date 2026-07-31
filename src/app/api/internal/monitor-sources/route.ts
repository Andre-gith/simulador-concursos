import { isValidCronAuthorization } from "@/lib/monitoring/cron-auth";
import { executeDueMonitors } from "@/lib/monitoring/service";
import { prisma } from "@/lib/prisma";
import { enforceRateLimit } from "@/lib/rate-limit";
import { jobExecutor } from "@/lib/job-executor";
import { enqueueDueMonitors } from "@/lib/jobs/schedulers";

export const maxDuration = 60;

export async function POST(request: Request) {
  if (!isValidCronAuthorization(request.headers.get("authorization"), process.env.MONITOR_CRON_SECRET)) {
    return Response.json({ error: "Não autorizado." }, { status: 401 });
  }
  const limited = await enforceRateLimit("internal:monitor-sources", 2, 60);
  if (!limited.allowed) return Response.json({ error: "Limite excedido." }, { status: 429, headers: { "retry-after": String(limited.retryAfterSeconds) } });
  const executor = jobExecutor();
  if (executor.mode === "queue") {
    const queued = await enqueueDueMonitors(prisma, executor);
    return Response.json({ queued: queued.length, duplicates: queued.filter((item) => item.duplicated).length }, { status: 202 });
  }
  const results = await executeDueMonitors(prisma);
  return Response.json({ processed: results.length });
}
