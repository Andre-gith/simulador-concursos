# Formato de importação de provas

Cada arquivo representa um caderno de prova de um concurso. O importador não
baixa arquivos e não faz scraping; URLs são apenas registradas.

## Comandos

```bash
npm run import:exam -- data/exemplo.json --dry-run
npm run import:exam -- data/exemplo.json
```

O `--dry-run` lê e valida todo o documento sem conectar para gravação.

## Estrutura

```json
{
  "schemaVersion": 1,
  "contentNotice": "Descrição clara da origem e natureza do conteúdo",
  "reviewStatus": "IN_REVIEW",
  "contest": {
    "board": "Nome da banca",
    "agency": "Órgão",
    "edition": "Edição opcional",
    "year": 2026,
    "position": "Cargo",
    "specialty": "Especialidade opcional",
    "educationLevel": "SUPERIOR",
    "officialPageUrl": "https://pagina-oficial.example/",
    "noticeUrl": "https://pagina-oficial.example/edital.pdf"
  },
  "paper": {
    "code": "CADERNO-001",
    "examUrl": "https://pagina-oficial.example/prova.pdf",
    "answerKeyUrl": "https://pagina-oficial.example/gabarito.pdf",
    "appliedAt": "2026-01-18T12:00:00-03:00"
  },
  "scoringRule": {
    "type": "MC_NO_PENALTY",
    "pointsCorrect": 1,
    "pointsWrong": 0,
    "pointsBlank": 0,
    "floorAtZero": true,
    "minimumTotalScore": 10,
    "minimumCorrect": 10
  },
  "blocks": [],
  "subjects": [],
  "questions": []
}
```

## Campos e regras

- `schemaVersion`: atualmente deve ser `1`.
- `contentNotice`: declaração obrigatória sobre origem/natureza do conteúdo.
- `reviewStatus`: deve ser `IN_REVIEW`; concursos e questões nunca são
  publicados automaticamente.
- `educationLevel`: `FUNDAMENTAL`, `MEDIO`, `TECNICO` ou `SUPERIOR`.
- `scoringRule.type`: `CE_PENALTY`, `MC_NO_PENALTY` ou `MC_NEGATIVE`.
- `minimumTotalScore` e `minimumCorrect`: opcionais.
- `blocks`: nomes únicos, ordem inteira e mínimos opcionais.
- `subjects`: nomes únicos; cada matéria declara seus assuntos.
- `questions.number`: número original, único dentro do caderno.
- `questions.type`: `CE` ou `MC`.
- `weight`: número finito maior que zero.
- Questão `CE`: exige `ceAnswer: true|false` e não aceita alternativas.
- Questão `MC`: exige ao menos duas alternativas, letras únicas sem distinção
  entre maiúsculas/minúsculas e exatamente uma `isCorrect: true`.
- `subject`, `topic` e `block` usados por questões devem estar declarados.
- `sourcePage` é a página original do PDF; `sourceUrl` é a URL oficial da
  fonte específica da questão.

Todos os objetos rejeitam campos desconhecidos para detectar erros de digitação.
Datas usam ISO 8601 com fuso horário. URLs precisam ser absolutas e válidas.

## Duplicações e reexecução

A identidade segura usada na importação é:

1. concurso: banca + órgão + cargo + ano + edição + especialidade;
2. caderno: concurso + `paper.code`;
3. questão: caderno + número original.

Ao executar novamente, o caderno, a regra, os blocos e as questões existentes
são atualizados. A transação impede estado parcial. Use códigos de caderno
estáveis e nunca reutilize um código para uma prova diferente.

O importador não remove questões ausentes do JSON. Essa decisão evita exclusões
acidentais em reimportações parciais.
