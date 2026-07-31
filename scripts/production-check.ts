import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { execFileSync } from "node:child_process";
import { parse } from "dotenv";
import { validateProductionConfig } from "../src/lib/production-config";

const envFile = process.argv.find((value) => value.startsWith("--env-file="))?.slice(11);
const environment = { ...process.env, ...(envFile ? parse(readFileSync(resolve(envFile))) : {}) };
const issues = validateProductionConfig(environment);
if (!existsSync(resolve("prisma/migrations"))) issues.push({ severity: environment.NODE_ENV === "production" ? "error" : "warning", key: "MIGRATIONS", message: "Diretório de migrations ausente." });
for (const directory of ["public/data/imports", "public/uploads"]) if (existsSync(resolve(directory))) issues.push({ severity: "error", key: "PUBLIC_STORAGE", message: "Arquivo privado encontrado sob public/." });
try { execFileSync(process.execPath, [resolve("node_modules/prisma/build/index.js"), "validate"], { stdio: "ignore", env: environment }); }
catch { issues.push({ severity: "error", key: "PRISMA", message: "Schema Prisma inválido." }); }
for (const issue of issues) console[issue.severity === "error" ? "error" : "warn"](`[${issue.severity.toUpperCase()}] ${issue.key}: ${issue.message}`);
console.log(`Production check: ${issues.filter((item) => item.severity === "error").length} erro(s), ${issues.filter((item) => item.severity === "warning").length} aviso(s).`);
if (issues.some((item) => item.severity === "error")) process.exitCode = 1;
