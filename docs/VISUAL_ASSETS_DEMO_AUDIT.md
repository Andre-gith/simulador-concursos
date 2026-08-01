# Auditoria de recursos visuais para demonstração

Auditoria somente leitura realizada no banco local em 31/07/2026. Os arquivos reais continuam ignorados pelo Git e não fazem parte da imagem Docker.

## Registros encontrados

Foram encontrados 52 recursos visuais publicados:

- Banco do Brasil: 33 imagens, nas questões 18, 19, 26, 33, 36–38, 40, 41, 45, 48, 51, 55, 56, 58–60, 63–66 e 68–70;
- Dataprev: 2 imagens, confirmadas nas questões 119 e 120;
- Transpetro: 17 imagens, nas questões 11–14, 30, 32, 34, 35, 38, 41–43, 46, 50, 56, 57 e 60;
- Caixa: nenhum registro em `QuestionVisualAsset` no banco auditado.

Todos os 52 registros apontam atualmente para chaves sob `data/imports/...`; todos os arquivos existiam no workspace auditado. Como `data/` é excluído do contexto Docker e do Git, eles não estarão no Render por simples deploy.

## Migração necessária

As mesmas chaves registradas no banco devem ser enviadas ao bucket privado S3-compatible do Supabase. O prefixo configurado em `STORAGE_PREFIX` é acrescentado pelo provider e não deve ser gravado nos registros.

Auditoria segura, sem upload:

```powershell
npm run storage:migrate -- --visual-assets --dry-run
```

Upload futuro, deliberado, somente depois de configurar as credenciais S3 no ambiente:

```powershell
$env:STORAGE_PROVIDER="s3"
npm run storage:migrate -- --visual-assets
```

O segundo comando não foi executado. Ele calcula SHA-256, ignora objetos idênticos, envia os ausentes e verifica o hash remoto. Não altera concursos, questões ou caminhos no banco.

## Efeito da ausência

Sem o objeto no bucket, a questão e o simulado continuam acessíveis, mas a rota do recurso visual retorna indisponibilidade controlada. O conteúdo visual indispensável à resolução da questão não será exibido; por isso, a carga das 52 imagens é necessária antes de demonstrar esses itens.
