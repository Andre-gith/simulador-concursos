# Primeiro deploy controlado no Render

Este documento descreve a configuração inicial, mas não autoriza nem executa o deploy. O Blueprint em `render.yaml` mantém o auto-deploy desligado e não cria Cron Jobs.

## Arquitetura inicial

O Blueprint declara quatro recursos na região `oregon`:

- `nota-de-banca-web`: Web Service Docker, inicialmente no plano free;
- `nota-de-banca-worker`: Background Worker Docker no plano starter;
- `nota-de-banca-redis`: Render Key Value free, acessível apenas pela rede privada;
- `nota-de-banca-postgres`: PostgreSQL 16 free, sem acesso externo.

O plano free serve somente para a primeira validação controlada. Web Services free podem suspender por inatividade. PostgreSQL free não possui backups e tem disponibilidade limitada. Key Value free não persiste dados e perde filas em reinícios ou upgrades. Antes de uso público, PostgreSQL e Key Value devem migrar para planos pagos com backup/persistência adequados.

## Variáveis

O Render preenche automaticamente `DATABASE_URL` e `DIRECT_URL` com a conexão privada do PostgreSQL e `REDIS_URL` com a conexão privada do Key Value.

O Blueprint fixa apenas valores não secretos:

```text
NODE_ENV=production
AI_PROVIDER=disabled
JOB_EXECUTOR=queue
QUEUE_PREFIX=nota-de-banca
WORKER_CONCURRENCY=1
RATE_LIMIT_PROVIDER=redis
STORAGE_PROVIDER=s3
```

As variáveis abaixo usam `sync: false` e devem ser preenchidas manualmente no fluxo inicial do Blueprint, sem serem gravadas no Git:

```text
AUTH_SECRET
AUTH_URL
NEXT_PUBLIC_APP_URL
MONITOR_CRON_SECRET
CATALOG_SYNC_SECRET
STORAGE_BUCKET
STORAGE_REGION
STORAGE_ENDPOINT
STORAGE_ACCESS_KEY_ID
STORAGE_SECRET_ACCESS_KEY
STORAGE_FORCE_PATH_STYLE
STORAGE_PREFIX
APP_VERSION
```

`AUTH_URL` e `NEXT_PUBLIC_APP_URL` devem usar a URL HTTPS definitiva do Web Service. Não reutilize segredos de desenvolvimento.

## Ordem controlada e migrations

O Prisma CLI 6.19.3 é uma dependência de runtime da imagem do Worker. O Worker pago suporta:

```text
preDeployCommand: npx prisma migrate deploy
```

O comando roda em uma instância separada antes que a nova versão do Worker seja ativada e usa o `DATABASE_URL` privado. Nunca usar `prisma db push`, `prisma migrate reset` ou seed no deploy.

Para o primeiro deploy:

1. revisar o Blueprint no painel sem sincronizá-lo automaticamente;
2. preencher todas as variáveis marcadas como manuais;
3. confirmar que PostgreSQL e Key Value estão disponíveis;
4. implantar primeiro o Worker e conferir o sucesso de `npx prisma migrate deploy`;
5. conferir a migration baseline na tela de eventos/logs;
6. somente então implantar o Web manualmente;
7. validar `/api/health`, `/api/health/ready`, login e um job sintético.

O Web permanece free e, por isso, não recebe `preDeployCommand`. A migration pertence somente ao Worker para evitar duas execuções concorrentes.

## Deploy gratuito de demonstração

Para uma demonstração sem cobrança, selecione explicitamente **Blueprint Path `render.demo.yaml`**. Não use `render.yaml`, pois o Blueprint completo contém um Background Worker pago.

O Blueprint de demonstração cria somente:

- `nota-de-banca-demo-web`, Web Docker free;
- `nota-de-banca-demo-postgres`, PostgreSQL 16 free.

Não são criados Worker, Redis/Key Value ou Cron Jobs. `DEPLOYMENT_MODE=demo`, `JOB_EXECUTOR=disabled`, `AI_PROVIDER=disabled` e `RATE_LIMIT_PROVIDER=memory` são fixos. Login, registro, simulados, resultados, histórico e administração básica permanecem disponíveis. Importações, downloads/extratos automáticos, geração de `exam.json`, dry-run, monitoramento e sincronização de catálogo retornam indisponibilidade controlada e não iniciam trabalhos.

Web e PostgreSQL gratuitos possuem limitações. O site pode entrar em repouso e a primeira resposta pode ser lenta. O banco gratuito não é indicado para dados críticos nem substitui backups. Rate limiting em memória é aceitável apenas para esta única instância e não serve para escala horizontal.

