export type ConfigIssue = { severity: "error" | "warning"; key: string; message: string };
const present = (env: NodeJS.ProcessEnv, key: string) => Boolean(env[key]?.trim());
export function validateProductionConfig(env: NodeJS.ProcessEnv = process.env): ConfigIssue[] {
  const production = env.NODE_ENV === "production"; const issues: ConfigIssue[] = [];
  const requireKey = (key: string) => { if (!present(env, key)) issues.push({ severity: production ? "error" : "warning", key, message: `${key} não configurada.` }); };
  for (const key of ["DATABASE_URL", "AUTH_SECRET", "AUTH_URL", "NEXT_PUBLIC_APP_URL", "MONITOR_CRON_SECRET", "CATALOG_SYNC_SECRET"]) requireKey(key);
  if (production && env.STORAGE_PROVIDER !== "s3") issues.push({ severity: "error", key: "STORAGE_PROVIDER", message: "Produção exige storage privado persistente S3-compatible." });
  if (env.STORAGE_PROVIDER === "s3") for (const key of ["STORAGE_BUCKET", "STORAGE_REGION", "STORAGE_ACCESS_KEY_ID", "STORAGE_SECRET_ACCESS_KEY"]) requireKey(key);
  if (production && env.RATE_LIMIT_PROVIDER !== "redis") issues.push({ severity: "error", key: "RATE_LIMIT_PROVIDER", message: "Endpoints críticos exigem rate limit distribuído em produção." });
  if (env.RATE_LIMIT_PROVIDER === "redis") requireKey("REDIS_URL");
  if (production && env.JOB_EXECUTOR !== "queue") issues.push({ severity: "error", key: "JOB_EXECUTOR", message: "Operações longas exigem worker/fila configurado em produção." });
  if (env.JOB_EXECUTOR === "queue") {
    requireKey("REDIS_URL");
    requireKey("QUEUE_PREFIX");
  }
  if (production && env.AI_PROVIDER && !["disabled", "anthropic", "openai"].includes(env.AI_PROVIDER)) issues.push({ severity: "error", key: "AI_PROVIDER", message: "Provider de IA inválido." });
  return issues;
}
export function assertProductionConfig(env = process.env) {
  const errors = validateProductionConfig(env).filter((issue) => issue.severity === "error");
  if (errors.length) throw new Error(`Configuração de produção inválida: ${errors.map((item) => item.key).join(", ")}`);
}
