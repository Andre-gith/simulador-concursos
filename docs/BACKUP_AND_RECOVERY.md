# Backup e recuperação

- PostgreSQL: backup diário, retenção mínima de 30 dias e cópia semanal isolada.
- Object storage: versionamento, criptografia, proteção contra exclusão e inventário periódico.
- Teste restauração completa ao menos trimestralmente em ambiente isolado.

## Recuperação

1. interrompa jobs e escrita;
2. identifique o último backup consistente;
3. restaure banco e objetos em recursos novos;
4. valide migrations, contagens, relações de `ImportJob` e SHA-256 dos documentos;
5. rode health/readiness e smoke tests;
6. altere o tráfego somente após aprovação.

Um `ImportJob` depende do banco e dos objetos referenciados por `localPath`; restaure ambos para o mesmo ponto lógico. Nunca teste restore usando host/bucket de produção como destino.
