import { jobExecutor } from "../lib/job-executor"; import { enqueueDueCatalogSources } from "../lib/jobs/schedulers"; import { prisma } from "../lib/prisma";
async function main(){const executor=jobExecutor({...process.env,JOB_EXECUTOR:"queue"});try{const jobs=await enqueueDueCatalogSources(prisma,executor);console.log(JSON.stringify({queued:jobs.length,duplicates:jobs.filter(j=>j.duplicated).length}));}finally{await executor.close();await prisma.$disconnect();}}
main().catch((error)=>{console.error(error instanceof Error?error.message:"Falha ao enfileirar catálogo.");process.exitCode=1;});
