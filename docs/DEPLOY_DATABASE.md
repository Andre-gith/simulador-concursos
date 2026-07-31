# Banco de dados em produção

## Antes de qualquer alteração

Crie backup consistente do PostgreSQL, registre horário/versão e teste a restauração em banco isolado. Nunca restaure sobre produção sem conferir host, database e usuário.

## Banco novo

Use uma URL administrativa direta durante a etapa de migration e execute:

```sh
npx prisma migrate deploy
npx prisma migrate status
```

A migration `20260729000100_production_baseline` cria o schema completo atual em banco vazio.

## Banco existente compatível

O banco local recebeu quatro SQLs aditivos manualmente. Antes de adotar o baseline:

1. faça backup;
2. execute `npx prisma migrate diff --from-schema-datasource prisma/schema.prisma --to-schema-datamodel prisma/schema.prisma`;
3. exija `No difference detected`;
4. revise o SQL do baseline;
5. somente então registre o baseline com `npx prisma migrate resolve --applied 20260729000100_production_baseline`;
6. confira `npx prisma migrate status`.

`migrate resolve` não aplica SQL: apenas registra que um banco comprovadamente equivalente já contém o baseline. Não execute essa etapa automaticamente nem em banco divergente.

## Conexões

`DATABASE_URL` pode apontar para pool do runtime. `DIRECT_URL` deve ser reservada ao processo operacional de migration quando o provedor exigir conexão direta; passe-a como `DATABASE_URL` nesse processo ou adote configuração específica após escolher o provedor.

## Rollback operacional

Prisma não gera rollback destrutivo automático. Em falha: interrompa tráfego/jobs, preserve logs, restaure o backup em instância nova, valide contagens e checksums e troque a conexão. Nunca use `migrate reset`.
