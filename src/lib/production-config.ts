export type ConfigIssue = { severity: "error" | "warning"; key: string; message: string };
const present = (env: NodeJS.ProcessEnv, key: string) => Boolean(env[key]?.trim());
export function validateProductionConfig(env: NodeJS.ProcessEnv = process.env): ConfigIssue[] {
  const production = env.NODE_ENV === "production"; const issues: ConfigIssue[] = [];
  const requireKey = (key: string) => { if (!present(env, key)) issues.push({ severity: production ? "error" : "warning", key, message: `${key} não configurada.` }); };
  const mode = env.DEPLOYMENT_MODE;
  if (production && !["full", "demo", "lite"].includes(mode ?? "")) issues.push({ severity: "error", key: "DEPLOYMENT_MODE", message: "Defina explicitamente DEPLOYMENT_MODE=full, demo ou lite." });
  for (const key of ["DATABASE_URL", "AUTH_SECRET", "AUTH_URL", "NEXT_PUBLIC_APP_URL"]) requireKey(key);
  if (mode === "full") for (const key of ["MONITOR_CRON_SECRET", "CATALOG_SYNC_SECRET", "REDIS_URL", "QUEUE_PREFIX"]) requireKey(key);
  if (production && (mode === "full" || mode === "lite") && env.STORAGE_PROVIDER !== "s3") issues.push({ severity: "error", key: "STORAGE_PROVIDER", message: "Produção full e lite exigem storage privado persistente S3-compatible." });
  if (env.STORAGE_PROVIDER === "s3" && (mode === "full" || mode === "lite")) for (const key of ["STORAGE_BUCKET", "STORAGE_REGION", "STORAGE_ACCESS_KEY_ID", "STORAGE_SECRET_ACCESS_KEY"]) requireKey(key);
  if (mode === "demo" && env.STORAGE_PROVIDER === "s3" && !present(env, "STORAGE_BUCKET")) issues.push({ severity: "warning", key: "STORAGE_BUCKET", message: "Storage externo recomendado; rotas de artefatos ficarão indisponíveis sem configuração S3 completa." });
  if (production && mode === "full" && env.RATE_LIMIT_PROVIDER !== "redis") issues.push({ severity: "error", key: "RATE_LIMIT_PROVIDER", message: "Produção full exige rate limit distribuído." });
  if (production && mode === "demo" && env.RATE_LIMIT_PROVIDER !== "memory") issues.push({ severity: "error", key: "RATE_LIMIT_PROVIDER", message: "Demonstração de instância única exige RATE_LIMIT_PROVIDER=memory." });
  if (production && mode === "lite" && env.RATE_LIMIT_PROVIDER !== "memory") issues.push({ severity: "error", key: "RATE_LIMIT_PROVIDER", message: "Modo Lite exige rate limit em memória." });
  if (env.RATE_LIMIT_PROVIDER === "redis") requireKey("REDIS_URL");
  if (production && mode === "full" && env.JOB_EXECUTOR !== "queue") issues.push({ severity: "error", key: "JOB_EXECUTOR", message: "Produção full exige worker/fila." });
  if (production && mode === "demo" && env.JOB_EXECUTOR !== "disabled") issues.push({ severity: "error", key: "JOB_EXECUTOR", message: "Demonstração exige automações desabilitadas." });
  if (production && mode === "lite" && env.JOB_EXECUTOR !== "disabled") issues.push({ severity: "error", key: "JOB_EXECUTOR", message: "Modo Lite exige automações em segundo plano desabilitadas." });
  if (env.JOB_EXECUTOR === "queue") {
    requireKey("REDIS_URL");
    requireKey("QUEUE_PREFIX");
  }
  if (mode === "full" && env.JOB_EXECUTOR === "disabled") issues.push({ severity: production ? "error" : "warning", key: "JOB_EXECUTOR", message: "JOB_EXECUTOR=disabled é permitido somente nos modos demo e lite." });
  if (mode === "demo" && env.AI_PROVIDER !== "disabled") issues.push({ severity: production ? "error" : "warning", key: "AI_PROVIDER", message: "Demonstração exige AI_PROVIDER=disabled." });
  if (mode === "demo") {
    issues.push({ severity: "warning", key: "DEMO", message: "Ambiente apenas demonstrativo: automações indisponíveis." });
    issues.push({ severity: "warning", key: "RATE_LIMIT_PROVIDER", message: "Rate limiting local; não usar com múltiplas instâncias." });
    issues.push({ severity: "warning", key: "RENDER_FREE", message: "Web gratuito sujeito a repouso e inicialização lenta." });
  }
  if (mode === "lite") {
    issues.push({ severity: "warning", key: "LITE", message: "Automações em segundo plano indisponíveis; operações manuais executam inline." });
    issues.push({ severity: "warning", key: "RATE_LIMIT_PROVIDER", message: "Rate limiting local; não usar com múltiplas instâncias." });
    issues.push({ severity: "warning", key: "RENDER_FREE", message: "Web gratuito sujeito a repouso e inicialização lenta." });
  }
  if (production && env.AI_PROVIDER && !["disabled", "anthropic", "openai"].includes(env.AI_PROVIDER)) issues.push({ severity: "error", key: "AI_PROVIDER", message: "Provider de IA inválido." });
  return issues;
}
export function assertProductionConfig(env = process.env) {
  const errors = validateProductionConfig(env).filter((issue) => issue.severity === "error");
  if (errors.length) throw new Error(`Configuração de produção inválida: ${errors.map((item) => item.key).join(", ")}`);
}
