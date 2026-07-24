# Pipeline de importação assistida por IA

## Objetivo

Transformar PDFs oficiais em uma sugestão estruturada, sem delegar à IA a
decisão de validade ou publicação.

## Etapas

1. um administrador autenticado envia prova e gabarito;
2. o servidor valida que ambos são PDFs e limita cada arquivo a 20 MB;
3. os arquivos são armazenados localmente em `data/imports/<id>/`;
4. `pdf-parse` extrai texto com marcadores de página;
5. o sistema grava `intermediario.json`;
6. o provider configurado recebe textos e metadados;
7. a resposta precisa ser JSON válido;
8. o servidor força fontes e status;
9. o schema determinístico valida todo o documento;
10. uma transação Prisma serializável grava o conteúdo como `IN_REVIEW`;
11. o administrador revisa cada questão;
12. publicação exige todos os critérios editoriais.

## Componentes

- `src/lib/import/pdf-extractor.ts`: extração local;
- `src/lib/ai/exam-extractor.ts`: interface substituível do provider;
- `src/lib/ai/providers/anthropic.ts`: provider Anthropic;
- `src/lib/import/exam-schema.ts`: contrato determinístico;
- `src/lib/import/import-service.ts`: validação e persistência atômica;
- `src/lib/import/pdf-import-workflow.ts`: orquestração e intermediários.

## Configuração

```env
ANTHROPIC_API_KEY
ANTHROPIC_MODEL
```

Sem as duas variáveis, o sistema não chama a IA. Ele mantém os PDFs e o texto
intermediário e apresenta essa limitação claramente no painel.

## Limites de confiança

A IA pode sugerir metadados, matérias, assuntos, blocos, enunciados,
alternativas, respostas, pesos e páginas. Essas sugestões não são consideradas
verdadeiras até passarem pelo schema e pela revisão humana.

O servidor controla:

- status `IN_REVIEW`;
- referências dos PDFs;
- consistência entre blocos, matérias e assuntos;
- formato de gabarito;
- pesos;
- duplicações;
- transação;
- critérios de publicação.

## Limitações

- não há OCR;
- PDFs sem camada textual são recusados;
- não há processamento em fila;
- armazenamento local não é adequado para múltiplas instâncias;
- chamadas de IA dependem de conectividade, limites e custos do provider;
- nenhuma publicação é automática.
