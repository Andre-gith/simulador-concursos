# Cron jobs

Os endpoints aceitam somente `POST` com `Authorization: Bearer <segredo>`, usam segredo independente, rate limit, lock persistente e processam apenas fontes vencidas.

```text
POST https://<dominio>/api/internal/monitor-sources
Authorization: Bearer <MONITOR_CRON_SECRET>

POST https://<dominio>/api/internal/catalog-sync
Authorization: Bearer <CATALOG_SYNC_SECRET>
```

Agende monitoramento diariamente e catálogo diariamente ou semanalmente. Não coloque segredos em URL, logs ou arquivos versionados. Configure timeout de até 60 segundos e trate 401, 429 e 5xx sem repetição agressiva.

Na Railway, prefira `npm run cron:monitor` e `npm run cron:catalog`: eles consultam o PostgreSQL, enfileiram apenas IDs no BullMQ e terminam. Os endpoints HTTP continuam disponíveis e, com `JOB_EXECUTOR=queue`, também apenas enfileiram.
