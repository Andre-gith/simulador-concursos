# Petrobras

Catálogo editorial em preparação.

Nenhum template de concurso foi criado porque ainda não há, neste projeto,
documentos oficiais suficientes para confirmar edição, ano, cargo, ênfase,
banca, caderno, regra de pontuação, prova e gabarito.

Antes de criar um arquivo de importação:

1. obtenha localmente o PDF oficial da prova e o PDF oficial do gabarito;
2. confirme os metadados no edital ou na página oficial;
3. copie o formato documentado em `data/README.md`;
4. mantenha `reviewStatus` como `IN_REVIEW`;
5. valide com `npm run import:exam -- arquivo.json --dry-run`;
6. submeta todas as questões à revisão humana antes de qualquer publicação.

Não inserir questões, respostas, URLs, edições ou ênfases por estimativa.
