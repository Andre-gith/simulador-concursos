# Checklist de produção

- [ ] Backup e restore testado
- [ ] `npm ci`, Prisma validate/generate, TypeScript, testes e build aprovados
- [ ] `npm audit` revisado
- [ ] `npm run production:check` sem erros
- [ ] `prisma migrate deploy` e status aprovados
- [ ] HTTPS e headers conferidos
- [ ] AUTH URLs/segredo e cookies seguros conferidos
- [ ] Bucket privado, Redis e worker/fila ativos
- [ ] Segredos de cron distintos e rotacionáveis
- [ ] Nenhum PDF, dump, `.env`, usuário real ou temporário no Git
- [ ] Health e readiness aprovados
- [ ] Rotas públicas e administrativas testadas
- [ ] Cron ainda desativado durante smoke inicial
- [ ] Plano de rollback e responsáveis definidos
