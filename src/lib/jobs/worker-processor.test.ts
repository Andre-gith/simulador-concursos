import { beforeEach, describe, expect, it, vi } from "vitest";
const calls=vi.hoisted(()=>({download:vi.fn(),monitor:vi.fn(),catalog:vi.fn()}));
vi.mock("../../lib/official-import/workflow",()=>({discoverOfficialImport:vi.fn(),dryRunJob:vi.fn(),downloadSelectedDocuments:calls.download,extractDocuments:vi.fn(),validateExamArtifact:vi.fn()}));
vi.mock("../../lib/official-import/review-import",()=>({importJobForReview:vi.fn()}));
vi.mock("../../lib/monitoring/service",()=>({executeMonitor:calls.monitor}));
vi.mock("../../lib/catalog-sync/service",()=>({syncCatalogSource:calls.catalog}));
import { WorkerJobProcessor } from "../../worker/processor";

const cuid="cm12345678901234567890123";
function job(name:string,data:unknown){return{name,data,id:"bull-1",progress:0,updateProgress:vi.fn()} as never;}
describe("processadores do worker",()=>{
  const update=vi.fn(); const prisma={importJob:{findUnique:vi.fn().mockResolvedValue({adminUserId:cuid}),update},sourceMonitor:{findMany:vi.fn()},catalogSource:{findMany:vi.fn()}} as never;
  const processor=new WorkerJobProcessor(prisma,{enqueue:vi.fn()} as never);
  beforeEach(()=>{vi.clearAllMocks();update.mockResolvedValue({});});
  it("processa etapa de ImportJob e persiste progresso",async()=>{await processor.process(job("OFFICIAL_IMPORT_DOWNLOAD",{version:1,importJobId:cuid}));expect(calls.download).toHaveBeenCalled();expect(update).toHaveBeenCalledWith(expect.objectContaining({data:{report:expect.objectContaining({queueStatus:"COMPLETED"})}}));});
  it("processa monitor por ID",async()=>{await processor.process(job("MONITOR_SINGLE_SOURCE",{version:1,sourceMonitorId:cuid,scheduledAt:new Date().toISOString()}));expect(calls.monitor).toHaveBeenCalledWith(prisma,cuid,{manual:true});});
  it("processa catálogo por ID",async()=>{await processor.process(job("CATALOG_SYNC_SOURCE",{version:1,catalogSourceId:cuid,scheduledAt:new Date().toISOString()}));expect(calls.catalog).toHaveBeenCalledWith(prisma,cuid,{dryRun:undefined});});
});