O container demo executa, nessa ordem:

1. validação explícita das variáveis do modo demo;
2. `prisma migrate deploy`, idempotente e compatível com PostgreSQL vazio;
3. `node server.js`.

Falha de configuração ou migration impede o servidor de iniciar. O fluxo não usa `db push`, reset ou seed e não modifica o startup de `Dockerfile.web`.

Storage definitivo deve permanecer externo e privado. Sem credenciais S3 completas, páginas que não dependem de arquivos podem iniciar, mas readiness e rotas de artefatos indicam storage indisponível. Consulte `docs/VISUAL_ASSETS_DEMO_AUDIT.md` antes de demonstrar questões visuais.

Variáveis manuais do Blueprint demo:

```text
AUTH_SECRET
AUTH_URL
NEXT_PUBLIC_APP_URL
STORAGE_BUCKET
STORAGE_REGION
STORAGE_ENDPOINT
STORAGE_ACCESS_KEY_ID
STORAGE_SECRET_ACCESS_KEY
STORAGE_FORCE_PATH_STYLE
APP_VERSION
```

Nenhuma credencial deve ser adicionada ao YAML ou ao Git.

### Migração futura para a arquitetura completa

```text
render.demo.yaml
        ↓
render.yaml
```

Ao migrar, configure Redis, crie o Worker, troque para `DEPLOYMENT_MODE=full`, `JOB_EXECUTOR=queue` e `RATE_LIMIT_PROVIDER=redis`, configure os segredos dos crons, valide o storage privado e execute `npm run production:check` novamente. As migrations voltam a ser responsabilidade exclusiva do pre-deploy do Worker.

## Porta e encerramento

`Dockerfile.web` define `HOSTNAME=0.0.0.0` e aceita `PORT` fornecida pelo Render, substituindo o valor padrão `3000`. O Web possui health check em `/api/health`.

O Worker processa `SIGTERM`, tem concorrência inicial 1 e recebe até 300 segundos para finalizar um job antes de encerramento forçado.

## Supabase Storage privado

O provider atual usa AWS SDK v3 com endpoint, região, path style e credenciais configuráveis. Ele usa as operações S3 necessárias (`PutObject`, `GetObject`, `HeadObject` e `DeleteObject`) e URLs pré-assinadas com AWS Signature V4, compatíveis com o endpoint S3 do Supabase Storage.

Configuração manual:

```text
STORAGE_PROVIDER=s3
STORAGE_BUCKET=
STORAGE_REGION=
STORAGE_ENDPOINT=
STORAGE_ACCESS_KEY_ID=
STORAGE_SECRET_ACCESS_KEY=
STORAGE_FORCE_PATH_STYLE=true
STORAGE_PREFIX=production
```

O endpoint e a região devem ser copiados da configuração S3 do projeto Supabase. Use o hostname direto de Storage e mantenha as access keys exclusivamente no servidor. Essas chaves têm acesso amplo e não podem usar prefixo `NEXT_PUBLIC_`.

O bucket deve permanecer privado. O provider não define ACL pública; downloads passam pelo servidor ou por URLs assinadas curtas, limitadas pelo código a no máximo 900 segundos. A criação do bucket e das chaves deve ocorrer manualmente fora desta etapa.

## Cron Jobs posteriores

Não incluir Cron Jobs no primeiro Blueprint. Depois que migrations, Web, Worker, Redis, storage, login e job sintético estiverem aprovados, criar separadamente:

```yaml
# Monitor — ativação posterior
type: cron
runtime: docker
dockerfilePath: ./Dockerfile.worker
dockerContext: .
dockerCommand: node dist/cron/monitor.js

# Catálogo — ativação posterior
type: cron
runtime: docker
dockerfilePath: ./Dockerfile.worker
dockerContext: .
dockerCommand: node dist/cron/catalog.js
```

Defina os schedules e confirme novamente as variáveis antes da ativação. Não execute os crons para testar a criação dos recursos.

## Checklist antes de acionar o Blueprint

- revisar custos e substituir planos free dos datastores;
- confirmar branch e commit;
- preencher todas as variáveis `sync: false`;
- manter acesso externo de PostgreSQL e Key Value bloqueado;
- confirmar bucket privado e credenciais server-side;
- conferir migration baseline e ausência de comandos destrutivos;
- validar CSP de produção, login e quebra dos cards;
- acionar Worker/migration antes do Web;
- manter `autoDeploy: false`;
- não ativar os Cron Jobs.
