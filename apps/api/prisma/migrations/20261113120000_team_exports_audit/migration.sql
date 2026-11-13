-- Team sign-in tracking, export approval requests and the audit log.
-- Safe to run on a database that already holds data: only adds columns/tables and copies old export requests across.

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "lastLoginAt" TIMESTAMP(3),
ADD COLUMN     "sessionsValidFrom" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "ExportRequest" (
    "id" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "filters" JSONB NOT NULL DEFAULT '{}',
    "rowCount" INTEGER NOT NULL DEFAULT 0,
    "requestedBy" TEXT NOT NULL,
    "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status" TEXT NOT NULL DEFAULT 'Pending',
    "decidedBy" TEXT,
    "decidedAt" TIMESTAMP(3),

    CONSTRAINT "ExportRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actor" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "target" TEXT NOT NULL DEFAULT '',
    "detail" JSONB NOT NULL DEFAULT '{}',

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ExportRequest_status_idx" ON "ExportRequest"("status");

-- CreateIndex
CREATE INDEX "ExportRequest_requestedBy_idx" ON "ExportRequest"("requestedBy");

-- CreateIndex
CREATE INDEX "AuditLog_at_idx" ON "AuditLog"("at");

-- CreateIndex
CREATE INDEX "AuditLog_target_idx" ON "AuditLog"("target");

-- Data copy: move existing export requests out of the KvStore JSON blob into the new table.
INSERT INTO "ExportRequest" ("id", "kind", "filters", "rowCount", "requestedBy", "requestedAt", "status")
SELECT
    elem->>'id',
    COALESCE(elem->>'kind', 'properties'),
    CASE WHEN jsonb_typeof(elem->'f') = 'object' THEN elem->'f' ELSE '{}'::jsonb END,
    CASE WHEN elem->>'n' ~ '^[0-9]+$' THEN (elem->>'n')::int ELSE 0 END,
    COALESCE(elem->>'by', ''),
    CASE WHEN elem->>'at' ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}' THEN (elem->>'at')::timestamp ELSE CURRENT_TIMESTAMP END,
    COALESCE(elem->>'status', 'Pending')
FROM "KvStore", jsonb_array_elements("KvStore"."value") AS elem
WHERE "KvStore"."key" = 'exportReq'
  AND jsonb_typeof("KvStore"."value") = 'array'
  AND elem->>'id' IS NOT NULL
ON CONFLICT ("id") DO NOTHING;

DELETE FROM "KvStore" WHERE "key" = 'exportReq';
