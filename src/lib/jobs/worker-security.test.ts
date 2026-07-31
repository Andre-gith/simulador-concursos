import { readFileSync } from "node:fs"; import { resolve } from "node:path"; import { describe, expect, it } from "vitest"; import { isPermanentJobError } from "./errors";
const read=(p:string)=>readFileSync(resolve(p),"utf8");
describe("worker de produção",()=>{
  it("falhas permanentes não são repetidas",()=>{expect(isPermanentJobError(new Error("MIME inválido"))).toBe(true);expect(isPermanentJobError(new Error("timeout transitório"))).toBe(false);});
  it("persiste progresso e processa import, monitor e catálogo",()=>{const source=read("src/worker/processor.ts");for(const token of ["importJob.update","downloadSelectedDocuments","executeMonitor","syncCatalogSource","updateProgress"])expect(source).toContain(token);});
  it("possui shutdown gracioso e limites conservadores",()=>{const source=read("src/worker/index.ts");expect(source).toContain("SIGTERM");expect(source).toContain("SIGINT");expect(source).toContain("worker.close");expect(source).toContain("WORKER_CONCURRENCY || 1");});
  it("cron e endpoints enfileiram em produção",()=>{for(const file of ["src/cron/monitor.ts","src/cron/catalog.ts","src/app/api/internal/monitor-sources/route.ts","src/app/api/internal/catalog-sync/route.ts"])expect(read(file)).toContain("enqueue");});
  it("imagem runtime não instala dependências dev e executa como não root",()=>{for(const file of ["Dockerfile.web","Dockerfile.worker"]){const source=read(file);expect(source).toContain("USER ");expect(source).not.toContain("COPY . .\\nUSER");}expect(read("Dockerfile.worker")).toContain("npm ci --omit=dev");});
});
