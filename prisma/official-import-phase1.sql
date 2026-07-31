CREATE TYPE "ImportJobStage" AS ENUM ('CREATED', 'DISCOVERING_DOCUMENTS', 'WAITING_DOCUMENT_SELECTION', 'DOWNLOADING', 'EXTRACTING', 'GENERATING_EXAM', 'VALIDATING', 'DRY_RUN_COMPLETE', 'WAITING_REVIEW', 'FAILED', 'COMPLETED');
CREATE TYPE "DocumentType" AS ENUM ('NOTICE', 'EXAM', 'ANSWER_KEY_PRELIMINARY', 'ANSWER_KEY_FINAL', 'RECTIFICATION', 'ANNULMENT_NOTICE', 'RESULT', 'OTHER');
CREATE TYPE "DocumentStatus" AS ENUM ('DISCOVERED', 'SELECTED', 'DOWNLOADED', 'VALIDATED', 'REJECTED', 'SUPERSEDED');
CREATE TYPE "ArtifactType" AS ENUM ('EXTRACTED_TEXT', 'MANIFEST', 'EXAM_JSON', 'DRY_RUN_REPORT', 'VISUAL_ASSET');

ALTER TABLE "ImportJob" DROP CONSTRAINT "ImportJob_concursoId_fkey";
ALTER TABLE "ImportJob"
  ADD COLUMN "adminNotes" TEXT,
  ADD COLUMN "adminUserId" TEXT,
  ADD COLUMN "board" TEXT,
  ADD COLUMN "edition" TEXT,
  ADD COLUMN "finishedAt" TIMESTAMP(3),
  ADD COLUMN "idempotencyKey" TEXT,
  ADD COLUMN "institution" TEXT,
  ADD COLUMN "officialUrl" TEXT,
  ADD COLUMN "paperCode" TEXT,
  ADD COLUMN "position" TEXT,
  ADD COLUMN "previousStage" "ImportJobStage",
  ADD COLUMN "report" JSONB,
  ADD COLUMN "specialty" TEXT,
  ADD COLUMN "stage" "ImportJobStage" NOT NULL DEFAULT 'CREATED',
  ADD COLUMN "startedAt" TIMESTAMP(3),
  ADD COLUMN "warnings" JSONB,
  ADD COLUMN "year" INTEGER,
  ALTER COLUMN "concursoId" DROP NOT NULL;

CREATE TABLE "SourceDocument" (
  "id" TEXT NOT NULL PRIMARY KEY, "importJobId" TEXT NOT NULL, "documentType" "DocumentType" NOT NULL,
  "sourceUrl" TEXT NOT NULL, "originalFilename" TEXT, "localPath" TEXT, "mimeType" TEXT, "sha256" TEXT,
  "size" INTEGER, "publishedAt" TIMESTAMP(3), "downloadedAt" TIMESTAMP(3), "version" INTEGER NOT NULL DEFAULT 1,
  "status" "DocumentStatus" NOT NULL DEFAULT 'DISCOVERED', "metadata" JSONB, "supersedesId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE "ImportArtifact" (
  "id" TEXT NOT NULL PRIMARY KEY, "importJobId" TEXT NOT NULL, "artifactType" "ArtifactType" NOT NULL,
  "localPath" TEXT NOT NULL, "sha256" TEXT NOT NULL, "metadata" JSONB, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE "ImportAuditEvent" (
  "id" TEXT NOT NULL PRIMARY KEY, "importJobId" TEXT NOT NULL, "adminUserId" TEXT, "action" TEXT NOT NULL,
  "details" JSONB, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX "SourceDocument_importJobId_status_idx" ON "SourceDocument"("importJobId", "status");
CREATE INDEX "SourceDocument_sha256_idx" ON "SourceDocument"("sha256");
CREATE UNIQUE INDEX "SourceDocument_importJobId_sourceUrl_documentType_version_key" ON "SourceDocument"("importJobId", "sourceUrl", "documentType", "version");
CREATE INDEX "ImportArtifact_importJobId_artifactType_idx" ON "ImportArtifact"("importJobId", "artifactType");
CREATE UNIQUE INDEX "ImportArtifact_importJobId_artifactType_sha256_key" ON "ImportArtifact"("importJobId", "artifactType", "sha256");
CREATE INDEX "ImportAuditEvent_importJobId_createdAt_idx" ON "ImportAuditEvent"("importJobId", "createdAt");
CREATE INDEX "ImportAuditEvent_adminUserId_idx" ON "ImportAuditEvent"("adminUserId");
CREATE UNIQUE INDEX "ImportJob_idempotencyKey_key" ON "ImportJob"("idempotencyKey");
CREATE INDEX "ImportJob_stage_idx" ON "ImportJob"("stage");
CREATE INDEX "ImportJob_adminUserId_idx" ON "ImportJob"("adminUserId");

ALTER TABLE "ImportJob" ADD CONSTRAINT "ImportJob_concursoId_fkey" FOREIGN KEY ("concursoId") REFERENCES "Concurso"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ImportJob" ADD CONSTRAINT "ImportJob_adminUserId_fkey" FOREIGN KEY ("adminUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "SourceDocument" ADD CONSTRAINT "SourceDocument_importJobId_fkey" FOREIGN KEY ("importJobId") REFERENCES "ImportJob"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SourceDocument" ADD CONSTRAINT "SourceDocument_supersedesId_fkey" FOREIGN KEY ("supersedesId") REFERENCES "SourceDocument"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ImportArtifact" ADD CONSTRAINT "ImportArtifact_importJobId_fkey" FOREIGN KEY ("importJobId") REFERENCES "ImportJob"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ImportAuditEvent" ADD CONSTRAINT "ImportAuditEvent_importJobId_fkey" FOREIGN KEY ("importJobId") REFERENCES "ImportJob"("id") ON DELETE CASCADE ON UPDATE CASCADE;
