# Ambientes e variáveis

Desenvolvimento usa storage local, rate limit em memória e executor inline. Testes usam providers isolados/mocks. Produção exige HTTPS, S3 privado, Redis e worker/fila.

Obrigatórias em produção:

- `DATABASE_URL`, `AUTH_SECRET`, `AUTH_URL`, `NEXT_PUBLIC_APP_URL`;
- `MONITOR_CRON_SECRET`, `CATALOG_SYNC_SECRET`;
- `STORAGE_PROVIDER=s3` e todas as credenciais `STORAGE_*`;
- `RATE_LIMIT_PROVIDER=redis`, `REDIS_URL`;
- `JOB_EXECUTOR=queue`, `QUEUE_PREFIX`, `WORKER_CONCURRENCY`, timeout e lock do worker;
- `APP_VERSION`.

`DIRECT_URL` é recomendada para migrations em provedores com pool. IA permanece `disabled` até configuração deliberada. Nenhum segredo possui fallback de produção. Execute `npm run production:check` antes do build/deploy.
