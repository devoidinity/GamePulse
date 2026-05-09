-- OPTIONAL: native monthly range partitioning for the events table.
-- ---------------------------------------------------------------------------
-- The Prisma model keeps `events` as a flat table for portability. At scale
-- (100M+ rows) convert it to a PARTITIONED table on `timestamp`. This is a
-- one-time, manual migration because Postgres cannot convert an existing table
-- in place — you create a partitioned twin, copy, and swap.
--
-- Run during a maintenance window. All analytical indexes already lead with
-- (projectId, timestamp), which aligns with monthly pruning.
-- ---------------------------------------------------------------------------

-- 1. Create the partitioned replacement.
CREATE TABLE "events_partitioned" (
  "id" TEXT NOT NULL,
  "projectId" TEXT NOT NULL,
  "playerId" TEXT NOT NULL,
  "sessionId" TEXT,
  "eventName" TEXT NOT NULL,
  "properties" JSONB NOT NULL DEFAULT '{}',
  "timestamp" TIMESTAMP(3) NOT NULL,
  "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY ("id", "timestamp")          -- partition key must be in the PK
) PARTITION BY RANGE ("timestamp");

CREATE INDEX ON "events_partitioned" ("projectId", "timestamp");
CREATE INDEX ON "events_partitioned" ("projectId", "eventName", "timestamp");
CREATE INDEX ON "events_partitioned" ("projectId", "playerId", "timestamp");

-- 2. Create monthly partitions (automate with pg_partman in production).
--    Example for one month:
-- CREATE TABLE "events_2026_01" PARTITION OF "events_partitioned"
--   FOR VALUES FROM ('2026-01-01') TO ('2026-02-01');

-- 3. Backfill: INSERT INTO "events_partitioned" SELECT * FROM "events";
-- 4. Swap: ALTER TABLE "events" RENAME TO "events_old";
--          ALTER TABLE "events_partitioned" RENAME TO "events";
-- 5. Drop "events_old" once verified.
