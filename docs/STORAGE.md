# Armazenamento privado

`PrivateStorageProvider` oferece `put`, `get`, `getStream`, `exists`, exclusão autorizada, URL assinada, metadados e SHA-256.

- `local`: desenvolvimento/testes, compatível com `data/imports`;
- `s3`: produção, bucket privado e URLs assinadas curtas quando necessárias.

O bucket não deve permitir leitura pública. Use credencial restrita ao prefixo configurado, criptografia em repouso, versionamento e lifecycle compatível com a retenção.

## Migração

Auditoria sem transferência:

```sh
npm run storage:migrate -- --dry-run --all
npm run storage:migrate -- --dry-run --job-id=<id>
```

Transferência autorizada, somente após backup e configuração S3:

```sh
npm run storage:migrate -- --all
```

O comando lista referências no banco, calcula hash, envia apenas ausentes/diferentes, valida o destino e nunca apaga o arquivo local. É idempotente.
