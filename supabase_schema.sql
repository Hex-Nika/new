-- Supabase / Postgres schema for Codetorch messages
-- Run this in SQL editor or psql connected to your Supabase database.

CREATE SCHEMA IF NOT EXISTS codetorch;

CREATE TABLE IF NOT EXISTS codetorch.messages (
  id BIGSERIAL PRIMARY KEY,
  author TEXT,
  content TEXT NOT NULL,
  blockId TEXT,
  createdAt TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Helpful indexes
CREATE INDEX IF NOT EXISTS codetorch_messages_created_at_idx ON codetorch.messages (createdAt);
CREATE INDEX IF NOT EXISTS codetorch_messages_author_idx ON codetorch.messages (LOWER(author));

-- Optional: enable pg_trgm on your database and create trigram index for faster text search on content
-- (Run only if allowed in your Supabase project)
-- CREATE EXTENSION IF NOT EXISTS pg_trgm;
-- CREATE INDEX IF NOT EXISTS codetorch_messages_content_trgm ON codetorch.messages USING gin (content gin_trgm_ops);

-- Grant usage to public (optional, adjust for your security model)
GRANT USAGE ON SCHEMA codetorch TO public;
GRANT SELECT, INSERT ON ALL TABLES IN SCHEMA codetorch TO public;
