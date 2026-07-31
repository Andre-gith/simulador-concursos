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

-- AlterTable
ALTER TABLE "EditorialCatalogEntry" ADD COLUMN     "estimatedDate" TIMESTAMP(3),
ADD COLUMN     "forecastStatus" TEXT,
ADD COLUMN     "informativeUrl" TEXT,
ADD COLUMN     "manuallyConfirmedFields" JSONB NOT NULL DEFAULT '[]',
ADD COLUMN     "possibleOfficialUrl" TEXT,
ADD COLUMN     "trustLevel" "CatalogTrustLevel" NOT NULL DEFAULT 'ADMIN_CONFIRMED';

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
