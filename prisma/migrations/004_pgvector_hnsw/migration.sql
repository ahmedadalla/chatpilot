-- 004_pgvector_hnsw.sql
-- Enables pgvector extension, adds vector(1536) embedding column to knowledge_chunks,
-- and builds the HNSW cosine similarity index (D-7, ARCHITECTURE.md §7.5)

-- 1. Enable pgvector extension
CREATE EXTENSION IF NOT EXISTS vector;

-- 2. Add embedding vector column to knowledge_chunks (not knowledge_base_documents)
ALTER TABLE "knowledge_chunks"
  ADD COLUMN IF NOT EXISTS "embedding" vector(1536);

-- 3. Create HNSW index using cosine similarity distance metric
CREATE INDEX IF NOT EXISTS "kb_hnsw"
  ON "knowledge_chunks"
  USING hnsw ("embedding" vector_cosine_ops);

-- Grant privileges to chatpilot_app
GRANT SELECT, INSERT, UPDATE, DELETE ON "knowledge_chunks" TO chatpilot_app;
