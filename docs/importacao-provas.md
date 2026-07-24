# Importação de provas

## Fontes permitidas

Trabalhe somente com PDFs oficiais fornecidos pelo administrador ou arquivos
locais cuja utilização tenha sido autorizada. O projeto não faz scraping nem
download automático.

## Importação JSON

Cada JSON representa um caderno e segue o schema versão 1 documentado em
`data/README.md`.

Campos centrais:

- concurso, banca, instituição, edição, ano, cargo e especialidade;
- caderno, URLs e data de aplicação;
- regra de pontuação;
- blocos e mínimos;
- matérias e assuntos;
- questões, pesos, fontes, páginas e gabaritos.

Antes de gravar:

```bash
npm run import:exam -- caminho/prova.json --dry-run
```

Depois da revisão:

```bash
npm run import:exam -- caminho/prova.json
```

A importação real usa transação e grava concurso e questões como `IN_REVIEW`.

## Templates

Os arquivos em `data/**/*.template.json` contêm somente metadados confirmados
e marcadores `null` para pendências. Eles não contêm questões nem gabaritos.

O importador recusa o sufixo `.template.json`. Fluxo correto:

1. copiar o template;
2. conferir prova, gabarito, edital e página oficial;
3. preencher todos os campos obrigatórios;
4. salvar com outro nome terminado em `.json`;
5. executar o `--dry-run`;
6. corrigir todos os erros;
7. importar;
8. revisar cada questão no painel.

## Validações

- peso finito e positivo;
- número único no caderno;
- letras únicas;
- uma alternativa correta em MC;
- `ceAnswer` obrigatório em CE;
- matérias, assuntos e blocos declarados;
- regra de pontuação completa;
- fonte e página;
- `reviewStatus` igual a `IN_REVIEW`.

Nenhuma falha deixa gravação parcial.
