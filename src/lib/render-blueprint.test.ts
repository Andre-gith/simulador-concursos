import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { load } from "js-yaml";

const blueprint = readFileSync(resolve("render.yaml"), "utf8");
const parsed = load(blueprint) as {
  services: Array<{ type: string; name: string }>;
  databases: Array<{ name: string }>;
};
const packageJson = JSON.parse(
  readFileSync(resolve("package.json"), "utf8"),
) as { dependencies?: Record<string, string> };

describe("Render Blueprint", () => {
  it("declara recursos únicos sem criar cron jobs", () => {
    expect(parsed.services).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ type: "web", name: "nota-de-banca-web" }),
        expect.objectContaining({ type: "worker", name: "nota-de-banca-worker" }),
        expect.objectContaining({ type: "keyvalue", name: "nota-de-banca-redis" }),
      ]),
    );
    expect(new Set(parsed.services.map(({ name }) => name)).size).toBe(
      parsed.services.length,
    );
    expect(parsed.databases).toEqual([
      expect.objectContaining({ name: "nota-de-banca-postgres" }),
    ]);
    expect(parsed.services.some(({ type }) => type === "cron")).toBe(false);
  });

  it("usa Dockerfiles existentes, rede privada e auto-deploy desligado", () => {
    expect(existsSync(resolve("Dockerfile.web"))).toBe(true);
    expect(existsSync(resolve("Dockerfile.worker"))).toBe(true);
    expect(blueprint).toContain("dockerfilePath: ./Dockerfile.web");
    expect(blueprint).toContain("dockerfilePath: ./Dockerfile.worker");
    expect(blueprint.match(/autoDeploy: false/g)).toHaveLength(2);
    expect(blueprint.match(/ipAllowList: \[\]/g)).toHaveLength(2);
  });

  it("referencia datastores e não contém valores para segredos manuais", () => {
    expect(blueprint).toContain("property: connectionString");
    for (const key of [
      "AUTH_SECRET",
      "MONITOR_CRON_SECRET",
      "CATALOG_SYNC_SECRET",
      "STORAGE_ACCESS_KEY_ID",
      "STORAGE_SECRET_ACCESS_KEY",
    ]) {
      expect(blueprint).toMatch(
        new RegExp(`key: ${key}\\s+sync: false`, "g"),
      );
      expect(blueprint).not.toMatch(new RegExp(`${key}:\\s*\\S+`));
    }
  });

  it("executa migration somente no pre-deploy do Worker com CLI disponível", () => {
    expect(blueprint.match(/preDeployCommand:/g)).toHaveLength(1);
    expect(blueprint).toContain("preDeployCommand: npx prisma migrate deploy");
    expect(packageJson.dependencies?.prisma).toBe("6.19.3");
    expect(blueprint).not.toMatch(/prisma (db push|migrate reset)/);
  });

  it("mantém Web acessível pelo PORT do ambiente em todas as interfaces", () => {
    const dockerfile = readFileSync(resolve("Dockerfile.web"), "utf8");
    expect(dockerfile).toContain("PORT=3000");
    expect(dockerfile).toContain("HOSTNAME=0.0.0.0");
    expect(dockerfile).toContain('CMD ["node", "server.js"]');
  });
});
