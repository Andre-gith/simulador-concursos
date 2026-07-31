-- Complemento aditivo da Fase 1. Não altera nem remove dados anteriores.
CREATE TYPE "ImportDestinationType" AS ENUM ('NEW_CONTEST', 'EDITORIAL_ENTRY', 'EXISTING_CONTEST_NEW_PAPER', 'CANCELLED');

ALTER TABLE "ImportJob"
  ADD COLUMN "cancelledAt" TIMESTAMP(3),
  ADD COLUMN "destinationType" "ImportDestinationType",
  ADD COLUMN "destinationEditorialEntryId" TEXT,
  ADD COLUMN "destinationContestId" TEXT,
  ADD COLUMN "importResult" JSONB;

ALTER TABLE "SourceDocument"
  ADD COLUMN "description" TEXT,
  ADD COLUMN "paperCode" TEXT,
  ADD COLUMN "displayOrder" INTEGER NOT NULL DEFAULT 0;

CREATE INDEX "ImportJob_destinationContestId_idx" ON "ImportJob"("destinationContestId");
CREATE INDEX "ImportJob_destinationEditorialEntryId_idx" ON "ImportJob"("destinationEditorialEntryId");
CREATE INDEX "SourceDocument_importJobId_displayOrder_idx" ON "SourceDocument"("importJobId", "displayOrder");

ALTER TABLE "ImportJob"
  ADD CONSTRAINT "ImportJob_destinationContestId_fkey"
  FOREIGN KEY ("destinationContestId") REFERENCES "Concurso"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "ImportJob"
  ADD CONSTRAINT "ImportJob_destinationEditorialEntryId_fkey"
  FOREIGN KEY ("destinationEditorialEntryId") REFERENCES "EditorialCatalogEntry"("id") ON DELETE SET NULL ON UPDATE CASCADE;
