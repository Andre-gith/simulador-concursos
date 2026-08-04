import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it, vi } from "vitest";
import { load } from "js-yaml";
import {
  DEMO_AUTOMATION_MESSAGE,
  demoUnavailableResponse,
  deploymentMode,
  isLiteDeployment,
  liteUnavailableResponse,
} from "./deployment-mode";
import { DisabledJobExecutor } from "./job-executor";
import { validateProductionConfig } from "./production-config";

const base = {
  NODE_ENV: "production",
  DATABASE_URL: "postgresql://synthetic",
  AUTH_SECRET: "synthetic-secret",
  AUTH_URL: "https://demo.example.test",
  NEXT_PUBLIC_APP_URL: "https://demo.example.test",
  AI_PROVIDER: "disabled",
} satisfies NodeJS.ProcessEnv;

describe("modo de deployment", () => {
  it("exige modo explícito em produção", () => {
    expect(() => deploymentMode({ NODE_ENV: "production" })).toThrow("explicitamente");
    expect(deploymentMode({ NODE_ENV: "production", DEPLOYMENT_MODE: "demo" })).toBe("demo");
  });

  it("demo aceita executor disabled, memória e ausência de Redis", () => {
    const issues = validateProductionConfig({
      ...base,
      DEPLOYMENT_MODE: "demo",
      JOB_EXECUTOR: "disabled",
      RATE_LIMIT_PROVIDER: "memory",
      STORAGE_PROVIDER: "s3",
    });
    expect(issues.filter(({ severity }) => severity === "error")).toEqual([]);
    expect(issues.some(({ key }) => key === "REDIS_URL")).toBe(false);
  });

  it("lite aceita execução manual inline sem Redis ou BullMQ", async () => {
    const environment = {
      ...base,
      DEPLOYMENT_MODE: "lite",
      JOB_EXECUTOR: "disabled",
      RATE_LIMIT_PROVIDER: "memory",
      STORAGE_PROVIDER: "s3",
      STORAGE_BUCKET: "bucket",
      STORAGE_REGION: "region",
      STORAGE_ACCESS_KEY_ID: "key",
      STORAGE_SECRET_ACCESS_KEY: "secret",
    } satisfies NodeJS.ProcessEnv;
    const issues = validateProductionConfig(environment);
    expect(issues.filter(({ severity }) => severity === "error")).toEqual([]);
    expect(issues.some(({ key }) => key === "REDIS_URL")).toBe(false);
    expect(isLiteDeployment(environment)).toBe(true);

    vi.resetModules();
    const { jobExecutor } = await import("./job-executor");
    const executor = jobExecutor(environment);
    const manualImport = vi.fn().mockResolvedValue({ persisted: true, published: false });
    await expect(executor.execute("manual-import", {}, manualImport)).resolves.toEqual({ persisted: true, published: false });
    expect(executor.mode).toBe("inline");
    expect(manualImport).toHaveBeenCalledOnce();
  });

  it("full exige queue, Redis, rate limit distribuído e segredos de cron", () => {
    const issues = validateProductionConfig({
      ...base,
      DEPLOYMENT_MODE: "full",
      JOB_EXECUTOR: "disabled",
      RATE_LIMIT_PROVIDER: "memory",
      STORAGE_PROVIDER: "s3",
    });
    for (const key of ["JOB_EXECUTOR", "REDIS_URL", "RATE_LIMIT_PROVIDER", "MONITOR_CRON_SECRET", "CATALOG_SYNC_SECRET"]) {
      expect(issues.some((issue) => issue.key === key && issue.severity === "error")).toBe(true);
    }
  });

  it("executor disabled não executa closure, não enfileira e não cria Redis", async () => {
    const inline = vi.fn();
    const executor = new DisabledJobExecutor();
    await expect(executor.execute("test", {}, inline)).rejects.toThrow(DEMO_AUTOMATION_MESSAGE);
    await expect(executor.enqueue({} as never)).rejects.toThrow(DEMO_AUTOMATION_MESSAGE);
    expect(inline).not.toHaveBeenCalled();
  });

  it("resposta de automação demo é sanitizada e usa 503", async () => {
    const response = demoUnavailableResponse();
    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({ error: DEMO_AUTOMATION_MESSAGE });
  });

  it("cron no modo lite responde 503 sem iniciar automações", async () => {
    const response = liteUnavailableResponse();
    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({ error: "Automações em segundo plano estão desabilitadas no modo Lite." });
  });
});

