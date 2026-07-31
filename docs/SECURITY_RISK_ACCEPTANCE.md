# Aceite técnico de risco residual de segurança

Data: 2026-07-30

Projeto: Nota de Banca

Versão avaliada do Next.js: 15.5.22

## Decisão

O risco descrito neste documento é aceito temporariamente para o primeiro deploy controlado. O aceite não elimina a obrigação de corrigir as dependências quando houver uma atualização compatível, nem autoriza reduzir os controles de segurança existentes.

## Resultado das auditorias

O `npm audit` completo encontrou 18 ocorrências agregadas: 1 crítica, 13 altas e 4 moderadas. A ocorrência crítica e parte das altas/moderadas estão restritas às ferramentas de desenvolvimento, principalmente Vitest, Vite, esbuild, ESLint, minimatch e brace-expansion. Essas ferramentas não são instaladas nos estágios finais das imagens.

O `npm audit --omit=dev` encontrou 4 ocorrências no conjunto de runtime: 3 altas e 1 moderada. A cadeia afetada é transitiva:

- `next@15.5.22` inclui versões sinalizadas de `postcss` e `sharp`;
- `next-auth` é reportado por depender da faixa afetada do Next.js;
- o PostCSS é sinalizado por riscos ligados à serialização de CSS e carregamento de source maps;
- o Sharp é sinalizado por vulnerabilidades herdadas do libvips.

Na data desta avaliação, o npm não oferece correção compatível e não disruptiva. A sugestão automática substituiria o Next.js por uma versão antiga e incompatível, constituindo alteração major/regressiva.

## Justificativa para não aplicar a correção automática

`npm audit fix --force` não será executado porque pode alterar versões major, quebrar contratos do framework, remover correções de segurança posteriores e invalidar toda a validação funcional e operacional já realizada.

Também não será feito downgrade do Next.js. O downgrade sugerido pelo audit é incompatível com a aplicação atual, ampliaria a superfície de vulnerabilidades conhecidas e exigiria reimplementação e nova homologação completa.

## Aplicabilidade e controles compensatórios

Os seguintes controles reduzem a aplicabilidade e o impacto dos avisos:

- otimização de imagens do Next.js desabilitada;
- a aplicação não processa CSS nem source maps enviados por usuários;
- containers Web e Worker separados e executados como usuários não root;
- filesystem das imagens verificado sem segredos, PDFs reais, `exam.json` ou metadados Git;
- storage privado, com acesso anônimo negado;
- Content Security Policy e demais cabeçalhos de segurança;
- rate limiting distribuído em produção;
- logs estruturados e sanitizados;
- jobs longos isolados no Worker;
- Redis autenticado e PostgreSQL isolado;
- endpoints de health e readiness;
- dependências de desenvolvimento ausentes dos estágios finais;
- Vitest, Vite UI e servidores de desenvolvimento ausentes do runtime.

## Prazo e condições de revisão

Este aceite é temporário e deve ser revisado periodicamente. É obrigatória a atualização para o primeiro patch compatível que corrija as dependências afetadas, seguida da repetição dos testes, builds, auditorias e gate de containers.

Uma nova auditoria é obrigatória antes de qualquer atualização relevante de framework, autenticação, processamento de arquivos, imagens ou infraestrutura. Caso seja identificada exploração aplicável ao uso real da aplicação, o rollback ou a suspensão da versão afetada é obrigatório até que exista mitigação validada.

Este documento não contém credenciais, URLs privadas, dados de conexão ou valores reais de variáveis de ambiente.
