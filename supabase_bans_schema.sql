-- Supabase / Postgres schema for bans table in codetorch schema
CREATE SCHEMA IF NOT EXISTS codetorch;

CREATE TABLE IF NOT EXISTS codetorch.bans (
  id BIGSERIAL PRIMARY KEY,
  username TEXT UNIQUE NOT NULL,
  reason TEXT,
  createdAt TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS codetorch_bans_username_idx ON codetorch.bans (LOWER(username));