describe("Blueprint e superfície demo", () => {
  const yaml = readFileSync(resolve("render.demo.yaml"), "utf8");
  const parsed = load(yaml) as {
    services: Array<Record<string, unknown>>;
    databases: Array<Record<string, unknown>>;
  };

  it("declara somente Web e PostgreSQL gratuitos", () => {
    expect(parsed.services).toHaveLength(1);
    expect(parsed.services[0]).toMatchObject({
      type: "web",
      name: "nota-de-banca-demo-web",
      runtime: "docker",
      plan: "free",
      autoDeploy: false,
      dockerfilePath: "./Dockerfile.demo",
      healthCheckPath: "/api/health",
    });
    expect(parsed.databases).toEqual([
      expect.objectContaining({ name: "nota-de-banca-demo-postgres", plan: "free" }),
    ]);
    expect(yaml).not.toMatch(/type:\s*(worker|keyvalue|cron)|preDeployCommand|maxShutdownDelaySeconds|plan:\s*(starter|standard|pro)/);
  });

  it("não contém segredos literais e fixa o modo seguro", () => {
    expect(yaml).toContain("value: demo");
    expect(yaml).toContain("value: disabled");
    expect(yaml).toContain("value: memory");
    for (const key of ["AUTH_SECRET", "STORAGE_ACCESS_KEY_ID", "STORAGE_SECRET_ACCESS_KEY"]) {
      expect(yaml).toMatch(new RegExp(`key: ${key}\\s+sync: false`));
    }
  });

  it("startup usa somente migrate deploy antes do servidor", () => {
    const startup = readFileSync(resolve("scripts/start-render-demo.cjs"), "utf8");
    const migration = startup.indexOf('"migrate", "deploy"');
    const server = startup.indexOf('resolve("server.js")');
    expect(migration).toBeGreaterThan(-1);
    expect(server).toBeGreaterThan(migration);
    expect(startup).not.toMatch(/db push|migrate reset|db seed/);
  });

  it("imagem demo é standalone, não root e instala somente runtime no estágio final", () => {
    const dockerfile = readFileSync(resolve("Dockerfile.demo"), "utf8");
    expect(dockerfile).toContain("FROM node:20-bookworm-slim");
    expect(dockerfile).toContain("/app/.next/standalone");
    expect(dockerfile).toContain("npm ci --omit=dev");
    expect(dockerfile).toContain("USER nextjs");
    expect(dockerfile).toContain('CMD ["node", "scripts/start-render-demo.cjs"]');
    expect(dockerfile).toContain("test ! -e .next/standalone/.env");
    expect(dockerfile).toContain("find .next/standalone -name '*.pdf'");
  });

  it("bloqueia APIs e ações antes das automações e desabilita controles", () => {
    for (const path of [
      "src/app/api/internal/monitor-sources/route.ts",
      "src/app/api/internal/catalog-sync/route.ts",
    ]) {
      const source = readFileSync(resolve(path), "utf8");
      const handler = source.slice(source.indexOf("export async function POST"));
      expect(handler.indexOf("isDemoDeployment()")).toBeLessThan(handler.indexOf("enforceRateLimit"));
      expect(source).toContain("demoUnavailableResponse");
    }
    for (const path of [
      "src/app/admin/importacoes/nova/OfficialImportForm.tsx",
      "src/app/admin/monitoramento/[id]/page.tsx",
      "src/app/admin/catalogo/fontes/[id]/page.tsx",
    ]) {
      expect(readFileSync(resolve(path), "utf8")).toContain("disabled");
    }
  });

  it("não altera home, autenticação, registro, simulados ou resultados", () => {
    const statusIndependentPaths = [
      "src/app/(public)/page.tsx",
      "src/app/login/LoginForm.tsx",
      "src/app/api/register/route.ts",
      "src/app/api/attempts/route.ts",
      "src/app/api/attempts/[attemptId]/finish/route.ts",
    ];
    for (const path of statusIndependentPaths) {
      expect(readFileSync(resolve(path), "utf8")).not.toContain("DEPLOYMENT_MODE");
    }
  });
});

describe("Blueprint e superfície lite", () => {
  const yaml = readFileSync(resolve("render.lite.yaml"), "utf8");
  const dockerfile = readFileSync(resolve("Dockerfile.lite"), "utf8");

  it("declara somente Web e PostgreSQL, sem Redis, Worker ou Cron", () => {
    const parsed = load(yaml) as { services: Array<Record<string, unknown>>; databases: Array<Record<string, unknown>>; };
    expect(parsed.services).toHaveLength(1);
    expect(parsed.services[0]).toMatchObject({ type: "web", name: "nota-de-banca-lite-web", dockerfilePath: "./Dockerfile.lite", plan: "free" });
    expect(parsed.databases).toEqual([expect.objectContaining({ name: "nota-de-banca-lite-postgres", plan: "free" })]);
    expect(yaml).toContain("value: lite");
    expect(yaml).toContain("value: disabled");
    expect(yaml).toContain("value: memory");
    expect(yaml).not.toMatch(/REDIS_URL|type:\s*(worker|keyvalue|cron)|dockerCommand|preDeployCommand/);
  });

  it("preserva Prisma e standalone na imagem Lite sem incluir Worker", () => {
    expect(dockerfile).toContain("FROM node:20-bookworm-slim");
    expect(dockerfile).toContain("npx prisma generate && npm run build");
    expect(dockerfile).toContain("/app/.next/standalone");
    expect(dockerfile).toContain("/app/prisma");
    expect(dockerfile).not.toContain("worker");
  });

  it("mantém etapas manuais de importação inline e bloqueia apenas cron automático", () => {
    const imports = readFileSync(resolve("src/app/admin/importacoes/actions.ts"), "utf8");
    for (const stage of ["official-source-analysis", "official-document-download", "official-document-extraction", "validateExamArtifact", "dryRunJob", "importJobForReview"]) {
      expect(imports).toContain(stage);
    }
    for (const path of ["src/app/api/internal/monitor-sources/route.ts", "src/app/api/internal/catalog-sync/route.ts"]) {
      const source = readFileSync(resolve(path), "utf8");
      const handler = source.slice(source.indexOf("export async function POST"));
      expect(handler.indexOf("isLiteDeployment()")).toBeLessThan(handler.indexOf("enforceRateLimit"));
      expect(source).toContain("liteUnavailableResponse");
    }
  });

  it("exibe o aviso Lite discreto sem desabilitar importações manuais", () => {
    const shell = readFileSync(resolve("src/components/layout/AdminShell.tsx"), "utf8");
    expect(shell).toContain("Modo Lite");
    expect(shell).toContain("Importações manuais continuam disponíveis.");
  });
});
