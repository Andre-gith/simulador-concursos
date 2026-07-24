# Catálogo do Nota de Banca

## Instituição e banca

Instituição é o órgão responsável pelo concurso. Banca é a organizadora da
prova. São informações independentes e só devem ser associadas quando houver
confirmação documental.

## Dois tipos de registro

### Concurso

Representa uma prova suficientemente identificada para possuir regra, caderno,
blocos, questões e simulados.

### Entrada editorial

`EditorialCatalogEntry` registra oportunidades ainda sem ano, edição ou banca
confirmados. Não possui relação com questões e não pode iniciar simulados.

Essa separação evita preencher campos obrigatórios com valores fictícios.

## Disponibilidade

Um concurso aparece como disponível somente se:

1. está `PUBLISHED`;
2. possui regra de pontuação;
3. possui pelo menos uma questão `PUBLISHED`.

Qualquer outro registro aparece em preparação e não oferece ação para iniciar
uma tentativa.

## Seed editorial

```bash
npm run catalog:seed
```

O seed:

- usa uma chave editorial única e estável;
- pode ser executado repetidamente;
- não duplica entradas;
- não cria questões;
- não apaga registros;
- não rebaixa registros publicados ou arquivados;
- informa criados, atualizados e ignorados.

O catálogo local contém entradas de Banco do Brasil, Caixa Econômica Federal,
Dataprev, Transpetro e uma representação editorial da Petrobras. Dados não
confirmados permanecem nulos ou identificados como pendentes.

## Estados editoriais

- `DRAFT`: rascunho;
- `IN_REVIEW`: em revisão humana;
- `PUBLISHED`: liberado quando todos os critérios forem satisfeitos;
- `ARCHIVED`: preservado, mas fora do catálogo ativo.

Não existe exclusão destrutiva pelo painel.
