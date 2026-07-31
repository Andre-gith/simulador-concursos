# Auditoria de dependências

Data da análise: 2026-07-29.

## Relatório completo

`npm audit --json`: 18 ocorrências — 1 crítica, 13 altas e 4 moderadas. A crítica (`vitest`) e as cadeias Vite/ESLint são ferramentas de desenvolvimento. Elas não são instaladas no estágio final das imagens.

## Runtime (`npm audit --omit=dev`)

Quatro ocorrências: Next.js (alta), PostCSS transitivo (alta), Sharp opcional (alta) e NextAuth afetado pela cadeia do Next (moderada). Não há crítica no conjunto de produção.

- Next.js está no patch estável mais recente da linha 15.5 disponível no registry: `15.5.22`. Não há patch 15 compatível posterior.
- Next inclui `postcss@8.4.31`; a versão atual é `8.5.25`. O override seria fora da versão testada/pinada pelo framework e não foi aplicado.
- Next aceita opcionalmente `sharp@^0.34.3`; está instalado `0.34.5`. A correção indicada é `0.35.3`, fora do range aceito pelo Next, então não foi forçada.
- A otimização de imagens foi desabilitada (`images.unoptimized=true`), evitando processamento de imagens potencialmente controladas pelo Sharp.
- O PostCSS é usado no build, não recebe CSS ou source maps enviados por usuários em runtime.

## Classificação

- Somente desenvolvimento: Vitest, Vite, esbuild da cadeia de teste, ESLint, minimatch e brace-expansion.
- Runtime, mitigado: Sharp/libvips, pois o otimizador está desabilitado.
- Runtime, não alcançável por entrada da aplicação: PostCSS interno, pois não há compilação de CSS fornecido por usuário.
- Atualização compatível aplicada: Next 15.5.22 e Auth.js beta 32.
- Exige major ou override incompatível: correções sugeridas para Vitest/ESLint e substituição interna de PostCSS/Sharp.

Gate: nenhuma crítica explorável no runtime; alertas altos possuem mitigação e devem ser reavaliados a cada patch do Next 15.
