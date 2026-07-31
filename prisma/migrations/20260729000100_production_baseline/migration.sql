-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "EducationLevel" AS ENUM ('FUNDAMENTAL', 'MEDIO', 'TECNICO', 'SUPERIOR');

-- CreateEnum
CREATE TYPE "PublicationStatus" AS ENUM ('DRAFT', 'IN_REVIEW', 'PUBLISHED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "ScoringType" AS ENUM ('CE_PENALTY', 'MC_NO_PENALTY', 'MC_NEGATIVE');

-- CreateEnum
CREATE TYPE "QuestionType" AS ENUM ('CE', 'MC');

-- CreateEnum
CREATE TYPE "AnnulmentStatus" AS ENUM ('PENDING', 'NOT_ANNULLED', 'ANNULLED');

-- CreateEnum
CREATE TYPE "ImportStatus" AS ENUM ('PENDING', 'EXTRACTED', 'REVIEWED', 'PUBLISHED', 'FAILED');

-- CreateEnum
CREATE TYPE "ImportJobStage" AS ENUM ('CREATED', 'DISCOVERING_DOCUMENTS', 'WAITING_DOCUMENT_SELECTION', 'DOWNLOADING', 'EXTRACTING', 'GENERATING_EXAM', 'VALIDATING', 'DRY_RUN_COMPLETE', 'WAITING_REVIEW', 'FAILED', 'COMPLETED');

-- CreateEnum
CREATE TYPE "DocumentType" AS ENUM ('NOTICE', 'EXAM', 'ANSWER_KEY_PRELIMINARY', 'ANSWER_KEY_FINAL', 'RECTIFICATION', 'ANNULMENT_NOTICE', 'RESULT', 'OTHER');

-- CreateEnum
CREATE TYPE "DocumentStatus" AS ENUM ('DISCOVERED', 'SELECTED', 'DOWNLOADED', 'VALIDATED', 'REJECTED', 'SUPERSEDED');

-- CreateEnum
CREATE TYPE "ArtifactType" AS ENUM ('EXTRACTED_TEXT', 'MANIFEST', 'EXAM_JSON', 'DRY_RUN_REPORT', 'VISUAL_ASSET');

-- CreateEnum
CREATE TYPE "ImportDestinationType" AS ENUM ('NEW_CONTEST', 'EDITORIAL_ENTRY', 'EXISTING_CONTEST_NEW_PAPER', 'CANCELLED');

-- CreateEnum
CREATE TYPE "MonitorFrequency" AS ENUM ('DAILY', 'WEEKLY', 'MANUAL');

-- CreateEnum
CREATE TYPE "MonitorRunStatus" AS ENUM ('RUNNING', 'COMPLETED', 'COMPLETED_WITH_WARNINGS', 'FAILED', 'SKIPPED', 'LOCKED');

-- CreateEnum
CREATE TYPE "DocumentChangeType" AS ENUM ('NEW_DOCUMENT', 'CONTENT_CHANGED', 'DOCUMENT_REMOVED_FROM_PAGE', 'DOCUMENT_RENAMED', 'CLASSIFICATION_CHANGED', 'UNCHANGED');

-- CreateEnum
CREATE TYPE "DocumentImpactType" AS ENUM ('NEW_EXAM', 'NEW_ANSWER_KEY_PRELIMINARY', 'NEW_ANSWER_KEY_FINAL', 'ANSWER_KEY_CHANGED', 'RECTIFICATION', 'ANNULMENT_NOTICE', 'NOTICE_CHANGED', 'NEW_RESULT', 'UNKNOWN', 'NO_EDITORIAL_IMPACT');

-- CreateEnum
CREATE TYPE "ChangeReviewStatus" AS ENUM ('WAITING_REVIEW', 'ACKNOWLEDGED', 'IMPORT_JOB_CREATED', 'DISMISSED', 'RESOLVED');

-- CreateEnum
CREATE TYPE "EditorialProposalStatus" AS ENUM ('PENDING', 'ACCEPTED', 'REJECTED', 'APPLIED', 'CONFLICT');

-- CreateEnum
CREATE TYPE "CatalogTrustLevel" AS ENUM ('COMMUNITY_UNVERIFIED', 'COMMUNITY_CORROBORATED', 'OFFICIAL_LINK_FOUND', 'OFFICIAL_CONFIRMED', 'ADMIN_CONFIRMED');

-- CreateEnum
CREATE TYPE "CatalogProviderType" AS ENUM ('FIXTURE', 'MANUAL', 'GENERIC_JSON');

-- CreateEnum
CREATE TYPE "CatalogSyncStatus" AS ENUM ('RUNNING', 'COMPLETED', 'COMPLETED_WITH_WARNINGS', 'FAILED', 'SKIPPED', 'LOCKED');

-- CreateEnum
CREATE TYPE "CatalogExternalRecordStatus" AS ENUM ('ACTIVE', 'MISSING', 'SUPERSEDED', 'REJECTED');

-- CreateEnum
CREATE TYPE "CatalogConflictType" AS ENUM ('PROBABLE_DUPLICATE', 'PROTECTED_FIELD', 'INCOMPATIBLE_IDENTITY', 'INVALID_RECORD');

-- CreateEnum
CREATE TYPE "CatalogConflictStatus" AS ENUM ('PENDING', 'ACCEPTED', 'REJECTED', 'RESOLVED');

-- CreateEnum
CREATE TYPE "AttemptFinishReason" AS ENUM ('MANUAL', 'TIME_EXPIRED');

-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('USER', 'ADMIN');

-- CreateEnum
CREATE TYPE "VisualPlacement" AS ENUM ('STATEMENT', 'ALTERNATIVE', 'SHARED');

-- CreateTable
CREATE TABLE "Banca" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Banca_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EditorialCatalogEntry" (
    "id" TEXT NOT NULL,
    "catalogKey" TEXT NOT NULL,
    "bancaId" TEXT,
    "orgao" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "cargo" TEXT,
    "especialidade" TEXT,
    "ano" INTEGER,
    "edicao" TEXT,
    "nivel" "EducationLevel",
    "status" "PublicationStatus" NOT NULL DEFAULT 'IN_REVIEW',
    "trustLevel" "CatalogTrustLevel" NOT NULL DEFAULT 'ADMIN_CONFIRMED',
    "possibleOfficialUrl" TEXT,
    "informativeUrl" TEXT,
    "estimatedDate" TIMESTAMP(3),
    "forecastStatus" TEXT,
    "manuallyConfirmedFields" JSONB NOT NULL DEFAULT '[]',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EditorialCatalogEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Concurso" (
    "id" TEXT NOT NULL,
    "bancaId" TEXT NOT NULL,
    "orgao" TEXT NOT NULL,
    "cargo" TEXT NOT NULL,
    "ano" INTEGER NOT NULL,
    "edicao" TEXT,
    "nivel" "EducationLevel",
    "especialidade" TEXT,
    "dataProva" TIMESTAMP(3),
    "editalUrl" TEXT,
    "officialPageUrl" TEXT,
    "status" "PublicationStatus" NOT NULL DEFAULT 'PUBLISHED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Concurso_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ScoringRule" (
    "id" TEXT NOT NULL,
    "concursoId" TEXT NOT NULL,
    "type" "ScoringType" NOT NULL,
    "pointsCorrect" DOUBLE PRECISION NOT NULL,
    "pointsWrong" DOUBLE PRECISION NOT NULL,
    "pointsBlank" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "minimumTotalScore" DOUBLE PRECISION,
    "minimumCorrect" INTEGER,
    "floorAtZero" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "ScoringRule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExamBlock" (
    "id" TEXT NOT NULL,
    "concursoId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "minimumScore" DOUBLE PRECISION,
    "minimumCorrect" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ExamBlock_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExamPaper" (
    "id" TEXT NOT NULL,
    "concursoId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "title" TEXT,
    "appliedAt" TIMESTAMP(3),
    "provaUrl" TEXT,
    "gabaritoUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ExamPaper_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Subject" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,

    CONSTRAINT "Subject_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Topic" (
    "id" TEXT NOT NULL,
    "subjectId" TEXT NOT NULL,
    "name" TEXT NOT NULL,

    CONSTRAINT "Topic_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Question" (
    "id" TEXT NOT NULL,
    "concursoId" TEXT NOT NULL,
    "paperId" TEXT,
    "blockId" TEXT,
    "subjectId" TEXT NOT NULL,
    "topicId" TEXT,
    "number" INTEGER,
    "type" "QuestionType" NOT NULL,
    "statement" TEXT NOT NULL,
    "ceAnswer" BOOLEAN,
    "weight" DOUBLE PRECISION NOT NULL DEFAULT 1,
    "status" "PublicationStatus" NOT NULL DEFAULT 'PUBLISHED',
    "sourceUrl" TEXT,
    "sourcePage" INTEGER,
    "textReviewed" BOOLEAN NOT NULL DEFAULT false,
    "alternativesReviewed" BOOLEAN NOT NULL DEFAULT false,
    "answerKeyReviewed" BOOLEAN NOT NULL DEFAULT false,
    "requiresVisualReview" BOOLEAN NOT NULL DEFAULT false,
    "visualReviewResolved" BOOLEAN NOT NULL DEFAULT false,
    "publicationOverride" BOOLEAN NOT NULL DEFAULT false,
    "publicationOverrideReason" TEXT,
    "publicationOverrideAt" TIMESTAMP(3),
    "annulmentStatus" "AnnulmentStatus" NOT NULL DEFAULT 'NOT_ANNULLED',
    "extractionNotes" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "publishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Question_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "QuestionVisualAsset" (
    "id" TEXT NOT NULL,
    "questionId" TEXT NOT NULL,
    "placement" "VisualPlacement" NOT NULL DEFAULT 'STATEMENT',
    "alternativeLetter" TEXT,
    "assetPath" TEXT NOT NULL,
    "sourcePage" INTEGER NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "QuestionVisualAsset_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Alternative" (
    "id" TEXT NOT NULL,
    "questionId" TEXT NOT NULL,
    "letter" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "isCorrect" BOOLEAN NOT NULL,
    "isVisual" BOOLEAN NOT NULL DEFAULT false,
    "visualAssetPath" TEXT,
    "visualDescription" TEXT,
    "sourcePage" INTEGER,

    CONSTRAINT "Alternative_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT,
    "passwordHash" TEXT,
    "role" "UserRole" NOT NULL DEFAULT 'USER',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CatalogSource" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "providerType" "CatalogProviderType" NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "frequency" "MonitorFrequency" NOT NULL,
    "trustLevel" "CatalogTrustLevel" NOT NULL DEFAULT 'COMMUNITY_UNVERIFIED',
    "baseUrl" TEXT,
    "config" JSONB,
    "supportedFields" JSONB,
    "notes" TEXT,
    "lastSyncedAt" TIMESTAMP(3),
    "nextSyncAt" TIMESTAMP(3),
    "lastSuccessfulAt" TIMESTAMP(3),
    "lastErrorAt" TIMESTAMP(3),
    "lastError" TEXT,
    "consecutiveFailures" INTEGER NOT NULL DEFAULT 0,
    "lockedAt" TIMESTAMP(3),
    "lockedBy" TEXT,
    "lockExpiresAt" TIMESTAMP(3),
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CatalogSource_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CatalogSyncRun" (
    "id" TEXT NOT NULL,
    "catalogSourceId" TEXT NOT NULL,
    "status" "CatalogSyncStatus" NOT NULL,
    "lockToken" TEXT,
    "dryRun" BOOLEAN NOT NULL DEFAULT false,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMP(3),
    "receivedCount" INTEGER NOT NULL DEFAULT 0,
    "createdCount" INTEGER NOT NULL DEFAULT 0,
    "updatedCount" INTEGER NOT NULL DEFAULT 0,
    "unchangedCount" INTEGER NOT NULL DEFAULT 0,
    "conflictCount" INTEGER NOT NULL DEFAULT 0,
    "rejectedCount" INTEGER NOT NULL DEFAULT 0,
    "attempts" INTEGER NOT NULL DEFAULT 1,
    "cursor" JSONB,
    "warnings" JSONB,
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CatalogSyncRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CatalogExternalRecord" (
    "id" TEXT NOT NULL,
    "catalogSourceId" TEXT NOT NULL,
    "catalogSyncRunId" TEXT NOT NULL,
    "externalId" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "payloadHash" TEXT NOT NULL,
    "rawPayload" JSONB NOT NULL,
    "normalizedPayload" JSONB NOT NULL,
    "normalizedIdentity" TEXT NOT NULL,
    "status" "CatalogExternalRecordStatus" NOT NULL DEFAULT 'ACTIVE',
    "editorialCatalogEntryId" TEXT,
    "supersedesId" TEXT,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "consecutiveMissing" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CatalogExternalRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CatalogConflict" (
    "id" TEXT NOT NULL,
    "catalogSourceId" TEXT NOT NULL,
    "catalogExternalRecordId" TEXT NOT NULL,
    "editorialCatalogEntryId" TEXT,
    "type" "CatalogConflictType" NOT NULL,
    "status" "CatalogConflictStatus" NOT NULL DEFAULT 'PENDING',
    "field" TEXT,
    "currentValue" JSONB,
    "proposedValue" JSONB,
    "details" JSONB,
    "reviewedById" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "resolutionNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CatalogConflict_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SimulatedExam" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "concursoId" TEXT,
    "durationMinutes" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SimulatedExam_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SimulatedExamQuestion" (
    "id" TEXT NOT NULL,
    "simulatedExamId" TEXT NOT NULL,
    "questionId" TEXT NOT NULL,
    "order" INTEGER NOT NULL,

    CONSTRAINT "SimulatedExamQuestion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Attempt" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "simulatedExamId" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMP(3),
    "finishReason" "AttemptFinishReason",
    "totalScore" DOUBLE PRECISION,

    CONSTRAINT "Attempt_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AttemptAnswer" (
    "id" TEXT NOT NULL,
    "attemptId" TEXT NOT NULL,
    "questionId" TEXT NOT NULL,
    "userAnswer" TEXT NOT NULL,
    "isCorrect" BOOLEAN,
    "pointsEarned" DOUBLE PRECISION NOT NULL,

    CONSTRAINT "AttemptAnswer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ImportJob" (
    "id" TEXT NOT NULL,
    "concursoId" TEXT,
    "pdfUrl" TEXT NOT NULL,
    "gabaritoUrl" TEXT,
    "status" "ImportStatus" NOT NULL DEFAULT 'PENDING',
    "rawExtracted" JSONB,
    "errorMessage" TEXT,
    "idempotencyKey" TEXT,
    "officialUrl" TEXT,
    "board" TEXT,
    "institution" TEXT,
    "position" TEXT,
    "specialty" TEXT,
    "year" INTEGER,
    "edition" TEXT,
    "paperCode" TEXT,
    "adminNotes" TEXT,
    "stage" "ImportJobStage" NOT NULL DEFAULT 'CREATED',
    "previousStage" "ImportJobStage",
    "warnings" JSONB,
    "report" JSONB,
    "startedAt" TIMESTAMP(3),
    "finishedAt" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),
    "destinationType" "ImportDestinationType",
    "destinationEditorialEntryId" TEXT,
    "destinationContestId" TEXT,
    "importResult" JSONB,
    "sourceMonitorId" TEXT,
    "documentChangeId" TEXT,
    "isUpdate" BOOLEAN NOT NULL DEFAULT false,
    "adminUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ImportJob_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SourceDocument" (
    "id" TEXT NOT NULL,
    "importJobId" TEXT NOT NULL,
    "documentType" "DocumentType" NOT NULL,
    "sourceUrl" TEXT NOT NULL,
    "originalFilename" TEXT,
    "description" TEXT,
    "paperCode" TEXT,
    "displayOrder" INTEGER NOT NULL DEFAULT 0,
    "localPath" TEXT,
    "mimeType" TEXT,
    "sha256" TEXT,
    "size" INTEGER,
    "publishedAt" TIMESTAMP(3),
    "downloadedAt" TIMESTAMP(3),
    "version" INTEGER NOT NULL DEFAULT 1,
    "status" "DocumentStatus" NOT NULL DEFAULT 'DISCOVERED',
    "metadata" JSONB,
    "supersedesId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SourceDocument_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ImportArtifact" (
    "id" TEXT NOT NULL,
    "importJobId" TEXT NOT NULL,
    "artifactType" "ArtifactType" NOT NULL,
    "localPath" TEXT NOT NULL,
    "sha256" TEXT NOT NULL,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ImportArtifact_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ImportAuditEvent" (
    "id" TEXT NOT NULL,
    "importJobId" TEXT NOT NULL,
    "adminUserId" TEXT,
    "action" TEXT NOT NULL,
    "details" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ImportAuditEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SourceMonitor" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "sourceUrl" TEXT NOT NULL,
    "adapterType" TEXT NOT NULL,
    "institution" TEXT NOT NULL,
    "boardId" TEXT,
    "editorialCatalogEntryId" TEXT,
    "contestId" TEXT,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "frequency" "MonitorFrequency" NOT NULL,
    "notes" TEXT,
    "lastCheckedAt" TIMESTAMP(3),
    "nextCheckAt" TIMESTAMP(3),
    "lastSuccessfulAt" TIMESTAMP(3),
    "lastErrorAt" TIMESTAMP(3),
    "lastError" TEXT,
    "consecutiveFailures" INTEGER NOT NULL DEFAULT 0,
    "lockedAt" TIMESTAMP(3),
    "lockedBy" TEXT,
    "lockExpiresAt" TIMESTAMP(3),
    "lastManualRunAt" TIMESTAMP(3),
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SourceMonitor_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MonitorRun" (
    "id" TEXT NOT NULL,
    "sourceMonitorId" TEXT NOT NULL,
    "status" "MonitorRunStatus" NOT NULL,
    "lockToken" TEXT,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMP(3),
    "documentsDiscovered" INTEGER NOT NULL DEFAULT 0,
    "documentsNew" INTEGER NOT NULL DEFAULT 0,
    "documentsChanged" INTEGER NOT NULL DEFAULT 0,
    "documentsUnchanged" INTEGER NOT NULL DEFAULT 0,
    "warnings" JSONB,
    "error" TEXT,
    "attempts" INTEGER NOT NULL DEFAULT 1,
    "dryRun" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MonitorRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DocumentChange" (
    "id" TEXT NOT NULL,
    "monitorRunId" TEXT NOT NULL,
    "sourceDocumentId" TEXT,
    "previousDocumentId" TEXT,
    "changeType" "DocumentChangeType" NOT NULL,
    "impactType" "DocumentImpactType" NOT NULL,
    "status" "ChangeReviewStatus" NOT NULL DEFAULT 'WAITING_REVIEW',
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DocumentChange_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EditorialChangeProposal" (
    "id" TEXT NOT NULL,
    "documentChangeId" TEXT NOT NULL,
    "contestId" TEXT NOT NULL,
    "questionId" TEXT,
    "field" TEXT NOT NULL,
    "previousValue" JSONB,
    "proposedValue" JSONB,
    "sourceDocumentId" TEXT NOT NULL,
    "sourcePage" INTEGER,
    "status" "EditorialProposalStatus" NOT NULL DEFAULT 'PENDING',
    "reviewedById" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EditorialChangeProposal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AdminNotification" (
    "id" TEXT NOT NULL,
    "documentChangeId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "severity" TEXT NOT NULL,
    "readAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AdminNotification_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Banca_name_key" ON "Banca"("name");

-- CreateIndex
CREATE UNIQUE INDEX "EditorialCatalogEntry_catalogKey_key" ON "EditorialCatalogEntry"("catalogKey");

-- CreateIndex
CREATE INDEX "EditorialCatalogEntry_bancaId_idx" ON "EditorialCatalogEntry"("bancaId");

-- CreateIndex
CREATE INDEX "EditorialCatalogEntry_orgao_idx" ON "EditorialCatalogEntry"("orgao");

-- CreateIndex
CREATE INDEX "EditorialCatalogEntry_status_idx" ON "EditorialCatalogEntry"("status");

-- CreateIndex
CREATE INDEX "Concurso_bancaId_idx" ON "Concurso"("bancaId");

-- CreateIndex
CREATE INDEX "Concurso_orgao_ano_idx" ON "Concurso"("orgao", "ano");

-- CreateIndex
CREATE INDEX "Concurso_status_idx" ON "Concurso"("status");

-- CreateIndex
CREATE UNIQUE INDEX "ScoringRule_concursoId_key" ON "ScoringRule"("concursoId");

-- CreateIndex
CREATE INDEX "ExamBlock_concursoId_order_idx" ON "ExamBlock"("concursoId", "order");

-- CreateIndex
CREATE UNIQUE INDEX "ExamBlock_concursoId_name_key" ON "ExamBlock"("concursoId", "name");

-- CreateIndex
CREATE INDEX "ExamPaper_concursoId_idx" ON "ExamPaper"("concursoId");

-- CreateIndex
CREATE UNIQUE INDEX "ExamPaper_concursoId_code_key" ON "ExamPaper"("concursoId", "code");

-- CreateIndex
CREATE UNIQUE INDEX "Subject_name_key" ON "Subject"("name");

-- CreateIndex
CREATE INDEX "Topic_subjectId_idx" ON "Topic"("subjectId");

-- CreateIndex
CREATE UNIQUE INDEX "Topic_subjectId_name_key" ON "Topic"("subjectId", "name");

-- CreateIndex
CREATE INDEX "Question_concursoId_idx" ON "Question"("concursoId");

-- CreateIndex
CREATE INDEX "Question_paperId_idx" ON "Question"("paperId");

-- CreateIndex
CREATE INDEX "Question_blockId_idx" ON "Question"("blockId");

-- CreateIndex
CREATE INDEX "Question_subjectId_idx" ON "Question"("subjectId");

-- CreateIndex
CREATE INDEX "Question_topicId_idx" ON "Question"("topicId");

-- CreateIndex
CREATE INDEX "Question_status_idx" ON "Question"("status");

-- CreateIndex
CREATE INDEX "Question_requiresVisualReview_visualReviewResolved_idx" ON "Question"("requiresVisualReview", "visualReviewResolved");

-- CreateIndex
CREATE INDEX "Question_annulmentStatus_idx" ON "Question"("annulmentStatus");

-- CreateIndex
CREATE INDEX "QuestionVisualAsset_questionId_order_idx" ON "QuestionVisualAsset"("questionId", "order");

-- CreateIndex
CREATE UNIQUE INDEX "QuestionVisualAsset_questionId_assetPath_key" ON "QuestionVisualAsset"("questionId", "assetPath");

-- CreateIndex
CREATE INDEX "Alternative_questionId_idx" ON "Alternative"("questionId");

-- CreateIndex
CREATE UNIQUE INDEX "Alternative_questionId_letter_key" ON "Alternative"("questionId", "letter");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "CatalogSource_enabled_nextSyncAt_idx" ON "CatalogSource"("enabled", "nextSyncAt");

-- CreateIndex
CREATE INDEX "CatalogSource_providerType_idx" ON "CatalogSource"("providerType");

-- CreateIndex
CREATE INDEX "CatalogSyncRun_catalogSourceId_startedAt_idx" ON "CatalogSyncRun"("catalogSourceId", "startedAt");

-- CreateIndex
CREATE INDEX "CatalogSyncRun_status_idx" ON "CatalogSyncRun"("status");

-- CreateIndex
CREATE INDEX "CatalogExternalRecord_catalogSourceId_externalId_status_idx" ON "CatalogExternalRecord"("catalogSourceId", "externalId", "status");

-- CreateIndex
CREATE INDEX "CatalogExternalRecord_payloadHash_idx" ON "CatalogExternalRecord"("payloadHash");

-- CreateIndex
CREATE INDEX "CatalogExternalRecord_normalizedIdentity_idx" ON "CatalogExternalRecord"("normalizedIdentity");

-- CreateIndex
CREATE INDEX "CatalogExternalRecord_editorialCatalogEntryId_idx" ON "CatalogExternalRecord"("editorialCatalogEntryId");

-- CreateIndex
CREATE UNIQUE INDEX "CatalogExternalRecord_catalogSourceId_externalId_version_key" ON "CatalogExternalRecord"("catalogSourceId", "externalId", "version");

-- CreateIndex
CREATE INDEX "CatalogConflict_status_type_idx" ON "CatalogConflict"("status", "type");

-- CreateIndex
CREATE INDEX "CatalogConflict_catalogSourceId_idx" ON "CatalogConflict"("catalogSourceId");

-- CreateIndex
CREATE INDEX "CatalogConflict_editorialCatalogEntryId_idx" ON "CatalogConflict"("editorialCatalogEntryId");

-- CreateIndex
CREATE INDEX "SimulatedExam_concursoId_idx" ON "SimulatedExam"("concursoId");

-- CreateIndex
CREATE INDEX "SimulatedExamQuestion_simulatedExamId_order_idx" ON "SimulatedExamQuestion"("simulatedExamId", "order");

-- CreateIndex
CREATE INDEX "SimulatedExamQuestion_questionId_idx" ON "SimulatedExamQuestion"("questionId");

-- CreateIndex
CREATE UNIQUE INDEX "SimulatedExamQuestion_simulatedExamId_questionId_key" ON "SimulatedExamQuestion"("simulatedExamId", "questionId");

-- CreateIndex
CREATE INDEX "Attempt_userId_idx" ON "Attempt"("userId");

-- CreateIndex
CREATE INDEX "Attempt_simulatedExamId_idx" ON "Attempt"("simulatedExamId");

-- CreateIndex
CREATE INDEX "Attempt_finishedAt_idx" ON "Attempt"("finishedAt");

-- CreateIndex
CREATE INDEX "AttemptAnswer_attemptId_idx" ON "AttemptAnswer"("attemptId");

-- CreateIndex
CREATE INDEX "AttemptAnswer_questionId_idx" ON "AttemptAnswer"("questionId");

-- CreateIndex
CREATE UNIQUE INDEX "AttemptAnswer_attemptId_questionId_key" ON "AttemptAnswer"("attemptId", "questionId");

-- CreateIndex
CREATE UNIQUE INDEX "ImportJob_idempotencyKey_key" ON "ImportJob"("idempotencyKey");

-- CreateIndex
CREATE INDEX "ImportJob_concursoId_idx" ON "ImportJob"("concursoId");

-- CreateIndex
CREATE INDEX "ImportJob_status_idx" ON "ImportJob"("status");

-- CreateIndex
CREATE INDEX "ImportJob_stage_idx" ON "ImportJob"("stage");

-- CreateIndex
CREATE INDEX "ImportJob_adminUserId_idx" ON "ImportJob"("adminUserId");

-- CreateIndex
CREATE INDEX "ImportJob_destinationContestId_idx" ON "ImportJob"("destinationContestId");

-- CreateIndex
CREATE INDEX "ImportJob_destinationEditorialEntryId_idx" ON "ImportJob"("destinationEditorialEntryId");

-- CreateIndex
CREATE INDEX "ImportJob_sourceMonitorId_idx" ON "ImportJob"("sourceMonitorId");

-- CreateIndex
CREATE INDEX "ImportJob_documentChangeId_idx" ON "ImportJob"("documentChangeId");

-- CreateIndex
CREATE INDEX "SourceDocument_importJobId_status_idx" ON "SourceDocument"("importJobId", "status");

-- CreateIndex
CREATE INDEX "SourceDocument_sha256_idx" ON "SourceDocument"("sha256");

-- CreateIndex
CREATE INDEX "SourceDocument_importJobId_displayOrder_idx" ON "SourceDocument"("importJobId", "displayOrder");

-- CreateIndex
CREATE UNIQUE INDEX "SourceDocument_importJobId_sourceUrl_documentType_version_key" ON "SourceDocument"("importJobId", "sourceUrl", "documentType", "version");

-- CreateIndex
CREATE INDEX "ImportArtifact_importJobId_artifactType_idx" ON "ImportArtifact"("importJobId", "artifactType");

-- CreateIndex
CREATE UNIQUE INDEX "ImportArtifact_importJobId_artifactType_sha256_key" ON "ImportArtifact"("importJobId", "artifactType", "sha256");

-- CreateIndex
CREATE INDEX "ImportAuditEvent_importJobId_createdAt_idx" ON "ImportAuditEvent"("importJobId", "createdAt");

-- CreateIndex
CREATE INDEX "ImportAuditEvent_adminUserId_idx" ON "ImportAuditEvent"("adminUserId");

-- CreateIndex
CREATE INDEX "SourceMonitor_enabled_nextCheckAt_idx" ON "SourceMonitor"("enabled", "nextCheckAt");

-- CreateIndex
CREATE INDEX "SourceMonitor_contestId_idx" ON "SourceMonitor"("contestId");

-- CreateIndex
CREATE INDEX "SourceMonitor_editorialCatalogEntryId_idx" ON "SourceMonitor"("editorialCatalogEntryId");

-- CreateIndex
CREATE INDEX "SourceMonitor_boardId_idx" ON "SourceMonitor"("boardId");

-- CreateIndex
CREATE INDEX "MonitorRun_sourceMonitorId_startedAt_idx" ON "MonitorRun"("sourceMonitorId", "startedAt");

-- CreateIndex
CREATE INDEX "MonitorRun_status_idx" ON "MonitorRun"("status");

-- CreateIndex
CREATE INDEX "DocumentChange_monitorRunId_idx" ON "DocumentChange"("monitorRunId");

-- CreateIndex
CREATE INDEX "DocumentChange_status_impactType_idx" ON "DocumentChange"("status", "impactType");

-- CreateIndex
CREATE INDEX "DocumentChange_sourceDocumentId_idx" ON "DocumentChange"("sourceDocumentId");

-- CreateIndex
CREATE INDEX "EditorialChangeProposal_documentChangeId_idx" ON "EditorialChangeProposal"("documentChangeId");

-- CreateIndex
CREATE INDEX "EditorialChangeProposal_contestId_status_idx" ON "EditorialChangeProposal"("contestId", "status");

-- CreateIndex
CREATE INDEX "EditorialChangeProposal_questionId_idx" ON "EditorialChangeProposal"("questionId");

-- CreateIndex
CREATE UNIQUE INDEX "AdminNotification_documentChangeId_key" ON "AdminNotification"("documentChangeId");

-- CreateIndex
CREATE INDEX "AdminNotification_readAt_severity_idx" ON "AdminNotification"("readAt", "severity");

-- AddForeignKey
ALTER TABLE "EditorialCatalogEntry" ADD CONSTRAINT "EditorialCatalogEntry_bancaId_fkey" FOREIGN KEY ("bancaId") REFERENCES "Banca"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Concurso" ADD CONSTRAINT "Concurso_bancaId_fkey" FOREIGN KEY ("bancaId") REFERENCES "Banca"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScoringRule" ADD CONSTRAINT "ScoringRule_concursoId_fkey" FOREIGN KEY ("concursoId") REFERENCES "Concurso"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExamBlock" ADD CONSTRAINT "ExamBlock_concursoId_fkey" FOREIGN KEY ("concursoId") REFERENCES "Concurso"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExamPaper" ADD CONSTRAINT "ExamPaper_concursoId_fkey" FOREIGN KEY ("concursoId") REFERENCES "Concurso"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Topic" ADD CONSTRAINT "Topic_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "Subject"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Question" ADD CONSTRAINT "Question_concursoId_fkey" FOREIGN KEY ("concursoId") REFERENCES "Concurso"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Question" ADD CONSTRAINT "Question_paperId_fkey" FOREIGN KEY ("paperId") REFERENCES "ExamPaper"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Question" ADD CONSTRAINT "Question_blockId_fkey" FOREIGN KEY ("blockId") REFERENCES "ExamBlock"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Question" ADD CONSTRAINT "Question_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "Subject"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Question" ADD CONSTRAINT "Question_topicId_fkey" FOREIGN KEY ("topicId") REFERENCES "Topic"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuestionVisualAsset" ADD CONSTRAINT "QuestionVisualAsset_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "Question"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Alternative" ADD CONSTRAINT "Alternative_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "Question"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CatalogSource" ADD CONSTRAINT "CatalogSource_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CatalogSyncRun" ADD CONSTRAINT "CatalogSyncRun_catalogSourceId_fkey" FOREIGN KEY ("catalogSourceId") REFERENCES "CatalogSource"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CatalogExternalRecord" ADD CONSTRAINT "CatalogExternalRecord_catalogSourceId_fkey" FOREIGN KEY ("catalogSourceId") REFERENCES "CatalogSource"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CatalogExternalRecord" ADD CONSTRAINT "CatalogExternalRecord_catalogSyncRunId_fkey" FOREIGN KEY ("catalogSyncRunId") REFERENCES "CatalogSyncRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CatalogExternalRecord" ADD CONSTRAINT "CatalogExternalRecord_editorialCatalogEntryId_fkey" FOREIGN KEY ("editorialCatalogEntryId") REFERENCES "EditorialCatalogEntry"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CatalogExternalRecord" ADD CONSTRAINT "CatalogExternalRecord_supersedesId_fkey" FOREIGN KEY ("supersedesId") REFERENCES "CatalogExternalRecord"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CatalogConflict" ADD CONSTRAINT "CatalogConflict_catalogSourceId_fkey" FOREIGN KEY ("catalogSourceId") REFERENCES "CatalogSource"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CatalogConflict" ADD CONSTRAINT "CatalogConflict_catalogExternalRecordId_fkey" FOREIGN KEY ("catalogExternalRecordId") REFERENCES "CatalogExternalRecord"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CatalogConflict" ADD CONSTRAINT "CatalogConflict_editorialCatalogEntryId_fkey" FOREIGN KEY ("editorialCatalogEntryId") REFERENCES "EditorialCatalogEntry"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CatalogConflict" ADD CONSTRAINT "CatalogConflict_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SimulatedExam" ADD CONSTRAINT "SimulatedExam_concursoId_fkey" FOREIGN KEY ("concursoId") REFERENCES "Concurso"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SimulatedExamQuestion" ADD CONSTRAINT "SimulatedExamQuestion_simulatedExamId_fkey" FOREIGN KEY ("simulatedExamId") REFERENCES "SimulatedExam"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SimulatedExamQuestion" ADD CONSTRAINT "SimulatedExamQuestion_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "Question"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Attempt" ADD CONSTRAINT "Attempt_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Attempt" ADD CONSTRAINT "Attempt_simulatedExamId_fkey" FOREIGN KEY ("simulatedExamId") REFERENCES "SimulatedExam"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AttemptAnswer" ADD CONSTRAINT "AttemptAnswer_attemptId_fkey" FOREIGN KEY ("attemptId") REFERENCES "Attempt"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AttemptAnswer" ADD CONSTRAINT "AttemptAnswer_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "Question"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ImportJob" ADD CONSTRAINT "ImportJob_concursoId_fkey" FOREIGN KEY ("concursoId") REFERENCES "Concurso"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ImportJob" ADD CONSTRAINT "ImportJob_destinationEditorialEntryId_fkey" FOREIGN KEY ("destinationEditorialEntryId") REFERENCES "EditorialCatalogEntry"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ImportJob" ADD CONSTRAINT "ImportJob_destinationContestId_fkey" FOREIGN KEY ("destinationContestId") REFERENCES "Concurso"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ImportJob" ADD CONSTRAINT "ImportJob_sourceMonitorId_fkey" FOREIGN KEY ("sourceMonitorId") REFERENCES "SourceMonitor"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ImportJob" ADD CONSTRAINT "ImportJob_documentChangeId_fkey" FOREIGN KEY ("documentChangeId") REFERENCES "DocumentChange"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ImportJob" ADD CONSTRAINT "ImportJob_adminUserId_fkey" FOREIGN KEY ("adminUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SourceDocument" ADD CONSTRAINT "SourceDocument_importJobId_fkey" FOREIGN KEY ("importJobId") REFERENCES "ImportJob"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SourceDocument" ADD CONSTRAINT "SourceDocument_supersedesId_fkey" FOREIGN KEY ("supersedesId") REFERENCES "SourceDocument"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ImportArtifact" ADD CONSTRAINT "ImportArtifact_importJobId_fkey" FOREIGN KEY ("importJobId") REFERENCES "ImportJob"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ImportAuditEvent" ADD CONSTRAINT "ImportAuditEvent_importJobId_fkey" FOREIGN KEY ("importJobId") REFERENCES "ImportJob"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SourceMonitor" ADD CONSTRAINT "SourceMonitor_boardId_fkey" FOREIGN KEY ("boardId") REFERENCES "Banca"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SourceMonitor" ADD CONSTRAINT "SourceMonitor_editorialCatalogEntryId_fkey" FOREIGN KEY ("editorialCatalogEntryId") REFERENCES "EditorialCatalogEntry"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SourceMonitor" ADD CONSTRAINT "SourceMonitor_contestId_fkey" FOREIGN KEY ("contestId") REFERENCES "Concurso"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SourceMonitor" ADD CONSTRAINT "SourceMonitor_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MonitorRun" ADD CONSTRAINT "MonitorRun_sourceMonitorId_fkey" FOREIGN KEY ("sourceMonitorId") REFERENCES "SourceMonitor"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocumentChange" ADD CONSTRAINT "DocumentChange_monitorRunId_fkey" FOREIGN KEY ("monitorRunId") REFERENCES "MonitorRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocumentChange" ADD CONSTRAINT "DocumentChange_sourceDocumentId_fkey" FOREIGN KEY ("sourceDocumentId") REFERENCES "SourceDocument"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DocumentChange" ADD CONSTRAINT "DocumentChange_previousDocumentId_fkey" FOREIGN KEY ("previousDocumentId") REFERENCES "SourceDocument"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EditorialChangeProposal" ADD CONSTRAINT "EditorialChangeProposal_documentChangeId_fkey" FOREIGN KEY ("documentChangeId") REFERENCES "DocumentChange"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EditorialChangeProposal" ADD CONSTRAINT "EditorialChangeProposal_contestId_fkey" FOREIGN KEY ("contestId") REFERENCES "Concurso"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EditorialChangeProposal" ADD CONSTRAINT "EditorialChangeProposal_sourceDocumentId_fkey" FOREIGN KEY ("sourceDocumentId") REFERENCES "SourceDocument"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EditorialChangeProposal" ADD CONSTRAINT "EditorialChangeProposal_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdminNotification" ADD CONSTRAINT "AdminNotification_documentChangeId_fkey" FOREIGN KEY ("documentChangeId") REFERENCES "DocumentChange"("id") ON DELETE CASCADE ON UPDATE CASCADE;
