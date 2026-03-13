-- Enable pgvector extension (requires: CREATE EXTENSION vector; may need superuser)
CREATE EXTENSION IF NOT EXISTS vector;

-- Add vector column to embeddings (1536 = text-embedding-3-small / ada-002)
ALTER TABLE "embeddings" ADD COLUMN IF NOT EXISTS "embedding" vector(1536);

-- HNSW index for fast approximate nearest neighbor (cosine distance)
-- Optional: uncomment when you have data and want faster similarity search
-- CREATE INDEX IF NOT EXISTS "idx_embeddings_embedding_hnsw" ON "embeddings" USING hnsw ("embedding" vector_cosine_ops);
