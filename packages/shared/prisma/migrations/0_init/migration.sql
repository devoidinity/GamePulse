-- GamePulse initial schema
-- Enums --------------------------------------------------------------------
CREATE TYPE "Role" AS ENUM ('OWNER', 'ADMIN', 'ANALYST', 'READONLY');
CREATE TYPE "InsightType" AS ENUM ('DEAD_UPGRADE', 'LEVEL_DROPOFF', 'UNSPENT_CURRENCY', 'UNUSED_ITEM', 'ECONOMY_INFLATION', 'DEAD_GENERATOR');
CREATE TYPE "InsightSeverity" AS ENUM ('INFO', 'WARNING', 'CRITICAL');
CREATE TYPE "InsightStatus" AS ENUM ('OPEN', 'ACKNOWLEDGED', 'RESOLVED');

-- Tenancy & identity -------------------------------------------------------
CREATE TABLE "organizations" (
  "id" TEXT PRIMARY KEY,
  "name" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE "users" (
  "id" TEXT PRIMARY KEY,
  "email" TEXT NOT NULL,
  "passwordHash" TEXT NOT NULL,
  "name" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

CREATE TABLE "memberships" (
  "id" TEXT PRIMARY KEY,
  "userId" TEXT NOT NULL,
  "organizationId" TEXT NOT NULL,
  "role" "Role" NOT NULL DEFAULT 'READONLY',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "memberships_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE,
  CONSTRAINT "memberships_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE
);
CREATE UNIQUE INDEX "memberships_userId_organizationId_key" ON "memberships"("userId", "organizationId");
CREATE INDEX "memberships_organizationId_idx" ON "memberships"("organizationId");

CREATE TABLE "refresh_tokens" (
  "id" TEXT PRIMARY KEY,
  "userId" TEXT NOT NULL,
  "tokenHash" TEXT NOT NULL,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "revokedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "refresh_tokens_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE
);
CREATE UNIQUE INDEX "refresh_tokens_tokenHash_key" ON "refresh_tokens"("tokenHash");
CREATE INDEX "refresh_tokens_userId_idx" ON "refresh_tokens"("userId");

-- Projects & keys ----------------------------------------------------------
CREATE TABLE "projects" (
  "id" TEXT PRIMARY KEY,
  "organizationId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "apiKeyPrefix" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "projects_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE CASCADE
);
CREATE INDEX "projects_organizationId_idx" ON "projects"("organizationId");

CREATE TABLE "api_keys" (
  "id" TEXT PRIMARY KEY,
  "projectId" TEXT NOT NULL,
  "name" TEXT NOT NULL DEFAULT 'default',
  "prefix" TEXT NOT NULL,
  "hashedKey" TEXT NOT NULL,
  "lastUsedAt" TIMESTAMP(3),
  "revokedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "api_keys_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE CASCADE
);
CREATE UNIQUE INDEX "api_keys_hashedKey_key" ON "api_keys"("hashedKey");
CREATE INDEX "api_keys_projectId_idx" ON "api_keys"("projectId");
CREATE INDEX "api_keys_prefix_idx" ON "api_keys"("prefix");

-- Telemetry core -----------------------------------------------------------
CREATE TABLE "players" (
  "id" TEXT PRIMARY KEY,
  "projectId" TEXT NOT NULL,
  "externalPlayerId" TEXT NOT NULL,
  "firstSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "players_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE CASCADE
);
CREATE UNIQUE INDEX "players_projectId_externalPlayerId_key" ON "players"("projectId", "externalPlayerId");
CREATE INDEX "players_projectId_firstSeenAt_idx" ON "players"("projectId", "firstSeenAt");

CREATE TABLE "sessions" (
  "id" TEXT PRIMARY KEY,
  "projectId" TEXT NOT NULL,
  "playerId" TEXT NOT NULL,
  "externalId" TEXT,
  "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "endedAt" TIMESTAMP(3),
  "durationSeconds" INTEGER,
  CONSTRAINT "sessions_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE CASCADE,
  CONSTRAINT "sessions_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "players"("id") ON DELETE CASCADE
);
CREATE UNIQUE INDEX "sessions_projectId_externalId_key" ON "sessions"("projectId", "externalId");
CREATE INDEX "sessions_projectId_startedAt_idx" ON "sessions"("projectId", "startedAt");
CREATE INDEX "sessions_playerId_idx" ON "sessions"("playerId");

CREATE TABLE "events" (
  "id" TEXT PRIMARY KEY,
  "projectId" TEXT NOT NULL,
  "playerId" TEXT NOT NULL,
  "sessionId" TEXT,
  "eventName" TEXT NOT NULL,
  "properties" JSONB NOT NULL DEFAULT '{}',
  "timestamp" TIMESTAMP(3) NOT NULL,
  "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "events_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE CASCADE,
  CONSTRAINT "events_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "players"("id") ON DELETE CASCADE,
  CONSTRAINT "events_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "sessions"("id") ON DELETE SET NULL
);
CREATE INDEX "events_projectId_timestamp_idx" ON "events"("projectId", "timestamp");
CREATE INDEX "events_projectId_eventName_timestamp_idx" ON "events"("projectId", "eventName", "timestamp");
CREATE INDEX "events_projectId_playerId_timestamp_idx" ON "events"("projectId", "playerId", "timestamp");

-- Idempotency --------------------------------------------------------------
CREATE TABLE "idempotency_keys" (
  "id" TEXT PRIMARY KEY,
  "projectId" TEXT NOT NULL,
  "key" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX "idempotency_keys_projectId_key_key" ON "idempotency_keys"("projectId", "key");
CREATE INDEX "idempotency_keys_createdAt_idx" ON "idempotency_keys"("createdAt");

-- Aggregations -------------------------------------------------------------
CREATE TABLE "player_days" (
  "id" TEXT PRIMARY KEY,
  "projectId" TEXT NOT NULL,
  "playerId" TEXT NOT NULL,
  "date" DATE NOT NULL,
  CONSTRAINT "player_days_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE CASCADE
);
CREATE UNIQUE INDEX "player_days_projectId_playerId_date_key" ON "player_days"("projectId", "playerId", "date");
CREATE INDEX "player_days_projectId_date_idx" ON "player_days"("projectId", "date");

CREATE TABLE "daily_rollups" (
  "id" TEXT PRIMARY KEY,
  "projectId" TEXT NOT NULL,
  "date" DATE NOT NULL,
  "newPlayers" INTEGER NOT NULL DEFAULT 0,
  "activePlayers" INTEGER NOT NULL DEFAULT 0,
  "sessions" INTEGER NOT NULL DEFAULT 0,
  "events" INTEGER NOT NULL DEFAULT 0,
  "sessionSeconds" BIGINT NOT NULL DEFAULT 0,
  CONSTRAINT "daily_rollups_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE CASCADE
);
CREATE UNIQUE INDEX "daily_rollups_projectId_date_key" ON "daily_rollups"("projectId", "date");
CREATE INDEX "daily_rollups_projectId_date_idx" ON "daily_rollups"("projectId", "date");

-- Funnels & insights -------------------------------------------------------
CREATE TABLE "funnels" (
  "id" TEXT PRIMARY KEY,
  "projectId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "steps" JSONB NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "funnels_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE CASCADE
);
CREATE INDEX "funnels_projectId_idx" ON "funnels"("projectId");

CREATE TABLE "insights" (
  "id" TEXT PRIMARY KEY,
  "projectId" TEXT NOT NULL,
  "type" "InsightType" NOT NULL,
  "severity" "InsightSeverity" NOT NULL DEFAULT 'WARNING',
  "status" "InsightStatus" NOT NULL DEFAULT 'OPEN',
  "title" TEXT NOT NULL,
  "body" TEXT NOT NULL,
  "fingerprint" TEXT NOT NULL,
  "data" JSONB NOT NULL DEFAULT '{}',
  "detectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "insights_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE CASCADE
);
CREATE UNIQUE INDEX "insights_projectId_fingerprint_key" ON "insights"("projectId", "fingerprint");
CREATE INDEX "insights_projectId_status_idx" ON "insights"("projectId", "status");
CREATE INDEX "insights_projectId_detectedAt_idx" ON "insights"("projectId", "detectedAt");
