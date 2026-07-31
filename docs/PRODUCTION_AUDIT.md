# Auditoria de produção

## Corrigidos

- **BLOQUEADOR:** filesystem efêmero como única leitura de arquivos privados. Criada abstração local/S3 e rotas privadas migradas.
- **BLOQUEADOR:** ausência de validação central das dependências de produção. Criado `production:check`.
- **ALTO:** ausência de rate limit distribuível. Criadas implementações memória/Redis e proteção de login, registro e crons.
- **ALTO:** jobs longos sem bloqueio explícito em produção. Criada interface de executor; produção exige fila real.
- **ALTO:** ausência de migrations reproduzíveis. Criado baseline para banco vazio e processo documentado para banco existente.
- **ALTO:** headers e readiness ausentes. Adicionados headers, health e readiness sanitizados.

## Riscos restantes

- **MITIGADO:** `npm audit` aponta PostCSS/Sharp transitivos no Next 15.5.22. Não há patch 15 posterior; CSS não é fornecido por usuários e o otimizador Sharp foi desabilitado. Reavaliar a cada patch.
- **CORRIGIDO:** BullMQ/Redis implementado com worker separado, contratos versionados, idempotência e shutdown gracioso.
- **INFORMATIVO:** a vulnerabilidade crítica restante é do Vitest/Vite UI, dependência exclusiva de desenvolvimento; não execute servidor de testes em produção. A correção disponível exige major do Vitest.
- **INFORMATIVO:** alertas de ESLint/minimatch são exclusivos de desenvolvimento e a correção exige major.
- **MÉDIO:** CSP ainda usa `unsafe-inline` para compatibilidade com Next.js; remover exige nonce/testes de renderização.
- **MÉDIO:** escrita interna dos pipelines legados continua usando paths locais antes da persistência definitiva; o worker deve gravar por `PrivateStorageProvider` ao ser implementado.
- **MÉDIO:** algumas consultas administrativas e sincronizações percorrem conjuntos amplos; monitorar duração e paginar conforme volume real.
- **BAIXO:** `DIRECT_URL` é operacional e não está ligada ao schema para manter compatibilidade local; definir estratégia após escolher PostgreSQL gerenciado.

Não foram encontrados fallbacks de segredo apropriados para produção. Erros das novas rotas não expõem stack, conexão ou credenciais.
