const { spawn, spawnSync } = require("node:child_process");
const { resolve } = require("node:path");

const required = [
  "DATABASE_URL",
  "AUTH_SECRET",
  "AUTH_URL",
  "NEXT_PUBLIC_APP_URL",
];

function fail(message) {
  console.error(`[demo-start] ${message}`);
  process.exit(1);
}

if (process.env.DEPLOYMENT_MODE !== "demo") fail("DEPLOYMENT_MODE=demo é obrigatório.");
if (process.env.JOB_EXECUTOR !== "disabled") fail("JOB_EXECUTOR=disabled é obrigatório.");
if (process.env.AI_PROVIDER !== "disabled") fail("AI_PROVIDER=disabled é obrigatório.");
if (process.env.RATE_LIMIT_PROVIDER !== "memory") fail("RATE_LIMIT_PROVIDER=memory é obrigatório.");
const missing = required.filter((key) => !process.env[key]?.trim());
if (missing.length) fail(`Configuração incompleta: ${missing.join(", ")}.`);

const prismaCli = resolve("node_modules/prisma/build/index.js");
const migration = spawnSync(process.execPath, [prismaCli, "migrate", "deploy"], {
  stdio: "inherit",
  env: process.env,
});
if (migration.error || migration.status !== 0) fail("Migration falhou; servidor não iniciado.");

const server = spawn(process.execPath, [resolve("server.js")], {
  stdio: "inherit",
  env: process.env,
});
for (const signal of ["SIGTERM", "SIGINT"]) {
  process.on(signal, () => server.kill(signal));
}
server.on("error", () => fail("Falha ao iniciar o servidor."));
server.on("exit", (code, signal) => {
  if (signal) process.kill(process.pid, signal);
  else process.exit(code ?? 1);
});
