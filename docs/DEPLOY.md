# Deploy

## Requisitos

- Node.js 20 ou superior, domínio HTTPS e PostgreSQL compatível;
- object storage privado S3-compatible;
- Redis para rate limiting distribuído;
- worker/fila real para operações longas;
- agendador capaz de enviar `POST` com Bearer token.

## Ordem

1. Faça backup e revise `PRODUCTION_CHECKLIST.md`.
2. Crie banco, bucket privado, Redis e worker.
3. Configure as variáveis descritas em `ENVIRONMENT.md`.
4. Execute `npm ci`, `npm run production:check -- --env-file=<arquivo>` e `npx prisma migrate deploy`.
5. Execute `npm run build` e publique o artefato imutável.
6. Valide `/api/health` e `/api/health/ready`.
7. Configure os crons conforme `CRON.md`.
8. Faça smoke tests sem publicar conteúdo.

O deploy não deve executar seed, `prisma db push`, `migrate reset`, migração de storage ou scripts editoriais.

## Jobs longos

Download, extração, geração, monitoramento, sincronização e migração de arquivos podem exceder timeouts HTTP. Em produção, `JOB_EXECUTOR=queue` é obrigatório. O adaptador de fila ainda deve ser ligado à infraestrutura escolhida; até isso ocorrer, o executor de produção falha de forma explícita.
