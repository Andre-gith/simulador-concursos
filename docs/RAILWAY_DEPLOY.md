# Railway — arquitetura do MVP

Nenhum recurso Railway é criado automaticamente por este repositório.

## Serviços

1. `nota-de-banca-web`: `Dockerfile.web`.
2. `nota-de-banca-worker`: `Dockerfile.worker`, comando `npm run worker:start`.
3. `nota-de-banca-monitor-cron`: imagem do worker, comando `npm run cron:monitor`.
4. `nota-de-banca-catalog-cron`: imagem do worker, comando `npm run cron:catalog`.
5. PostgreSQL.
6. Redis via private networking.
7. Storage Bucket privado S3-compatible.

## Configuração

Web e worker recebem `DATABASE_URL`, `REDIS_URL`, `QUEUE_PREFIX`, storage S3 e `APP_VERSION`. Web recebe Auth, URLs públicas e segredos dos endpoints internos. Worker recebe `JOB_EXECUTOR=queue`, `WORKER_CONCURRENCY=1`, timeout e lock duration. Crons recebem banco, Redis, prefixo e `JOB_EXECUTOR=queue`; não precisam dos segredos HTTP.

Mapeie o bucket Railway para `STORAGE_BUCKET`, `STORAGE_REGION`, `STORAGE_ENDPOINT`, `STORAGE_ACCESS_KEY_ID`, `STORAGE_SECRET_ACCESS_KEY` e `STORAGE_FORCE_PATH_STYLE`. O provider não envia ACL pública e gera URLs assinadas curtas.

## Ordem

1. PostgreSQL, Redis e bucket.
2. Backup/baseline e `prisma migrate deploy` em job operacional único.
3. Worker.
4. Web; health `/api/health`, readiness `/api/health/ready`.
5. Crons inicialmente desativados.
6. Smoke autenticado e validação da fila.
7. Ativação gradual dos crons.

Use HTTPS público apenas no web e private networking para banco/Redis. Em rollback, pause crons e worker, reverta web/worker em conjunto e preserve banco, Redis e objetos. Nunca use reset.
